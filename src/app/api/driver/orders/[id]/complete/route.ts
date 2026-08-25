import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireDriver, unauthorized } from "../../../_auth";
import type { OrderStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const outcome = body.outcome as "delivered" | "failed" | undefined;
  const remarks = body.remarks ? String(body.remarks).trim() : null;
  const photoUrl = body.photoUrl ? String(body.photoUrl).trim() : null;

  if (outcome !== "delivered" && outcome !== "failed") {
    return NextResponse.json(
      { error: "outcome must be delivered or failed." },
      { status: 400 }
    );
  }

  if (outcome === "failed" && !remarks) {
    return NextResponse.json(
      { error: "Remarks are required when delivery fails." },
      { status: 400 }
    );
  }

  if (outcome === "delivered" && !photoUrl) {
    return NextResponse.json(
      { error: "Proof photo is required for successful delivery." },
      { status: 400 }
    );
  }

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

  if (!["shipped", "out_for_delivery"].includes(order.status)) {
    return NextResponse.json(
      { error: "Order is not active for delivery." },
      { status: 400 }
    );
  }

  const status: OrderStatus = outcome === "delivered" ? "delivered" : "failed";
  const title =
    outcome === "delivered" ? "Delivered" : "Delivery failed";
  const description =
    outcome === "delivered"
      ? `Delivered by ${driver.displayName}.`
      : remarks;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status,
      delivery_remarks: remarks,
      proof_photo_url: photoUrl,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("order_events").insert({
    order_id: id,
    status,
    title,
    description,
    location_label: "Driver app",
  });

  await supabase.from("delivery_attempts").insert({
    order_id: id,
    driver_id: driver.id,
    outcome,
    remarks,
    photo_url: photoUrl,
  });

  const { data: updated } = await supabase
    .from("orders")
    .select(`*, order_items (*)`)
    .eq("id", id)
    .single();

  return NextResponse.json(updated);
}
