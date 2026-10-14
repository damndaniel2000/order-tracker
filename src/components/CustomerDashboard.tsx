"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDown, Loader2, LogOut, RefreshCw } from "lucide-react";
import type { CustomerOrder, OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { groupByDate } from "@/lib/report-format";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Tab = "all" | "pending" | "dispatch" | "delivered";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "dispatch", label: "Dispatch (Out for Delivery)" },
  { key: "delivered", label: "Delivered" },
];

const TAB_STATUSES: Record<Exclude<Tab, "all">, OrderStatus[]> = {
  pending: ["booked", "arrived_at_hub", "undelivered", "cancelled"],
  dispatch: ["out_for_delivery"],
  delivered: ["delivered"],
};

export function CustomerDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [customerName, setCustomerName] = useState("");

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/orders");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      const nextOrders = (data.orders ?? []) as CustomerOrder[];
      setOrders(nextOrders);
      setCustomerName(nextOrders[0]?.customer_name ?? "");
      setSelectedId((prev) => prev ?? nextOrders[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/customer/logout", { method: "POST" });
    router.replace("/login");
  }

  const filteredOrders = useMemo(
    () => orders.filter((o) => tab === "all" || TAB_STATUSES[tab].includes(o.status)),
    [orders, tab]
  );

  const dateGroups = useMemo(() => groupByDate(filteredOrders), [filteredOrders]);

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { all: orders.length, pending: 0, dispatch: 0, delivered: 0 };
    for (const o of orders) {
      for (const key of Object.keys(TAB_STATUSES) as Exclude<Tab, "all">[]) {
        if (TAB_STATUSES[key].includes(o.status)) counts[key]++;
      }
    }
    return counts;
  }, [orders]);

  const totalQuantity = (selected?.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My orders</h1>
          <p className="text-sm text-zinc-500">{customerName || "Order tracking"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" render={<Link href="/customer/reports" />}>
            <FileDown className="h-4 w-4" />
            Reports
          </Button>
          <Button type="button" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <aside className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    tab === t.key
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {t.label} <span className="text-xs text-zinc-400">({tabCounts[t.key]})</span>
                </button>
              ))}
            </div>

            <Card className="p-2">
              <ul className="max-h-[70vh] overflow-y-auto">
                {filteredOrders.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-zinc-500">
                    No orders match these filters.
                  </li>
                )}
                {dateGroups.map((group) => (
                  <li key={group.key}>
                    <h3 className="sticky top-0 z-10 bg-card px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {group.label}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-400">
                        · {group.items.length} order{group.items.length === 1 ? "" : "s"}
                      </span>
                    </h3>
                    <ul className="space-y-2">
                      {group.items.map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(o.id)}
                            className={`w-full rounded-lg px-3 py-3 text-left transition ${
                              selected?.id === o.id
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-medium">{o.order_number}</span>
                              <OrderStatusBadge status={o.status} />
                            </div>
                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {o.city ? `${o.city}${o.pincode ? ` - ${o.pincode}` : ""}` : o.shipping_address}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>

          {selected && (
            <main className="space-y-4 lg:col-span-3">
              <Card>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">{selected.order_number}</h2>
                    </div>
                    <OrderStatusBadge status={selected.status} />
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-zinc-500">Quantity</dt>
                      <dd className="font-medium">{totalQuantity}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-zinc-500">Address</dt>
                      <dd>
                        {selected.shipping_address}
                        {(selected.city || selected.pincode) && (
                          <span className="block text-zinc-500">
                            {[selected.city, selected.pincode].filter(Boolean).join(" - ")}
                          </span>
                        )}
                      </dd>
                    </div>
                    {selected.consignee_name && (
                      <div>
                        <dt className="text-zinc-500">Consignee (To)</dt>
                        <dd className="font-medium">{selected.consignee_name}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-zinc-500">Receiver name</dt>
                      <dd className="font-medium">{selected.receiver_name || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Received by</dt>
                      <dd className="font-medium">{selected.received_by || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-zinc-500">Delivery remarks</dt>
                      <dd>{selected.delivery_remarks || "—"}</dd>
                    </div>
                    {selected.proof_photo_url && (
                      <div className="sm:col-span-2">
                        <dt className="mb-1 text-zinc-500">Proof of delivery</dt>
                        <dd>
                          <a
                            href={selected.proof_photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            View photo →
                          </a>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-zinc-500">Updated</dt>
                      <dd>{formatDate(selected.updated_at)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="mb-4 text-lg font-semibold">Status history</h2>
                  <OrderTimeline events={selected.order_events ?? []} currentStatus={selected.status} />
                </CardContent>
              </Card>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
