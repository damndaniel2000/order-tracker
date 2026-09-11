import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/require-customer";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const customerId = await requireCustomer();
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Scoped strictly to this customer_id -- taken from the verified session,
  // never from a client-supplied parameter, so one customer can never see
  // another's orders by tampering with the request.
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "*, customers (name, customer_code), drivers (display_name), order_events (*), order_items (*), delivery_locations (*)"
    )
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flattened = (orders ?? []).map((order) => {
    const { customers, drivers, ...rest } = order;
    return {
      ...rest,
      customer_name: customers?.name ?? "",
      customer_code: customers?.customer_code ?? "",
      driver_name: drivers?.display_name ?? null,
    };
  });

  return NextResponse.json({ orders: flattened });
}
