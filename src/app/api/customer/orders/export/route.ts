import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireCustomer } from "@/lib/require-customer";
import { createServiceClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

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

  type ExportRow = {
    order_number: string;
    status: OrderStatus;
    shipping_address: string;
    pincode: string | null;
    city: string | null;
    receiver_name: string | null;
    consignee_name: string | null;
    proof_photo_url: string | null;
    created_at: string;
    updated_at: string;
    drivers: { display_name: string } | null;
    order_items: { quantity: number }[];
    order_events: { status: OrderStatus; created_at: string }[];
  };

  const rows: ExportRow[] = [];
  let offset = 0;
  for (;;) {
    let query = supabase
      .from("orders")
      .select(
        "order_number, status, shipping_address, pincode, city, receiver_name, consignee_name, proof_photo_url, created_at, updated_at, drivers (display_name), order_items (quantity), order_events (status, created_at)"
      )
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

    rows.push(...((data ?? []) as unknown as ExportRow[]));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const sheetRows = rows.map((row) => {
    const deliveryEvent = row.order_events.find(
      (e) => e.status === "delivered" || e.status === "undelivered"
    );
    const quantity = row.order_items.reduce((sum, i) => sum + i.quantity, 0);

    return {
      "Order Number": row.order_number,
      "Shipping Address": row.shipping_address,
      Pincode: row.pincode ?? "",
      City: row.city ?? "",
      "Consignee (To)": row.consignee_name ?? "",
      "Receiver Name": row.receiver_name ?? "",
      "Delivery Time": deliveryEvent?.created_at ?? "",
      Quantity: quantity,
      "Image Link": row.proof_photo_url ?? "",
      Status: STATUS_LABELS[row.status] ?? row.status,
      Driver: row.drivers?.display_name ?? "Unassigned",
      "Created At": row.created_at,
      "Updated At": row.updated_at,
    };
  });

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
