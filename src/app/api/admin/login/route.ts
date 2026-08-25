import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  COOKIE_NAME,
  MAX_AGE,
  createAdminToken,
} from "@/lib/admin-session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const pwd = String(password ?? "");

    if (!normalizedEmail || !pwd) {
      return NextResponse.json(
        { error: "Email and password required." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, email, password_hash, display_name")
      .eq("email", normalizedEmail)
      .single();

    if (error || !admin) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const valid = await bcrypt.compare(pwd, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = createAdminToken(admin.email);
    const response = NextResponse.json({
      ok: true,
      admin: { email: admin.email, displayName: admin.display_name },
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
