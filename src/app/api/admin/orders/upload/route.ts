import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import type { UploadResultRow } from "@/lib/types";

const MAX_ROWS = 2000;
const EXPECTED_KEYS = [
  "customer_code",
  "customer_name",
  "shipping_address",
  "items",
];

type SheetRow = {
  customer_code?: unknown;
  customer_name?: unknown;
  shipping_address?: unknown;
  items?: unknown;
  driver_username?: unknown;
};

function parseItems(raw: string): { name: string; quantity: number }[] {
  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = /^(.+?)\s*x\s*(\d+)\s*$/i.exec(segment);
      if (match) {
        return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
      }
      return { name: segment, quantity: 1 };
    });
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

  let rows: SheetRow[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Make sure it's a valid .xlsx file." },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "The sheet has no data rows." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS} per upload).` },
      { status: 400 }
    );
  }
  const firstRowKeys = Object.keys(rows[0]);
  const hasExpectedColumn = EXPECTED_KEYS.some((key) => firstRowKeys.includes(key));
  if (!hasExpectedColumn) {
    return NextResponse.json(
      {
        error:
          "This file doesn't look like the expected template. Expected columns: " +
          EXPECTED_KEYS.join(", ") + ", driver_username (optional).",
      },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const codes = Array.from(
    new Set(
      rows
        .map((r) => String(r.customer_code ?? "").trim())
        .filter(Boolean)
    )
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
    const customerCode = String(row.customer_code ?? "").trim();
    const customerName = String(row.customer_name ?? "").trim();
    const shippingAddress = String(row.shipping_address ?? "").trim();
    const itemsRaw = String(row.items ?? "").trim();
    const driverUsername = String(row.driver_username ?? "").trim() || null;

    if (!customerCode || !shippingAddress || !itemsRaw) {
      results.push({
        row: rowNum,
        customerCode: customerCode || "(missing)",
        status: "error",
        error: "customer_code, shipping_address, and items are all required.",
        customerCreated: false,
      });
      continue;
    }

    const items = parseItems(itemsRaw);
    if (items.length === 0) {
      results.push({
        row: rowNum,
        customerCode,
        status: "error",
        error: "Could not parse any items from the items column.",
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
      p_customer_code: customerCode,
      p_customer_name: customerName || customerCode,
      p_password_hash: passwordHash,
      p_shipping_address: shippingAddress,
      p_items: items,
      p_driver_username: driverUsername,
    });

    if (error) {
      results.push({
        row: rowNum,
        customerCode,
        status: "error",
        error: error.message,
        customerCreated: false,
      });
      continue;
    }

    existingCodes.add(customerCode);

    results.push({
      row: rowNum,
      orderNumber: data.order_number,
      customerCode,
      customerName: customerName || customerCode,
      driverAssigned: driverUsername,
      status: "created",
      customerCreated: data.is_new_customer,
      generatedPassword: data.is_new_customer ? plaintextPassword : undefined,
      warning: data.driver_warning ?? undefined,
    });
  }

  const summary = {
    created: results.filter((r) => r.status === "created").length,
    failed: results.filter((r) => r.status === "error").length,
    newCustomers: results.filter((r) => r.customerCreated).length,
  };

  return NextResponse.json({ summary, results });
}
