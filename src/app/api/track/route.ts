import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
  { error: "No order found. Check your order number and password." },
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
    const password = String(body.password ?? "");

    if (!orderNumber || !password) {
      return NextResponse.json(
        { error: "Order number and password are required." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customers (id, name, customer_code),
        order_events (*),
        order_items (*),
        delivery_locations (*)
      `
      )
      .eq("order_number", orderNumber)
      .single();

    if (error || !order || !order.customers) {
      return NOT_FOUND;
    }

    const { data: customerAuth } = await supabase
      .from("customers")
      .select("password_hash")
      .eq("id", order.customers.id)
      .single();

    if (!customerAuth) {
      return NOT_FOUND;
    }

    const valid = await bcrypt.compare(password, customerAuth.password_hash);
    if (!valid) {
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

    const { customers, ...orderFields } = order;

    return NextResponse.json({
      ...orderFields,
      customer_name: customers.name,
      customer_code: customers.customer_code,
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
