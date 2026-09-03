"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDown } from "lucide-react";
import type { Customer } from "@/lib/types";
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

const ALL_CUSTOMERS = "__all__";

export function AdminReportExport() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(ALL_CUSTOMERS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/customers")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setCustomers(data.customers as Customer[]);
      });
  }, [router]);

  async function handleDownload() {
    if (from && to && from > to) {
      setError("The start date must be before the end date.");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (customerId !== ALL_CUSTOMERS) params.set("customerId", customerId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/orders/export?${params.toString()}`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? "orders-export.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to dashboard
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Download report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5">Customer</Label>
            <Select value={customerId} onValueChange={(value) => setCustomerId(value ?? ALL_CUSTOMERS)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CUSTOMERS}>All customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.customer_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fromDate" className="mb-1.5">
                From
              </Label>
              <Input id="fromDate" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="toDate" className="mb-1.5">
                To
              </Label>
              <Input id="toDate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          <Button type="button" disabled={downloading} onClick={handleDownload} className="w-full">
            {downloading ? "Preparing…" : "Download"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
