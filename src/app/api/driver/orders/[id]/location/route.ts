import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireDriver, unauthorized } from "../../../_auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const { id } = await context.params;
  const { lat, lng, heading, speedKmh } = await request.json();

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng are required." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .eq("assigned_driver_id", driver.id)
    .single();

  if (findError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status !== "out_for_delivery") {
    return NextResponse.json(
      { error: "Order is not out for delivery." },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase.from("delivery_locations").insert({
    order_id: id,
    driver_name: driver.displayName,
    lat,
    lng,
    heading: typeof heading === "number" ? heading : null,
    speed_kmh: typeof speedKmh === "number" ? speedKmh : null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
