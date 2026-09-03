import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireDriver, unauthorized } from "../_auth";

export async function GET(request: NextRequest) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, shipping_address, status, delivery_lat, delivery_lng, estimated_delivery, updated_at, customers (name)"
    )
    .eq("assigned_driver_id", driver.id)
    .in("status", ["arrived_at_hub", "out_for_delivery"])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data ?? []).map((order) => {
    const { customers, ...rest } = order;
    const customer = customers as unknown as { name: string } | null;
    return { ...rest, customer_name: customer?.name ?? "" };
  });

  return NextResponse.json({
    driver: { id: driver.id, username: driver.username, displayName: driver.displayName },
    orders,
  });
}
