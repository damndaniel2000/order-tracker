import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { parseManifest, parsePickupAt } from "@/lib/order-upload-parser";
import type { UploadResultRow } from "@/lib/types";

function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const overwrite = formData.get("overwrite") === "true";

  // Resolutions the admin made in the preview step for sheet driver values
  // that didn't auto-match (e.g. "AKASH" -> a specific driver id), keyed by
  // the same phone-or-name value the real parse below produces per row.
  let driverOverrides: Record<string, { id: string; display_name: string }> = {};
  const overridesRaw = formData.get("driverOverrides");
  if (typeof overridesRaw === "string" && overridesRaw) {
    try {
      driverOverrides = JSON.parse(overridesRaw);
    } catch {
      // ignore malformed overrides rather than failing the whole upload
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = parseManifest(buf);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const rows = parsed.rows;

  const supabase = createServiceClient();

  const codes = Array.from(
    new Set(rows.map((r) => String(r.customer ?? "").trim()).filter(Boolean))
  );
  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("customer_code")
    .in("customer_code", codes.length > 0 ? codes : [""]);
  const existingCodes = new Set((existingCustomers ?? []).map((c) => c.customer_code));

  const results: UploadResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for header row, 1-indexed sheet rows
    const row = rows[i];
    const customerCode = String(row.customer ?? "").trim();
    const orderNumber = String(row.awb ?? "").trim();
    const shippingAddress = String(row.address ?? "").trim();
    const pincode = String(row.pincode ?? "").trim() || null;
    const city = String(row.city ?? "").trim() || null;
    const receiverName = String(row.receiverName ?? "").trim() || null;
    const consigneeName = String(row.to ?? "").trim() || null;
    const driverName = String(row.driverName ?? "").trim() || null;
    const driverPhone = String(row.driverPhone ?? "").trim() || null;
    const pickupAt = parsePickupAt(row.pickupDate, row.pickupTime);
    const override = driverOverrides[driverPhone || driverName || ""];

    if (!customerCode || !orderNumber || !shippingAddress) {
      results.push({
        row: rowNum,
        customerCode: customerCode || "(missing)",
        status: "error",
        error: "Customer, AWB, and Address are all required.",
        customerCreated: false,
      });
      continue;
    }

    const isNewCode = !existingCodes.has(customerCode);
    let passwordHash: string | null = null;
    let plaintextPassword: string | undefined;
    if (isNewCode) {
      plaintextPassword = generatePassword();
      passwordHash = await bcrypt.hash(plaintextPassword, 10);
    }

    const { data, error } = await supabase.rpc("create_uploaded_order", {
      p_order_number: orderNumber,
      p_customer_code: customerCode,
      p_customer_name: customerCode,
      p_password_hash: passwordHash,
      p_shipping_address: shippingAddress,
      p_pincode: pincode,
      p_city: city,
      p_receiver_name: receiverName,
      p_consignee_name: consigneeName,
      p_pickup_at: pickupAt,
      // An admin-resolved override takes over driver assignment entirely --
      // skip the RPC's own username/phone matching for this row so it can't
      // second-guess a resolution the admin already made in the preview.
      p_driver_username: override ? null : driverName,
      p_driver_phone: override ? null : driverPhone,
    });

    if (error) {
      const isDuplicate = error.message.includes("duplicate key");
      if (isDuplicate && overwrite) {
        // Only ever touch the fields that came from the sheet -- never
        // status, driver assignment, or event history, so a re-upload can
        // fix a typo'd address/pincode without silently reverting a
        // delivery already in progress back to square one.
        const { data: updatedOrder, error: updateError } = await supabase
          .from("orders")
          .update({
            shipping_address: shippingAddress,
            pincode,
            city,
            receiver_name: receiverName,
            consignee_name: consigneeName,
            pickup_at: pickupAt,
          })
          .eq("order_number", orderNumber)
          .select("id, assigned_driver_id")
          .single();

        if (updateError) {
          results.push({
            row: rowNum,
            customerCode,
            status: "error",
            error: updateError.message,
            customerCreated: false,
          });
        } else {
          results.push({
            row: rowNum,
            orderId: updatedOrder.id,
            orderNumber,
            customerCode,
            customerName: customerCode,
            driverAssigned: driverName || driverPhone,
            status: "updated",
            customerCreated: false,
            warning: updatedOrder.assigned_driver_id
              ? undefined
              : "This order has no driver assigned.",
          });
        }
        continue;
      }

      const message = isDuplicate
        ? `AWB "${orderNumber}" already exists as an order.`
        : error.message;
      results.push({
        row: rowNum,
        customerCode,
        status: "error",
        error: message,
        customerCreated: false,
      });
      continue;
    }

    existingCodes.add(customerCode);

    if (override) {
      await supabase
        .from("orders")
        .update({ assigned_driver_id: override.id })
        .eq("id", data.order_id);
    }

    results.push({
      row: rowNum,
      orderId: data.order_id,
      orderNumber: data.order_number,
      customerCode,
      customerName: customerCode,
      driverAssigned: override ? override.display_name : driverName,
      status: "created",
      customerCreated: data.is_new_customer,
      generatedPassword: data.is_new_customer ? plaintextPassword : undefined,
      warning: override ? undefined : (data.driver_warning ?? undefined),
    });
  }

  const summary = {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    failed: results.filter((r) => r.status === "error").length,
    newCustomers: results.filter((r) => r.customerCreated).length,
  };

  return NextResponse.json({ summary, results });
}
