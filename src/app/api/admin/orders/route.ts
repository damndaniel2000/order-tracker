import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const [{ data: orders, error }, { data: drivers }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers (name, customer_code), order_events (*), order_items (*)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("drivers")
      .select("id, username, email, display_name, phone, is_active")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flattened = (orders ?? []).map((order) => {
    const { customers, ...rest } = order;
    return {
      ...rest,
      customer_name: customers?.name ?? "",
      customer_code: customers?.customer_code ?? "",
    };
  });

  return NextResponse.json({ orders: flattened, drivers: drivers ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const customerId = body.customerId ? String(body.customerId) : null;
  const newCustomerCode = body.newCustomerCode ? String(body.newCustomerCode).trim() : null;
  const newCustomerName = body.newCustomerName ? String(body.newCustomerName).trim() : null;
  const orderNumber = body.orderNumber ? String(body.orderNumber).trim() : null;
  const shippingAddress = String(body.shippingAddress ?? "").trim();
  const pincode = body.pincode ? String(body.pincode).trim() : null;
  const city = body.city ? String(body.city).trim() : null;
  const receiverName = body.receiverName ? String(body.receiverName).trim() : null;
  const consigneeName = body.consigneeName ? String(body.consigneeName).trim() : null;
  const pickupAt = body.pickupAt ? String(body.pickupAt) : null;
  const assignedDriverId = body.assignedDriverId ? String(body.assignedDriverId) : null;

  if (!shippingAddress) {
    return NextResponse.json({ error: "Shipping address is required." }, { status: 400 });
  }

  const supabase = createServiceClient();

  let customerCode: string;
  let customerName: string;
  let passwordHash: string | null = null;
  let plaintextPassword: string | undefined;

  if (customerId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("customer_code, name")
      .eq("id", customerId)
      .single();
    if (customerError || !customer) {
      return NextResponse.json({ error: "Selected customer not found." }, { status: 400 });
    }
    customerCode = customer.customer_code;
    customerName = customer.name;
  } else if (newCustomerCode && newCustomerName) {
    customerCode = newCustomerCode;
    customerName = newCustomerName;
    plaintextPassword = generatePassword();
    passwordHash = await bcrypt.hash(plaintextPassword, 10);
  } else {
    return NextResponse.json(
      { error: "Select an existing customer or provide a new customer code and name." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("create_uploaded_order", {
    p_order_number: orderNumber,
    p_customer_code: customerCode,
    p_customer_name: customerName,
    p_password_hash: passwordHash,
    p_shipping_address: shippingAddress,
    p_pincode: pincode,
    p_city: city,
    p_receiver_name: receiverName,
    p_consignee_name: consigneeName,
    p_pickup_at: pickupAt,
    p_driver_username: null,
    p_driver_phone: null,
  });

  if (error) {
    const message = error.message.includes("duplicate key")
      ? `AWB "${orderNumber}" already exists as an order.`
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (assignedDriverId) {
    await supabase.from("orders").update({ assigned_driver_id: assignedDriverId }).eq("id", data.order_id);
  }

  return NextResponse.json({
    orderId: data.order_id,
    orderNumber: data.order_number,
    isNewCustomer: data.is_new_customer,
    generatedPassword: data.is_new_customer ? plaintextPassword : undefined,
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const orderId = body.orderId as string;
  const status = body.status as OrderStatus | undefined;
  const title = body.title as string | undefined;
  const description = body.description as string | undefined;
  const locationLabel = body.locationLabel as string | undefined;
  const driverLat = body.driverLat as number | undefined;
  const driverLng = body.driverLng as number | undefined;
  const driverName = body.driverName as string | undefined;
  const assignedDriverId = body.assignedDriverId as string | null | undefined;

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};

  if (status) updates.status = status;
  if (assignedDriverId !== undefined) {
    updates.assigned_driver_id = assignedDriverId || null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (status) {
    const { error: eventError } = await supabase.from("order_events").insert({
      order_id: orderId,
      status,
      title: title ?? `Status updated to ${status.replace(/_/g, " ")}`,
      description: description ?? null,
      location_label: locationLabel ?? null,
    });

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }
  }

  if (driverLat != null && driverLng != null) {
    await supabase.from("delivery_locations").insert({
      order_id: orderId,
      driver_name: driverName ?? "Delivery Driver",
      lat: driverLat,
      lng: driverLng,
    });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `*, customers (name, customer_code), order_events (*), order_items (*), delivery_locations (*)`
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found after update." }, { status: 500 });
  }

  const { customers, ...rest } = order;
  return NextResponse.json({
    ...rest,
    customer_name: customers?.name ?? "",
    customer_code: customers?.customer_code ?? "",
  });
}
