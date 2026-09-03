import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireDriver, unauthorized } from "../../../_auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const { id } = await context.params;
  const supabase = createServiceClient();

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, status, assigned_driver_id")
    .eq("id", id)
    .eq("assigned_driver_id", driver.id)
    .single();

  if (findError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!["arrived_at_hub", "out_for_delivery"].includes(order.status)) {
    return NextResponse.json(
      { error: "Order cannot be started from current status." },
      { status: 400 }
    );
  }

  if (order.status !== "out_for_delivery") {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "out_for_delivery" })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from("order_events").insert({
      order_id: id,
      status: "out_for_delivery",
      title: "Out for delivery",
      description: `${driver.displayName} started delivery.`,
      location_label: "Driver app",
    });
  }

  const { data: updated } = await supabase
    .from("orders")
    .select(`*, customers (name, customer_code), order_items (*)`)
    .eq("id", id)
    .single();

  if (!updated) {
    return NextResponse.json({ error: "Order not found after update." }, { status: 500 });
  }

  const { customers, ...rest } = updated;
  return NextResponse.json({
    ...rest,
    customer_name: customers?.name ?? "",
    customer_code: customers?.customer_code ?? "",
  });
}
