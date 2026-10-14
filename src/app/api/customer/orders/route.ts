import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/require-customer";
import { createServiceClient } from "@/lib/supabase/server";

// Driver-app events name the driver ("Delivered by Akash.", "Akash started
// delivery."). Customers never see who the driver is, so those descriptions
// are dropped here -- the event title still says what happened.
const DRIVER_NAMED_DESCRIPTION = /^Delivered by .+\.$|^.+ started delivery\.$/;

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
      "*, customers (name, customer_code), order_events (*), order_items (*), delivery_locations (id, order_id, lat, lng, heading, speed_kmh, recorded_at)"
    )
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flattened = (orders ?? []).map((order) => {
    // assigned_driver_id is stripped too -- nothing about the driver leaves
    // this endpoint.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customers, assigned_driver_id, order_events, ...rest } = order;
    return {
      ...rest,
      assigned_driver_id: null,
      customer_name: customers?.name ?? "",
      customer_code: customers?.customer_code ?? "",
      order_events: (order_events ?? []).map((e: { description: string | null }) => ({
        ...e,
        description:
          e.description && DRIVER_NAMED_DESCRIPTION.test(e.description) ? null : e.description,
      })),
    };
  });

  return NextResponse.json({ orders: flattened });
}
