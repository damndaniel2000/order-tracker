import { NextRequest, NextResponse } from "next/server";
import { createDriverToken } from "@/lib/driver-session";
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
    // TEMPORARY DEV BYPASS: skips password check so any credentials log in as
    // the seeded test driver. Remove before shipping/deploying.
    const { data: driver, error } = await supabase
      .from("drivers")
      .select("id, email, password_hash, display_name, is_active")
      .eq("email", "driver@lamatic.test")
      .single();

    if (error || !driver || !driver.is_active) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = createDriverToken({
      id: driver.id,
      email: driver.email,
      displayName: driver.display_name,
    });

    return NextResponse.json({
      ok: true,
      token,
      driver: {
        id: driver.id,
        email: driver.email,
        displayName: driver.display_name,
      },
    });
  } catch (e) {
    console.error("driver login error:", e);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
