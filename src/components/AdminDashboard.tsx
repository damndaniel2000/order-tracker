"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, RefreshCw, Trash2, Truck, Users, Upload, FileDown } from "lucide-react";
import type { AdminOrder, Driver, OrderStatus } from "@/lib/types";
import { NEXT_STATUSES, STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { AddOrderDialog } from "./AddOrderDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "__unassigned__";
const ALL_CUSTOMERS = "__all_customers__";
const ALL_DRIVERS = "__all_drivers__";

type Tab = "all" | "pending" | "dispatch" | "delivered";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "dispatch", label: "Dispatch (Out for Delivery)" },
  { key: "delivered", label: "Delivered" },
];

// Every order falls into exactly one of these three buckets, so nothing is
// ever hidden by picking a tab -- "Pending" covers anything not currently
// out for delivery and not successfully delivered (including undelivered/
// cancelled, since those still need a human to look at them).
const TAB_STATUSES: Record<Exclude<Tab, "all">, OrderStatus[]> = {
  pending: ["booked", "arrived_at_hub", "undelivered", "cancelled"],
  dispatch: ["out_for_delivery"],
  delivered: ["delivered"],
};

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customerFilter, setCustomerFilter] = useState(ALL_CUSTOMERS);
  const [driverFilter, setDriverFilter] = useState(ALL_DRIVERS);
  const [tab, setTab] = useState<Tab>("all");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      const nextOrders = (data.orders ?? data) as AdminOrder[];
      setOrders(nextOrders);
      setDrivers((data.drivers ?? []) as Driver[]);
      setSelectedId((prev) => prev ?? nextOrders[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchOrder(body: Record<string, unknown>) {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selected.id, ...body }),
      });
      if (res.ok) await load();
    } finally {
      setUpdating(false);
    }
  }

  async function updateStatus(status: keyof typeof STATUS_LABELS) {
    await patchOrder({ status, title: STATUS_LABELS[status] });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
  }

  const shortcuts = useMemo(
    () => [
      { keys: "?", description: "Keyboard shortcuts", action: () => setHelpOpen((o) => !o) },
      { keys: "r", description: "Refresh orders", action: () => load() },
      { keys: "l", description: "Logout", action: () => logout() },
    ],
    [load]
  );

  useKeyboardShortcuts(
    shortcuts.map((s) => ({
      keys: s.keys,
      description: s.description,
      action: s.action,
      global: s.keys === "?",
    }))
  );

  const nextOptions = selected ? NEXT_STATUSES[selected.status] : [];
  const assignedDriver = drivers.find((d) => d.id === selected?.assigned_driver_id);

  const customerOptions = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.customer_code).filter(Boolean))).sort(),
    [orders]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (tab !== "all" && !TAB_STATUSES[tab].includes(o.status)) return false;
        if (customerFilter !== ALL_CUSTOMERS && o.customer_code !== customerFilter) {
          return false;
        }
        if (driverFilter === UNASSIGNED) return !o.assigned_driver_id;
        if (driverFilter !== ALL_DRIVERS && o.assigned_driver_id !== driverFilter) {
          return false;
        }
        return true;
      }),
    [orders, tab, customerFilter, driverFilter]
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

  async function deleteOrder() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/orders?orderId=${selected.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete order.");
      setSelectedId(null);
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete order.");
    } finally {
      setDeleting(false);
    }
  }

  const totalQuantity = (selected?.order_items ?? []).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <KeyboardShortcutsHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts.map(({ keys, description }) => ({ keys, description }))}
      />

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-zinc-500">Manage orders, drivers, and delivery GPS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddOrderDialog drivers={drivers} onCreated={load} />
          <Button type="button" variant="outline" render={<Link href="/admin/drivers" />}>
            <Users className="h-4 w-4" />
            Drivers
          </Button>
          <Button type="button" variant="outline" render={<Link href="/admin/upload" />}>
            <Upload className="h-4 w-4" />
            Upload orders
          </Button>
          <Button type="button" variant="outline" render={<Link href="/admin/reports" />}>
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
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <Select
                value={customerFilter}
                onValueChange={(value) => setCustomerFilter(value ?? ALL_CUSTOMERS)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CUSTOMERS}>All customers</SelectItem>
                  {customerOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={driverFilter}
                onValueChange={(value) => setDriverFilter(value ?? ALL_DRIVERS)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DRIVERS}>All drivers</SelectItem>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                      <p className="mt-1 truncate text-xs text-zinc-500">{o.customer_name}</p>
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
                    <p className="text-sm text-zinc-500">{selected.customer_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={selected.status} />
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button type="button" variant="ghost" size="icon-sm" className="text-red-600 dark:text-red-400" />
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Delete this order?</DialogTitle>
                          <DialogDescription>
                            <span className="font-mono">{selected.order_number}</span> and all of
                            its history (status timeline, GPS pings, proof of delivery) will be
                            permanently removed. This cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        {deleteError && (
                          <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
                        )}
                        <DialogFooter showCloseButton>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                            disabled={deleting}
                            onClick={deleteOrder}
                          >
                            {deleting ? "Deleting…" : "Delete order"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Customer</dt>
                    <dd className="font-medium">{selected.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Assigned driver</dt>
                    <dd className="font-medium">{assignedDriver?.display_name ?? "Unassigned"}</dd>
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
                  <div>
                    <dt className="text-zinc-500">Quantity</dt>
                    <dd className="font-medium">{totalQuantity}</dd>
                  </div>
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
                  <OrderTimeline
                    events={selected.order_events ?? []}
                    currentStatus={selected.status}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assign driver</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selected.assigned_driver_id ?? UNASSIGNED}
                    disabled={updating}
                    onValueChange={(value) =>
                      patchOrder({
                        assignedDriverId: value === UNASSIGNED ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.display_name} ({d.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Update status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="flex flex-wrap gap-2">
                  {nextOptions.length === 0 && (
                    <p className="text-sm text-zinc-500">No further status changes available.</p>
                  )}
                  {nextOptions.map((s, i) => (
                    <Button
                      key={s}
                      type="button"
                      variant={i === 0 ? "default" : "outline"}
                      disabled={updating}
                      onClick={() => updateStatus(s)}
                    >
                      Mark {STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>
                </CardContent>
              </Card>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
