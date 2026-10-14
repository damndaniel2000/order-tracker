import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

// Keeps each `.in("id", ...)` query string comfortably under URL limits.
const ID_CHUNK = 200;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
  return out;
}

// Dashboard multi-select actions. Same effects as the single-order PATCH /
// DELETE on ../route.ts, applied to many orders at once.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as "assign" | "status" | "delete" | undefined;
  const orderIds: string[] = Array.isArray(body.orderIds)
    ? body.orderIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "No orders selected." }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (action === "assign") {
    const assignedDriverId = (body.assignedDriverId as string | null | undefined) || null;
    let updated = 0;
    for (const ids of chunks(orderIds)) {
      const { data, error } = await supabase
        .from("orders")
        .update({ assigned_driver_id: assignedDriverId })
        .in("id", ids)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      updated += data?.length ?? 0;
    }
    return NextResponse.json({ updated });
  }

  if (action === "status") {
    const status = body.status as OrderStatus | undefined;
    if (!status || !(status in STATUS_LABELS)) {
      return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
    }
    let updated = 0;
    for (const ids of chunks(orderIds)) {
      // Orders already at this status are left alone so they don't pick up a
      // duplicate timeline event.
      const { data, error } = await supabase
        .from("orders")
        .update({ status })
        .in("id", ids)
        .neq("status", status)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const changed = data ?? [];
      updated += changed.length;
      if (changed.length > 0) {
        const { error: eventError } = await supabase.from("order_events").insert(
          changed.map((o) => ({
            order_id: o.id,
            status,
            title: STATUS_LABELS[status],
            description: null,
            location_label: null,
          }))
        );
        if (eventError) {
          return NextResponse.json({ error: eventError.message }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ updated });
  }

  if (action === "delete") {
    let deleted = 0;
    for (const ids of chunks(orderIds)) {
      const { data, error } = await supabase.from("orders").delete().in("id", ids).select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted += data?.length ?? 0;
    }
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
