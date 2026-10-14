import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { buildManifestRow, MANIFEST_SELECT, type ManifestSource } from "@/lib/report-format";

const PAGE_SIZE = 1000;
// Keeps each `.in("id", ...)` query string comfortably under URL limits.
const ID_CHUNK = 200;

function toEndOfDay(dateStr: string): string {
  // A date-only string (YYYY-MM-DD) would otherwise exclude same-day rows
  // after midnight when used with .lte() -- bump it to end of day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T23:59:59.999Z`;
  }
  return dateStr;
}

const SELECT = `${MANIFEST_SELECT}, drivers (display_name, phone)`;

function toXlsxResponse(rows: ManifestSource[]) {
  const sheetRows = rows.map((row, i) => buildManifestRow(row, i + 1, { includeDriver: true }));
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

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim() || "";

  const supabase = createServiceClient();

  const rows: ManifestSource[] = [];
  let offset = 0;
  for (;;) {
    let query = supabase
      .from("orders")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (customerId) query = query.eq("customer_id", customerId);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", toEndOfDay(to));
    if (search) {
      const term = search.replace(/[%,]/g, "");
      query = query.or(
        [
          `order_number.ilike.%${term}%`,
          `shipping_address.ilike.%${term}%`,
          `receiver_name.ilike.%${term}%`,
          `consignee_name.ilike.%${term}%`,
          `city.ilike.%${term}%`,
          `pincode.ilike.%${term}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    rows.push(...((data ?? []) as unknown as ManifestSource[]));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return toXlsxResponse(rows);
}

// Export of a hand-picked set of orders (the dashboard's "Export selected").
// POST so hundreds of ids travel in the body instead of the URL.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No orders selected." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const rows: (ManifestSource & { created_at: string })[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("orders")
      .select(SELECT)
      .in("id", ids.slice(i, i + ID_CHUNK));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows.push(...((data ?? []) as unknown as (ManifestSource & { created_at: string })[]));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return toXlsxResponse(rows);
}
