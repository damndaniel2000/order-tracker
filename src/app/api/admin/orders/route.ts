import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const [{ data: orders, error }, { data: drivers }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers (name, customer_code), order_events (*)")
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
