import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, customer_code, name")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: customers ?? [] });
}
