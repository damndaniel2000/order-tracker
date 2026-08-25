import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireDriver, unauthorized } from "../../_auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const { id } = await context.params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(`*, order_items (*), order_events (*)`)
    .eq("id", id)
    .eq("assigned_driver_id", driver.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const events = (order.order_events ?? []).sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return NextResponse.json({ ...order, order_events: events });
}
