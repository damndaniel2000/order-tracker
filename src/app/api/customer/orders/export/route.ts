import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireCustomer } from "@/lib/require-customer";
import { createServiceClient } from "@/lib/supabase/server";
import { buildManifestRow, MANIFEST_SELECT, type ManifestSource } from "@/lib/report-format";

const PAGE_SIZE = 1000;

function toEndOfDay(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T23:59:59.999Z`;
  }
  return dateStr;
}

export async function GET(request: NextRequest) {
  const customerId = await requireCustomer();
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim() || "";

  const supabase = createServiceClient();

  const rows: ManifestSource[] = [];
  let offset = 0;
  for (;;) {
    // No drivers join -- customers never see driver details.
    let query = supabase
      .from("orders")
      .select(MANIFEST_SELECT)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

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

  const sheetRows = rows.map((row, i) => buildManifestRow(row, i + 1, { includeDriver: false }));

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `my-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
