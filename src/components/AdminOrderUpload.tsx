"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, Upload } from "lucide-react";
import type { Driver, UploadResultRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResolveDriverDialog } from "@/components/ResolveDriverDialog";

export function AdminOrderUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResultRow[] | null>(null);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("overwrite", overwrite ? "true" : "false");
      const [res, driversRes] = await Promise.all([
        fetch("/api/admin/orders/upload", { method: "POST", body: fd }),
        fetch("/api/admin/drivers"),
      ]);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setResults(data.results as UploadResultRow[]);
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setDrivers((driversData.drivers ?? []) as Driver[]);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDriverResolved(
    rowNum: number,
    driver: { id: string; display_name: string },
    isNew: boolean
  ) {
    setResults((prev) =>
      (prev ?? []).map((row) =>
        row.row === rowNum ? { ...row, driverAssigned: driver.display_name, warning: undefined } : row
      )
    );
    if (isNew) {
      const res = await fetch("/api/admin/drivers");
      if (res.ok) {
        const data = await res.json();
        setDrivers((data.drivers ?? []) as Driver[]);
      }
    }
  }

  function copyPassword(row: number, password: string) {
    navigator.clipboard.writeText(password).then(() => {
      setCopiedRow(row);
      setTimeout(() => setCopiedRow((r) => (r === row ? null : r)), 1500);
    });
  }

  const hasNewCustomers = results?.some((r) => r.customerCreated) ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to dashboard
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-zinc-500">
            .xlsx manifest with columns: Customer, AWB, Address, Pincode, City, To (consignee),
            Receiver Name, Pick Up Date, Pick up time, Sprinter Name and Mobile Number (driver,
            optional). Driver matching tries the mobile number first, falling back to the name if
            there's no phone column or no match. Every other column (Ref No., ODA, boxes, weight,
            delivery outcome) is ignored — new orders always start at Booked. Format AWB as Text in
            Excel to avoid it turning into scientific notation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="max-w-xs"
            />
            <Button type="button" disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              If an AWB already exists, overwrite its address, pincode, city, receiver, and
              consignee with this sheet&apos;s values. Status, assigned driver, and history are
              never touched.
            </span>
          </label>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card className="mt-4">
          <CardContent>
            {hasNewCustomers && (
              <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                New customer passwords are shown once, below. Copy them now — they cannot be
                retrieved again after you leave this page.
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>AWB / Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>New password</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      {r.status === "error" ? (
                        <TableCell colSpan={4} className="text-red-600 dark:text-red-400">
                          {r.error}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="font-mono">
                            {r.orderNumber}
                            {r.status === "updated" && (
                              <span className="block text-xs font-sans text-zinc-500">
                                Updated existing order
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{r.customerCode}</TableCell>
                          <TableCell>
                            {r.status === "updated" && !r.warning ? (
                              <span className="text-zinc-400">unchanged</span>
                            ) : (
                              r.driverAssigned || "Unassigned"
                            )}
                            {r.warning && (
                              <span className="block text-xs text-amber-600 dark:text-amber-400">
                                {r.warning}
                              </span>
                            )}
                            {r.warning && r.orderId && (
                              <ResolveDriverDialog
                                orderId={r.orderId}
                                attemptedName={r.driverAssigned || ""}
                                drivers={drivers}
                                onResolved={(driver, isNew) =>
                                  handleDriverResolved(r.row, driver, isNew)
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {r.customerCreated && r.generatedPassword ? (
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-amber-50 px-2 py-1 font-mono text-xs dark:bg-amber-950/30">
                                  {r.generatedPassword}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => copyPassword(r.row, r.generatedPassword!)}
                                >
                                  {copiedRow === r.row ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
