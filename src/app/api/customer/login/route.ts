import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, MAX_AGE, createCustomerToken } from "@/lib/customer-session";
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

const INVALID = NextResponse.json(
  { error: "Invalid customer code or password." },
  { status: 401 }
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
    const customerCode = String(body.customerCode ?? "").trim();
    const password = String(body.password ?? "");

    if (!customerCode || !password) {
      return NextResponse.json(
        { error: "Customer code and password are required." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, name, customer_code, password_hash")
      .eq("customer_code", customerCode)
      .single();

    if (error || !customer) {
      return INVALID;
    }

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) {
      return INVALID;
    }

    const token = createCustomerToken(customer.id);
    const response = NextResponse.json({
      ok: true,
      customer: { name: customer.name, customerCode: customer.customer_code },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
