import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

const PAGE_SIZE = 1000;

function toEndOfDay(dateStr: string): string {
  // A date-only string (YYYY-MM-DD) would otherwise exclude same-day rows
  // after midnight when used with .lte() -- bump it to end of day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T23:59:59.999Z`;
  }
  return dateStr;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createServiceClient();

  type ExportRow = {
    order_number: string;
    status: OrderStatus;
    shipping_address: string;
    created_at: string;
    updated_at: string;
    customers: { customer_code: string; name: string } | null;
    drivers: { display_name: string } | null;
    order_items: { name: string; quantity: number }[];
  };

  const rows: ExportRow[] = [];
  let offset = 0;
  for (;;) {
    let query = supabase
      .from("orders")
      .select(
        "order_number, status, shipping_address, created_at, updated_at, customers (customer_code, name), drivers (display_name), order_items (name, quantity)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (customerId) query = query.eq("customer_id", customerId);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", toEndOfDay(to));

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    rows.push(...((data ?? []) as unknown as ExportRow[]));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const sheetRows = rows.map((row) => ({
    "Order Number": row.order_number,
    "Customer Code": row.customers?.customer_code ?? "",
    "Customer Name": row.customers?.name ?? "",
    "Shipping Address": row.shipping_address,
    Status: STATUS_LABELS[row.status] ?? row.status,
    Driver: row.drivers?.display_name ?? "Unassigned",
    Items: row.order_items.map((i) => `${i.name} x${i.quantity}`).join(", "),
    "Created At": row.created_at,
    "Updated At": row.updated_at,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
