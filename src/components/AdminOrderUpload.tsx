"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, Upload } from "lucide-react";
import type { UploadResultRow } from "@/lib/types";
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

export function AdminOrderUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResultRow[] | null>(null);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/orders/upload", { method: "POST", body: fd });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setResults(data.results as UploadResultRow[]);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setUploading(false);
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
            .xlsx file with columns: customer_code, customer_name, shipping_address, items
            (e.g. &quot;Bluetooth Speaker x1, USB Cable x2&quot;), driver_username (optional).
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
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer code</TableHead>
                    <TableHead>Customer name</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>New password</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      {r.status === "error" ? (
                        <TableCell colSpan={5} className="text-red-600 dark:text-red-400">
                          {r.error}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="font-mono">{r.orderNumber}</TableCell>
                          <TableCell>{r.customerCode}</TableCell>
                          <TableCell>{r.customerName}</TableCell>
                          <TableCell>
                            {r.driverAssigned ?? "Unassigned"}
                            {r.warning && (
                              <span className="block text-xs text-amber-600 dark:text-amber-400">
                                {r.warning}
                              </span>
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
