"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import type { CustomerOrder, OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_DRIVERS = "__all_drivers__";
const UNASSIGNED = "__unassigned__";

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
  const [driverFilter, setDriverFilter] = useState(ALL_DRIVERS);
  const [customerName, setCustomerName] = useState("");

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/orders");
      if (res.status === 401) {
        router.replace("/customer/login");
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
    router.replace("/customer/login");
  }

  const driverOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.driver_name).filter(Boolean))) as string[],
    [orders]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (tab !== "all" && !TAB_STATUSES[tab].includes(o.status)) return false;
        if (driverFilter === UNASSIGNED) return !o.driver_name;
        if (driverFilter !== ALL_DRIVERS && o.driver_name !== driverFilter) return false;
        return true;
      }),
    [orders, tab, driverFilter]
  );

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
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
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

            <Select value={driverFilter} onValueChange={(value) => setDriverFilter(value ?? ALL_DRIVERS)}>
              <SelectTrigger className="mb-3 w-full">
                <SelectValue placeholder="Filter by driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DRIVERS}>All drivers</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {driverOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Card className="p-2">
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
                {filteredOrders.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-zinc-500">
                    No orders match these filters.
                  </li>
                )}
                {filteredOrders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={`w-full rounded-lg px-3 py-3 text-left transition ${
                        selected?.id === o.id
                          ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:ring-indigo-800"
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
                      <dt className="text-zinc-500">Driver</dt>
                      <dd className="font-medium">{selected.driver_name ?? "Unassigned"}</dd>
                    </div>
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
                    {selected.receiver_name && (
                      <div>
                        <dt className="text-zinc-500">Receiver</dt>
                        <dd className="font-medium">{selected.receiver_name}</dd>
                      </div>
                    )}
                    {selected.delivery_remarks && (
                      <div className="sm:col-span-2">
                        <dt className="text-zinc-500">Delivery remarks</dt>
                        <dd>{selected.delivery_remarks}</dd>
                      </div>
                    )}
                    {selected.proof_photo_url && (
                      <div className="sm:col-span-2">
                        <dt className="mb-1 text-zinc-500">Proof of delivery</dt>
                        <dd>
                          <a
                            href={selected.proof_photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
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
