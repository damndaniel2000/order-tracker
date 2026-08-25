"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, RefreshCw, Truck, UserPlus } from "lucide-react";
import type { Driver, Order, OrderStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [driverLat, setDriverLat] = useState("");
  const [driverLng, setDriverLng] = useState("");
  const [newDriver, setNewDriver] = useState({
    email: "",
    password: "",
    displayName: "",
    phone: "",
  });
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [driverSuccess, setDriverSuccess] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      const nextOrders = (data.orders ?? data) as Order[];
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

  async function updateStatus(status: OrderStatus) {
    const body: Record<string, unknown> = {
      status,
      title: STATUS_LABELS[status],
    };
    if (driverLat && driverLng) {
      body.driverLat = parseFloat(driverLat);
      body.driverLng = parseFloat(driverLng);
      body.driverName = "Demo Driver";
    }
    await patchOrder(body);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  async function createDriver(e: FormEvent) {
    e.preventDefault();
    setCreatingDriver(true);
    setDriverError(null);
    setDriverSuccess(null);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create driver");
      setDriverSuccess(`Added ${data.driver.display_name}`);
      setNewDriver({ email: "", password: "", displayName: "", phone: "" });
      await load();
    } catch (e) {
      setDriverError(e instanceof Error ? e.message : "Could not create driver");
    } finally {
      setCreatingDriver(false);
    }
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

  const nextStatus = selected
    ? STATUS_ORDER[STATUS_ORDER.indexOf(selected.status) + 1]
    : null;

  const assignedDriver = drivers.find((d) => d.id === selected?.assigned_driver_id);

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <aside className="lg:col-span-2">
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              {orders.map((o) => (
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

            <form
              onSubmit={createDriver}
              className="mt-4 space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <h3 className="mb-1 flex items-center gap-2 font-medium">
                <UserPlus className="h-4 w-4" />
                Add driver
              </h3>
              <input
                type="email"
                required
                placeholder="Email"
                value={newDriver.email}
                onChange={(e) =>
                  setNewDriver((d) => ({ ...d, email: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <input
                type="text"
                required
                placeholder="Display name"
                value={newDriver.displayName}
                onChange={(e) =>
                  setNewDriver((d) => ({ ...d, displayName: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="Phone (optional)"
                value={newDriver.phone}
                onChange={(e) =>
                  setNewDriver((d) => ({ ...d, phone: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8 characters)"
                value={newDriver.password}
                onChange={(e) =>
                  setNewDriver((d) => ({ ...d, password: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              {driverError && (
                <p className="text-xs text-red-600 dark:text-red-400">{driverError}</p>
              )}
              {driverSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {driverSuccess}
                </p>
              )}
              <button
                type="submit"
                disabled={creatingDriver}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creatingDriver ? "Adding…" : "Add driver"}
              </button>
            </form>
          </aside>

          {selected && (
            <main className="space-y-4 lg:col-span-3">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.order_number}</h2>
                    <p className="text-sm text-zinc-500">{selected.guest_email}</p>
                  </div>
                  <OrderStatusBadge status={selected.status} />
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Customer</dt>
                    <dd className="font-medium">{selected.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Phone</dt>
                    <dd className="font-medium">{selected.customer_phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Total</dt>
                    <dd className="font-medium">
                      {formatCurrency(selected.total_cents, selected.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Assigned driver</dt>
                    <dd className="font-medium">{assignedDriver?.display_name ?? "Unassigned"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">Address</dt>
                    <dd>{selected.shipping_address}</dd>
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.proof_photo_url}
                          alt="Proof of delivery"
                          className="max-h-48 rounded-lg border border-zinc-200 object-cover"
                        />
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-zinc-500">Updated</dt>
                    <dd>{formatDate(selected.updated_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="mb-3 font-medium">Assign driver</h3>
                <select
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  value={selected.assigned_driver_id ?? ""}
                  disabled={updating}
                  onChange={(e) =>
                    patchOrder({ assignedDriverId: e.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.display_name} ({d.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="mb-3 flex items-center gap-2 font-medium">
                  <Truck className="h-4 w-4" />
                  Update status and driver GPS
                </h3>
                <p className="mb-3 text-sm text-zinc-500">
                  Saves to Supabase. Customers see updates in real time on the map.
                </p>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Driver latitude"
                    value={driverLat}
                    onChange={(e) => setDriverLat(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Driver longitude"
                    value={driverLng}
                    onChange={(e) => setDriverLng(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextStatus &&
                    nextStatus !== "cancelled" &&
                    nextStatus !== "failed" && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => updateStatus(nextStatus)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Advance to {STATUS_LABELS[nextStatus]}
                      </button>
                    )}
                  {STATUS_ORDER.filter((s) => s !== selected.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updating}
                      onClick={() => updateStatus(s)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      Set {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
