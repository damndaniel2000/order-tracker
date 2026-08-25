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
      "id, order_number, customer_name, customer_phone, shipping_address, status, total_cents, currency, delivery_lat, delivery_lng, estimated_delivery, updated_at"
    )
    .eq("assigned_driver_id", driver.id)
    .in("status", ["shipped", "out_for_delivery"])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    driver: { id: driver.id, email: driver.email, displayName: driver.displayName },
    orders: data ?? [],
  });
}
