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
  const receiverName = body.receiverName ? String(body.receiverName).trim() : null;
  const deliveryTime = body.deliveryTime ? String(body.deliveryTime).trim() : null;

  // The driver can correct the delivery time by hand ("HH:mm", Indian time,
  // today). It becomes the delivered/failed event's timestamp, which is what
  // the report's DATE/TIME columns read. delivery_attempts.created_at still
  // records when the driver actually submitted.
  let eventAt: string | undefined;
  if (deliveryTime) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(deliveryTime);
    const hours = match ? parseInt(match[1], 10) : NaN;
    const minutes = match ? parseInt(match[2], 10) : NaN;
    if (!match || hours > 23 || minutes > 59) {
      return NextResponse.json(
        { error: "Delivery time must be in HH:MM (24-hour) format." },
        { status: 400 }
      );
    }
    const IST_OFFSET_MS = 330 * 60 * 1000;
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const at = new Date(
      Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), hours, minutes) -
        IST_OFFSET_MS
    );
    // A couple of minutes' slack for clock drift between phone and server.
    if (at.getTime() > Date.now() + 2 * 60 * 1000) {
      return NextResponse.json(
        { error: "Delivery time can't be later than now." },
        { status: 400 }
      );
    }
    eventAt = at.toISOString();
  }

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

  if (!["arrived_at_hub", "out_for_delivery"].includes(order.status)) {
    return NextResponse.json(
      { error: "Order is not active for delivery." },
      { status: 400 }
    );
  }

  // delivery_attempts keeps the driver-facing 'delivered'/'failed' outcome
  // vocabulary; the customer-facing order status uses 'undelivered' instead
  // of 'failed' -- these are deliberately different vocabularies.
  const status: OrderStatus = outcome === "delivered" ? "delivered" : "undelivered";
  const title =
    outcome === "delivered" ? "Delivered" : "Delivery failed";
  const description =
    outcome === "delivered"
      ? `Delivered by ${driver.displayName}.`
      : remarks;

  // The name typed at drop-off goes to received_by, never receiver_name --
  // receiver_name is the sheet's value and stays untouched so the report can
  // show both side by side.
  const updates: Record<string, unknown> = {
    status,
    delivery_remarks: remarks,
    proof_photo_url: photoUrl,
    received_by: receiverName,
  };

  const { error: updateError } = await supabase
    .from("orders")
    .update(updates)
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
    ...(eventAt ? { created_at: eventAt } : {}),
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
