import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const NOT_FOUND = NextResponse.json(
  { error: "No order found. Check your order number and email." },
  { status: 404 }
);

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const orderNumber = String(body.orderNumber ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: "Order number and email are required." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_events (*),
        order_items (*),
        delivery_locations (*)
      `
      )
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) {
      return NOT_FOUND;
    }

    if (String(order.guest_email ?? "").trim().toLowerCase() !== email) {
      return NOT_FOUND;
    }

    const events = (order.order_events ?? []).sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const locations = (order.delivery_locations ?? []).sort(
      (a: { recorded_at: string }, b: { recorded_at: string }) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

    return NextResponse.json({
      ...order,
      order_events: events,
      delivery_locations: locations,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to look up order. Check Supabase configuration." },
      { status: 500 }
    );
  }
}
