import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/require-customer";
import { createServiceClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

// Same sortable-column caveat as the admin report: only genuine columns on
// `orders` itself are sortable (see admin/orders/report/route.ts).
const SORTABLE_COLUMNS: Record<string, { column: string }> = {
  order_number: { column: "order_number" },
  status: { column: "status" },
  city: { column: "city" },
  pincode: { column: "pincode" },
  created_at: { column: "created_at" },
  updated_at: { column: "updated_at" },
};

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
  const sortKey = searchParams.get("sortBy") ?? "created_at";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25));

  const sort = SORTABLE_COLUMNS[sortKey] ?? SORTABLE_COLUMNS.created_at;

  const supabase = createServiceClient();

  // customer_id always comes from the verified session, never a query
  // param -- this is what keeps one customer from ever pulling another's
  // report data.
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, shipping_address, pincode, city, receiver_name, consignee_name, pickup_at, proof_photo_url, created_at, updated_at, drivers (display_name), order_items (quantity), order_events (status, created_at)",
      { count: "exact" }
    )
    .eq("customer_id", customerId);

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

  query = query
    .order(sort.column, { ascending: sortDir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    order_number: string;
    status: OrderStatus;
    shipping_address: string;
    pincode: string | null;
    city: string | null;
    receiver_name: string | null;
    consignee_name: string | null;
    pickup_at: string | null;
    proof_photo_url: string | null;
    created_at: string;
    updated_at: string;
    drivers: { display_name: string } | null;
    order_items: { quantity: number }[];
    order_events: { status: OrderStatus; created_at: string }[];
  };

  const rows = ((data ?? []) as unknown as Row[]).map((row) => {
    const deliveryEvent = row.order_events.find(
      (e) => e.status === "delivered" || e.status === "undelivered"
    );
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] ?? row.status,
      driverName: row.drivers?.display_name ?? null,
      city: row.city,
      pincode: row.pincode,
      receiverName: row.receiver_name,
      consigneeName: row.consignee_name,
      quantity: row.order_items.reduce((sum, i) => sum + i.quantity, 0),
      deliveryTime: deliveryEvent?.created_at ?? null,
      imageUrl: row.proof_photo_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({ rows, total: count ?? 0, page, pageSize });
}
