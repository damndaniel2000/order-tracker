"use client";

import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import type { Driver } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function suggestUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

type Props = {
  orderId: string;
  attemptedName: string;
  drivers: Driver[];
  onResolved: (driver: { id: string; display_name: string }, isNew: boolean) => void | Promise<void>;
};

export function ResolveDriverDialog({ orderId, attemptedName, drivers, onResolved }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDriver, setNewDriver] = useState({
    username: suggestUsername(attemptedName),
    displayName: attemptedName,
    password: "",
    phone: "",
  });

  async function assignDriver(driverId: string) {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, assignedDriverId: driverId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Could not assign driver.");
    }
  }

  async function handleMatch() {
    if (!selectedDriverId) return;
    setMatching(true);
    setError(null);
    try {
      await assignDriver(selectedDriverId);
      const driver = drivers.find((d) => d.id === selectedDriverId)!;
      onResolved(driver, false);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign driver.");
    } finally {
      setMatching(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create driver.");
      await assignDriver(data.driver.id);
      onResolved(data.driver, true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create driver.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="mt-1">
            Resolve driver
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a driver</DialogTitle>
          <DialogDescription>
            &ldquo;{attemptedName}&rdquo; from the sheet didn&apos;t match any driver. Match it to
            an existing one or create a new driver account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <UserCheck className="h-3.5 w-3.5" />
            Match to an existing driver
          </Label>
          <div className="flex gap-2">
            <Select value={selectedDriverId ?? undefined} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.display_name} ({d.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={!selectedDriverId || matching}
              onClick={handleMatch}
            >
              {matching ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>

        <Separator className="my-1" />

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <UserPlus className="h-3.5 w-3.5" />
            Or create a new driver
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="resolveUsername" className="mb-1 text-xs">
                Username
              </Label>
              <Input
                id="resolveUsername"
                value={newDriver.username}
                onChange={(e) => setNewDriver((d) => ({ ...d, username: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="resolveDisplayName" className="mb-1 text-xs">
                Display name
              </Label>
              <Input
                id="resolveDisplayName"
                value={newDriver.displayName}
                onChange={(e) => setNewDriver((d) => ({ ...d, displayName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="resolvePassword" className="mb-1 text-xs">
                Password (min 8 chars)
              </Label>
              <Input
                id="resolvePassword"
                type="password"
                minLength={8}
                value={newDriver.password}
                onChange={(e) => setNewDriver((d) => ({ ...d, password: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="resolvePhone" className="mb-1 text-xs">
                Phone (optional)
              </Label>
              <Input
                id="resolvePhone"
                value={newDriver.phone}
                onChange={(e) => setNewDriver((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={
              creating || !newDriver.username || !newDriver.displayName || newDriver.password.length < 8
            }
            onClick={handleCreate}
          >
            {creating ? "Creating…" : "Create & assign"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
