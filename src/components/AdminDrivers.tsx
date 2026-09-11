"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import type { Driver } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/drivers");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setDrivers((data.drivers ?? []) as Driver[]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to dashboard
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add driver
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createDriver} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="newDriverUsername" className="mb-1.5">
                Username
              </Label>
              <Input
                id="newDriverUsername"
                type="text"
                required
                value={newDriver.username}
                onChange={(e) => setNewDriver((d) => ({ ...d, username: e.target.value }))}
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
                onChange={(e) => setNewDriver((d) => ({ ...d, displayName: e.target.value }))}
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
                onChange={(e) => setNewDriver((d) => ({ ...d, email: e.target.value }))}
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
                onChange={(e) => setNewDriver((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="newDriverPassword" className="mb-1.5">
                Password (min 8 characters)
              </Label>
              <Input
                id="newDriverPassword"
                type="password"
                required
                minLength={8}
                value={newDriver.password}
                onChange={(e) => setNewDriver((d) => ({ ...d, password: e.target.value }))}
              />
            </div>
            {driverError && (
              <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{driverError}</p>
            )}
            {driverSuccess && (
              <p className="text-xs text-emerald-600 sm:col-span-2 dark:text-emerald-400">
                {driverSuccess}
              </p>
            )}
            <Button type="submit" disabled={creatingDriver} className="sm:col-span-2">
              {creatingDriver ? "Adding…" : "Add driver"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All drivers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono">{d.username}</TableCell>
                      <TableCell>{d.display_name}</TableCell>
                      <TableCell>{d.phone ?? "—"}</TableCell>
                      <TableCell>{d.email ?? "—"}</TableCell>
                      <TableCell>{d.is_active ? "Active" : "Inactive"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
