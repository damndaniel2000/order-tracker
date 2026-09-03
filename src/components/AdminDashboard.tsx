"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, RefreshCw, Truck, UserPlus, Upload, FileDown } from "lucide-react";
import type { AdminOrder, Driver } from "@/lib/types";
import { NEXT_STATUSES, STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "__unassigned__";

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [driverLat, setDriverLat] = useState("");
  const [driverLng, setDriverLng] = useState("");
  const [newDriver, setNewDriver] = useState({
    username: "",
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
      setNewDriver({ username: "", email: "", password: "", displayName: "", phone: "" });
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

  const nextOptions = selected ? NEXT_STATUSES[selected.status] : [];
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
        <div className="flex flex-wrap gap-2">
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
            <Card className="p-2">
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
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
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add driver
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createDriver} className="space-y-2">
                  <div>
                    <Label htmlFor="newDriverUsername" className="mb-1.5">
                      Username
                    </Label>
                    <Input
                      id="newDriverUsername"
                      type="text"
                      required
                      value={newDriver.username}
                      onChange={(e) =>
                        setNewDriver((d) => ({ ...d, username: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newDriverName" className="mb-1.5">
                      Display name
                    </Label>
                    <Input
                      id="newDriverName"
                      type="text"
                      required
                      value={newDriver.displayName}
                      onChange={(e) =>
                        setNewDriver((d) => ({ ...d, displayName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newDriverEmail" className="mb-1.5">
                      Email (optional)
                    </Label>
                    <Input
                      id="newDriverEmail"
                      type="email"
                      value={newDriver.email}
                      onChange={(e) =>
                        setNewDriver((d) => ({ ...d, email: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newDriverPhone" className="mb-1.5">
                      Phone (optional)
                    </Label>
                    <Input
                      id="newDriverPhone"
                      type="text"
                      value={newDriver.phone}
                      onChange={(e) =>
                        setNewDriver((d) => ({ ...d, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newDriverPassword" className="mb-1.5">
                      Password (min 8 characters)
                    </Label>
                    <Input
                      id="newDriverPassword"
                      type="password"
                      required
                      minLength={8}
                      value={newDriver.password}
                      onChange={(e) =>
                        setNewDriver((d) => ({ ...d, password: e.target.value }))
                      }
                    />
                  </div>
                  {driverError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{driverError}</p>
                  )}
                  {driverSuccess && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {driverSuccess}
                    </p>
                  )}
                  <Button type="submit" disabled={creatingDriver} className="w-full">
                    {creatingDriver ? "Adding…" : "Add driver"}
                  </Button>
                </form>
              </CardContent>
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
                  <OrderStatusBadge status={selected.status} />
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
                    Update status and driver GPS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                <p className="mb-3 text-sm text-zinc-500">
                  Saves to Supabase. Customers see updates in real time on the map.
                </p>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Driver latitude"
                    value={driverLat}
                    onChange={(e) => setDriverLat(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder="Driver longitude"
                    value={driverLng}
                    onChange={(e) => setDriverLng(e.target.value)}
                  />
                </div>
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
