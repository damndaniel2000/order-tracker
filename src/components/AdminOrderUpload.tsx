"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Copy, Upload } from "lucide-react";
import type { Driver, UploadPreviewRow, UploadResultRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResolveDriverDialog } from "@/components/ResolveDriverDialog";

type ResolvedDriver = { id: string; display_name: string };

// Rows are matched to a resolution by the same raw sheet value the real
// upload will key on -- phone if present, else the name -- so resolving
// once for "MUKESH" applies to every row that said "MUKESH".
function driverKey(name: string | null, phone: string | null): string | null {
  return phone || name;
}

export function AdminOrderUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<UploadPreviewRow[] | null>(null);
  const [driverOverrides, setDriverOverrides] = useState<Record<string, ResolvedDriver>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResultRow[] | null>(null);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    fetch("/api/admin/drivers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setDrivers((data.drivers ?? []) as Driver[]));
  }, []);

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setDriverOverrides({});
    setResults(null);
    setError(null);
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/orders/upload/preview", { method: "POST", body: fd });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not preview this file.");
        return;
      }
      setPreview(data.preview as UploadPreviewRow[]);
      setDriverOverrides({});
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPreviewing(false);
    }
  }

  const summary = useMemo(() => {
    if (!preview) return null;
    const unresolved = preview.filter((r) => {
      if (r.error || r.matchedDriverName) return false;
      const key = driverKey(r.driverName, r.driverPhone);
      return key && !driverOverrides[key];
    });
    return {
      newOrders: preview.filter((r) => !r.error && !r.alreadyExists).length,
      alreadyExists: preview.filter((r) => r.alreadyExists).length,
      newCustomers: preview.filter((r) => r.isNewCustomer && !r.error).length,
      unmatchedDrivers: unresolved.length,
      invalid: preview.filter((r) => r.error).length,
    };
  }, [preview, driverOverrides]);

  function handlePreviewDriverResolved(
    key: string,
    driver: { id: string; display_name: string },
    isNew: boolean
  ) {
    setDriverOverrides((prev) => ({ ...prev, [key]: driver }));
    if (isNew) {
      fetch("/api/admin/drivers")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setDrivers((data.drivers ?? []) as Driver[]));
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("overwrite", "false");
      const overridesById = Object.fromEntries(
        Object.entries(driverOverrides).map(([key, driver]) => [key, driver])
      );
      fd.append("driverOverrides", JSON.stringify(overridesById));
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
      setPreview(null);
      setDriverOverrides({});
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
          <label
            htmlFor="orderFile"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20"
          >
            <Upload className="h-8 w-8 text-zinc-400" />
            <span className="text-sm font-medium">
              {file ? file.name : "Click to choose a .xlsx file"}
            </span>
            {!file && <span className="text-xs text-zinc-400">or drag it here</span>}
            <input
              id="orderFile"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          {!preview && (
            <Button
              type="button"
              disabled={!file || previewing}
              onClick={handlePreview}
              className="mt-4 w-full"
            >
              {previewing ? "Reading file…" : "Preview"}
            </Button>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && summary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Preview — nothing has been saved yet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                {summary.newOrders} new order{summary.newOrders === 1 ? "" : "s"}
              </span>
              {summary.newCustomers > 0 && (
                <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                  {summary.newCustomers} new customer{summary.newCustomers === 1 ? "" : "s"}
                </span>
              )}
              {summary.alreadyExists > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {summary.alreadyExists} AWB{summary.alreadyExists === 1 ? "" : "s"} already exist
                  — will be skipped
                </span>
              )}
              {summary.unmatchedDrivers > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {summary.unmatchedDrivers} unmatched driver{summary.unmatchedDrivers === 1 ? "" : "s"}
                </span>
              )}
              {summary.invalid > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                  {summary.invalid} row{summary.invalid === 1 ? "" : "s"} missing required fields
                </span>
              )}
            </div>

            <div className="max-h-[50vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>City / Pincode</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell className="font-mono">{r.orderNumber}</TableCell>
                      <TableCell>
                        {r.customerCode}
                        {r.isNewCustomer && !r.error && (
                          <span className="block text-xs text-indigo-600 dark:text-indigo-400">
                            new customer
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {[r.city, r.pincode].filter(Boolean).join(" - ") || "—"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const key = driverKey(r.driverName, r.driverPhone);
                          if (!key) return <span className="text-zinc-400">—</span>;
                          if (r.matchedDriverName) return r.matchedDriverName;
                          const resolved = driverOverrides[key];
                          if (resolved) return resolved.display_name;
                          return (
                            <div>
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {key} (no match)
                              </span>
                              <ResolveDriverDialog
                                attemptedName={r.driverName || ""}
                                attemptedPhone={r.driverPhone || ""}
                                drivers={drivers}
                                onResolved={(driver, isNew) =>
                                  handlePreviewDriverResolved(key, driver, isNew)
                                }
                              />
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.pickupAt ? formatDate(r.pickupAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.error ? (
                          <span className="text-red-600 dark:text-red-400">{r.error}</span>
                        ) : r.alreadyExists ? (
                          <span className="text-amber-600 dark:text-amber-400">Already exists</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">New</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={uploading} onClick={handleConfirm}>
                {uploading
                  ? "Creating…"
                  : `Confirm & create ${summary.newOrders} order${summary.newOrders === 1 ? "" : "s"}`}
              </Button>
              <Button type="button" variant="outline" disabled={uploading} onClick={() => chooseFile(null)}>
                Choose a different file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
