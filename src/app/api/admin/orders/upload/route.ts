import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import type { UploadResultRow } from "@/lib/types";

const MAX_ROWS = 2000;

// Real manifest headers vary in casing/spacing/punctuation across exports
// ("Pick Up Date" vs "Pick up time", "No. Of Boxes") -- normalize before
// matching so the parser doesn't depend on the admin retyping headers.
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  customer: "customer",
  awb: "awb",
  to: "to",
  address: "address",
  pincode: "pincode",
  city: "city",
  pickupdate: "pickupDate",
  pickuptime: "pickupTime",
  receivername: "receiverName",
  sprintername: "driverName",
  mobilenumber: "driverPhone",
  mobileno: "driverPhone",
  phonenumber: "driverPhone",
  contactnumber: "driverPhone",
};

type ParsedRow = {
  customer?: string;
  awb?: string;
  to?: string;
  address?: string;
  pincode?: string;
  city?: string;
  pickupDate?: string;
  pickupTime?: string;
  receiverName?: string;
  driverName?: string;
  driverPhone?: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Pick Up Date" values in the real sheet have no year (e.g. "01-Aug") --
// per explicit instruction, always resolve the year to whatever year it is
// at the moment the upload is processed, regardless of what's in the cell.
function parsePickupAt(dateRaw: unknown, timeRaw: unknown): string | null {
  if (dateRaw === undefined || dateRaw === null || dateRaw === "") return null;
  const currentYear = new Date().getFullYear();

  let day: number | undefined;
  let month: number | undefined;
  if (dateRaw instanceof Date) {
    day = dateRaw.getDate();
    month = dateRaw.getMonth();
  } else {
    const str = String(dateRaw).trim();
    const match = /^(\d{1,2})[-\/\s]([A-Za-z]{3,})/.exec(str);
    if (match) {
      day = parseInt(match[1], 10);
      month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        day = d.getDate();
        month = d.getMonth();
      }
    }
  }
  if (day === undefined || month === undefined || month < 0 || isNaN(day)) return null;

  let hours = 0;
  let minutes = 0;
  if (timeRaw !== undefined && timeRaw !== null && timeRaw !== "") {
    if (timeRaw instanceof Date) {
      hours = timeRaw.getHours();
      minutes = timeRaw.getMinutes();
    } else {
      const tMatch = /^(\d{1,2}):(\d{2})/.exec(String(timeRaw).trim());
      if (tMatch) {
        hours = parseInt(tMatch[1], 10);
        minutes = parseInt(tMatch[2], 10);
      }
    }
  }

  const d = new Date(currentYear, month, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

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

  let rawRows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Make sure it's a valid .xlsx file." },
      { status: 400 }
    );
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ error: "The sheet has no data rows." }, { status: 400 });
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS} per upload).` },
      { status: 400 }
    );
  }

  const firstRowKeys = Object.keys(rawRows[0]);
  const normalizedToKnown = new Map<string, string>();
  for (const key of firstRowKeys) {
    const known = HEADER_MAP[normalizeHeader(key)];
    if (known) normalizedToKnown.set(key, known);
  }
  const hasCoreColumns = ["customer", "awb", "address"].every((needed) =>
    Array.from(normalizedToKnown.values()).includes(needed)
  );
  if (!hasCoreColumns) {
    return NextResponse.json(
      {
        error:
          "This file doesn't look like the expected manifest. Expected at least Customer, AWB, and Address columns.",
      },
      { status: 400 }
    );
  }

  const rows: ParsedRow[] = rawRows.map((raw) => {
    const parsed: ParsedRow = {};
    for (const [originalKey, value] of Object.entries(raw)) {
      const known = normalizedToKnown.get(originalKey);
      if (!known) continue;
      (parsed as Record<string, unknown>)[known] =
        value instanceof Date ? value : String(value ?? "").trim();
    }
    return parsed;
  });

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
      p_driver_username: driverName,
      p_driver_phone: driverPhone,
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

    results.push({
      row: rowNum,
      orderId: data.order_id,
      orderNumber: data.order_number,
      customerCode,
      customerName: customerCode,
      driverAssigned: driverName,
      status: "created",
      customerCreated: data.is_new_customer,
      generatedPassword: data.is_new_customer ? plaintextPassword : undefined,
      warning: data.driver_warning ?? undefined,
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
