import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { matchDriver, parseManifest, parsePickupAt } from "@/lib/order-upload-parser";
import type { UploadPreviewRow } from "@/lib/types";

// Read-only dry run: parses the sheet and reports exactly what an actual
// upload would do (new vs. existing customer, AWB collisions, driver match)
// without writing anything to the database.
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
  const awbs = Array.from(new Set(rows.map((r) => String(r.awb ?? "").trim()).filter(Boolean)));

  const [{ data: existingCustomers }, { data: existingOrders }, { data: drivers }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("customer_code")
        .in("customer_code", codes.length > 0 ? codes : [""]),
      supabase
        .from("orders")
        .select("order_number")
        .in("order_number", awbs.length > 0 ? awbs : [""]),
      supabase
        .from("drivers")
        .select("username, display_name, phone")
        .eq("is_active", true),
    ]);

  const existingCodes = new Set((existingCustomers ?? []).map((c) => c.customer_code));
  const existingAwbs = new Set((existingOrders ?? []).map((o) => o.order_number));

  const preview: UploadPreviewRow[] = rows.map((row, i) => {
    const rowNum = i + 2;
    const customerCode = String(row.customer ?? "").trim();
    const orderNumber = String(row.awb ?? "").trim();
    const shippingAddress = String(row.address ?? "").trim();
    const driverName = String(row.driverName ?? "").trim() || null;
    const driverPhone = String(row.driverPhone ?? "").trim() || null;

    if (!customerCode || !orderNumber || !shippingAddress) {
      return {
        row: rowNum,
        customerCode: customerCode || "(missing)",
        isNewCustomer: false,
        orderNumber: orderNumber || "(missing)",
        alreadyExists: false,
        shippingAddress,
        city: null,
        pincode: null,
        receiverName: null,
        consigneeName: null,
        pickupAt: null,
        driverName,
        driverPhone,
        matchedDriverName: null,
        error: "Customer, AWB, and Address are all required.",
      };
    }

    const matched = matchDriver(drivers ?? [], driverPhone, driverName);

    return {
      row: rowNum,
      customerCode,
      isNewCustomer: !existingCodes.has(customerCode),
      orderNumber,
      alreadyExists: existingAwbs.has(orderNumber),
      shippingAddress,
      city: String(row.city ?? "").trim() || null,
      pincode: String(row.pincode ?? "").trim() || null,
      receiverName: String(row.receiverName ?? "").trim() || null,
      consigneeName: String(row.to ?? "").trim() || null,
      pickupAt: parsePickupAt(row.pickupDate, row.pickupTime),
      driverName,
      driverPhone,
      matchedDriverName: matched?.display_name ?? null,
    };
  });

  return NextResponse.json({ preview });
}
