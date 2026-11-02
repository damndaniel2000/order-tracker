"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Loader2, LogOut, RefreshCw, Trash2, Truck, Users, Upload, FileDown } from "lucide-react";
import type { AdminOrder, Driver, OrderStatus } from "@/lib/types";
import { NEXT_STATUSES, STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { dateKeyIST, groupByDate } from "@/lib/report-format";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { AddOrderDialog } from "./AddOrderDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [dateFilter, setDateFilter] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Multi-select (checkboxes) is separate from selectedId, which is just the
  // order whose details are open on the right.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

  // The date picker filters by the same day the list is grouped under
  // (pickup date, falling back to created date). Tab counts follow it too, so
  // picking a day shows that day's Pending / Dispatch / Delivered numbers.
  const datedOrders = useMemo(
    () =>
      dateFilter
        ? orders.filter((o) => dateKeyIST(o.pickup_at ?? o.created_at) === dateFilter)
        : orders,
    [orders, dateFilter]
  );

  const customerItems = useMemo(
    () => ({
      [ALL_CUSTOMERS]: "All customers",
      ...Object.fromEntries(customerOptions.map((c) => [c, c])),
    }),
    [customerOptions]
  );
  const driverFilterItems = useMemo(
    () => ({
      [ALL_DRIVERS]: "All drivers",
      [UNASSIGNED]: "Unassigned",
      ...Object.fromEntries(drivers.map((d) => [d.id, d.display_name])),
    }),
    [drivers]
  );
  const assignDriverItems = useMemo(
    () => ({
      [UNASSIGNED]: "Unassigned",
      ...Object.fromEntries(drivers.map((d) => [d.id, `${d.display_name} (${d.username})`])),
    }),
    [drivers]
  );

  const filteredOrders = useMemo(
    () =>
      datedOrders.filter((o) => {
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
    [datedOrders, tab, customerFilter, driverFilter]
  );

  const dateGroups = useMemo(() => groupByDate(filteredOrders), [filteredOrders]);

  // Selection only ever covers what's on screen -- changing the tab or a
  // filter starts over, so a bulk action can't hit orders the admin can't see.
  function changeTab(next: Tab) {
    setTab(next);
    setCheckedIds(new Set());
  }
  function changeCustomerFilter(next: string) {
    setCustomerFilter(next);
    setCheckedIds(new Set());
  }
  function changeDriverFilter(next: string) {
    setDriverFilter(next);
    setCheckedIds(new Set());
  }
  function changeDateFilter(next: string) {
    setDateFilter(next);
    setCheckedIds(new Set());
  }

  const checkedOrderIds = filteredOrders.filter((o) => checkedIds.has(o.id)).map((o) => o.id);
  const checkedCount = checkedOrderIds.length;
  const allChecked = filteredOrders.length > 0 && checkedCount === filteredOrders.length;
  const someChecked = checkedCount > 0 && !allChecked;

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(filteredOrders.map((o) => o.id)));
  }

  async function runBulk(body: Record<string, unknown>) {
    if (checkedCount === 0) return false;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, orderIds: checkedOrderIds }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed.");
      setCheckedIds(new Set());
      await load();
      return true;
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk action failed.");
      return false;
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (selected && checkedIds.has(selected.id)) setSelectedId(null);
    if (await runBulk({ action: "delete" })) setBulkDeleteOpen(false);
  }

  async function exportChecked() {
    if (checkedCount === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/orders/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: checkedOrderIds }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed.");
      }
      const blob = await res.blob();
      const match = /filename="?([^"]+)"?/.exec(res.headers.get("Content-Disposition") ?? "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] ?? "orders-export.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { all: datedOrders.length, pending: 0, dispatch: 0, delivered: 0 };
    for (const o of datedOrders) {
      for (const key of Object.keys(TAB_STATUSES) as Exclude<Tab, "all">[]) {
        if (TAB_STATUSES[key].includes(o.status)) counts[key]++;
      }
    }
    return counts;
  }, [datedOrders]);

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
                  onClick={() => changeTab(t.key)}
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
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="date"
                  aria-label="Filter by pickup date"
                  value={dateFilter}
                  onChange={(e) => changeDateFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
              {dateFilter ? (
                <Button type="button" variant="outline" size="sm" onClick={() => changeDateFilter("")}>
                  All dates
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => changeDateFilter(dateKeyIST(new Date().toISOString()))}
                >
                  Today
                </Button>
              )}
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <Select
                value={customerFilter}
                items={customerItems}
                onValueChange={(value) => changeCustomerFilter(value ?? ALL_CUSTOMERS)}
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
                items={driverFilterItems}
                onValueChange={(value) => changeDriverFilter(value ?? ALL_DRIVERS)}
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
              <div className="flex flex-wrap items-center gap-2 border-b px-3 pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    disabled={filteredOrders.length === 0}
                    onChange={toggleAll}
                  />
                  {checkedCount > 0 ? `${checkedCount} selected` : "Select all"}
                </label>
                {checkedCount > 0 && (
                  <button
                    type="button"
                    className="ml-auto text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    onClick={() => setCheckedIds(new Set())}
                  >
                    Clear
                  </button>
                )}
              </div>
              {checkedCount > 0 && (
                <div className="space-y-2 border-b px-3 py-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={null}
                      disabled={bulkBusy}
                      onValueChange={(value) => {
                        if (value) {
                          runBulk({
                            action: "assign",
                            assignedDriverId: value === UNASSIGNED ? null : value,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign driver…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassign</SelectItem>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={null}
                      disabled={bulkBusy}
                      onValueChange={(value) => {
                        if (value) runBulk({ action: "status", status: value });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Change status…" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={bulkBusy}
                      onClick={exportChecked}
                    >
                      <FileDown className="h-4 w-4" />
                      Export selected
                    </Button>
                    <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                      <DialogTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={bulkBusy}
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                          />
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete selected
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>
                            Delete {checkedCount} order{checkedCount === 1 ? "" : "s"}?
                          </DialogTitle>
                          <DialogDescription>
                            The selected orders and all of their history (status timeline, GPS
                            pings, proof of delivery) will be permanently removed. This cannot be
                            undone.
                          </DialogDescription>
                        </DialogHeader>
                        {bulkError && (
                          <p className="text-sm text-red-600 dark:text-red-400">{bulkError}</p>
                        )}
                        <DialogFooter showCloseButton>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                            disabled={bulkBusy}
                            onClick={bulkDelete}
                          >
                            {bulkBusy ? "Deleting…" : `Delete ${checkedCount}`}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  {bulkError && !bulkDeleteOpen && (
                    <p className="text-sm text-red-600 dark:text-red-400">{bulkError}</p>
                  )}
                </div>
              )}
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
                        <li
                          key={o.id}
                          className={`flex items-start gap-2 rounded-lg pl-3 transition ${
                            selected?.id === o.id
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${o.order_number}`}
                            className="mt-3.5 h-4 w-4 shrink-0 accent-primary"
                            checked={checkedIds.has(o.id)}
                            onChange={() => toggleChecked(o.id)}
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedId(o.id)}
                            className="min-w-0 flex-1 py-3 pr-3 text-left"
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
                  <div>
                    <dt className="text-zinc-500">Quantity</dt>
                    <dd className="font-medium">{totalQuantity}</dd>
                  </div>
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
                    items={assignDriverItems}
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
