import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-session";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const email = token ? verifyAdminToken(token) : null;
  return email;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!email || !password || !displayName) {
    return NextResponse.json(
      { error: "Email, password, and display name are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = createServiceClient();

  const { data: driver, error } = await supabase
    .from("drivers")
    .insert({
      email,
      password_hash: passwordHash,
      display_name: displayName,
      phone,
    })
    .select("id, email, display_name, phone, is_active")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const message =
      error.code === "23505"
        ? "A driver with this email already exists."
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ driver });
}
