import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  COOKIE_NAME as ADMIN_COOKIE,
  MAX_AGE as ADMIN_MAX_AGE,
  createAdminToken,
} from "@/lib/admin-session";
import {
  COOKIE_NAME as CUSTOMER_COOKIE,
  MAX_AGE as CUSTOMER_MAX_AGE,
  createCustomerToken,
} from "@/lib/customer-session";
import { createServiceClient } from "@/lib/supabase/server";

// One login form for both admin and customer accounts -- try the entered
// identifier as an admin email first, then as a customer code, and route
// based on whichever actually matches. Driver login stays separate (mobile
// app only, not part of this web login).
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

const INVALID = NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

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
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Both fields are required." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: admin } = await supabase
      .from("admins")
      .select("id, email, password_hash, display_name")
      .eq("email", identifier.toLowerCase())
      .single();

    if (admin && (await bcrypt.compare(password, admin.password_hash))) {
      const token = createAdminToken(admin.email);
      const response = NextResponse.json({ ok: true, role: "admin" });
      response.cookies.set(ADMIN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ADMIN_MAX_AGE,
        path: "/",
      });
      return response;
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, customer_code, password_hash")
      .eq("customer_code", identifier)
      .single();

    if (customer && (await bcrypt.compare(password, customer.password_hash))) {
      const token = createCustomerToken(customer.id);
      const response = NextResponse.json({ ok: true, role: "customer" });
      response.cookies.set(CUSTOMER_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CUSTOMER_MAX_AGE,
        path: "/",
      });
      return response;
    }

    return INVALID;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
