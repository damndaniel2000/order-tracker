import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!username || !password || !displayName) {
    return NextResponse.json(
      { error: "Username, password, and display name are required." },
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
      username,
      email,
      password_hash: passwordHash,
      display_name: displayName,
      phone,
    })
    .select("id, username, email, display_name, phone, is_active")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const isUsernameConflict = error.message.includes("username");
    const message =
      error.code === "23505"
        ? isUsernameConflict
          ? "A driver with this username already exists."
          : "A driver with this email already exists."
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ driver });
}
