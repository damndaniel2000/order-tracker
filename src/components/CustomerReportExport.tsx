"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Search,
} from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "./OrderStatusBadge";

const PAGE_SIZES = [25, 50, 100];

type ReportRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  driverName: string | null;
  city: string | null;
  pincode: string | null;
  quantity: number;
  deliveryTime: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type SortKey = "order_number" | "status" | "city" | "pincode" | "created_at";

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "order_number", label: "AWB / Order #" },
  { key: "city", label: "City" },
  { key: "pincode", label: "Pincode" },
  { key: "status", label: "Status" },
  { key: null, label: "Driver" },
  { key: null, label: "Qty" },
  { key: null, label: "Delivered" },
  { key: null, label: "Photo" },
  { key: "created_at", label: "Created" },
];

export function CustomerReportExport() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [from, to]);

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);
    return params;
  }, [from, to, search]);

  useEffect(() => {
    if (from && to && from > to) return;
    const controller = new AbortController();
    setTableLoading(true);
    setError(null);
    const params = new URLSearchParams(filterParams);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/customer/orders/report?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setRows(data.rows as ReportRow[]);
        setTotal(data.total as number);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Could not load orders.");
      })
      .finally(() => {
        setTableLoading(false);
        setInitialLoading(false);
      });

    return () => controller.abort();
  }, [filterParams, sortBy, sortDir, page, pageSize, router, from, to]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  async function handleDownload() {
    if (from && to && from > to) {
      setError("The start date must be before the end date.");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customer/orders/export?${filterParams.toString()}`);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? "my-orders.xlsx";
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/customer" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to my orders
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            My reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div>
              <Label htmlFor="search" className="mb-1.5">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="search"
                  placeholder="AWB, address, receiver…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              {initialLoading ? "Loading…" : `${total} order${total === 1 ? "" : "s"} match these filters`}
            </p>
            <Button type="button" disabled={downloading} onClick={handleDownload}>
              {downloading ? "Preparing…" : "Download .xlsx"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent>
          {initialLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((col) => (
                        <TableHead key={col.label}>
                          {col.key ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key!)}
                              className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                            >
                              {col.label}
                              {sortBy === col.key ? (
                                sortDir === "asc" ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </button>
                          ) : (
                            col.label
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableLoading ? (
                      Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                          {COLUMNS.map((col) => (
                            <TableCell key={col.label}>
                              <div className="h-4 w-full max-w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={COLUMNS.length} className="py-10 text-center text-zinc-500">
                          No orders match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.orderNumber}</TableCell>
                          <TableCell>{r.city ?? "—"}</TableCell>
                          <TableCell>{r.pincode ?? "—"}</TableCell>
                          <TableCell>
                            <OrderStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell>{r.driverName ?? "Unassigned"}</TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.deliveryTime ? formatDate(r.deliveryTime) : "—"}
                          </TableCell>
                          <TableCell>
                            {r.imageUrl ? (
                              <a
                                href={r.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
                              >
                                View
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span>Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value ?? 25));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || tableLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-sm text-zinc-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || tableLoading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
