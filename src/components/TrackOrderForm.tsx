"use client";

import { useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { OrderDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  onFound: (order: OrderDetail, email: string) => void;
  initialOrderNumber?: string;
  initialEmail?: string;
};

export function TrackOrderForm({
  onFound,
  initialOrderNumber = "",
  initialEmail = "",
}: Props) {
  const orderRef = useRef<HTMLInputElement>(null);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Order not found");
        return;
      }
      onFound(data as OrderDetail, email);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="orderNumber" className="mb-1.5 block text-sm font-medium">
          Order number
        </label>
        <input
          ref={orderRef}
          id="orderNumber"
          name="orderNumber"
          type="text"
          autoComplete="off"
          placeholder="ORD-2024-1001"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="trackEmail" className="mb-1.5 block text-sm font-medium">
          Email used at checkout
        </label>
        <input
          id="trackEmail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Track order
      </button>
    </form>
  );
}

export function focusOrderInput() {
  const el = document.getElementById("orderNumber") as HTMLInputElement | null;
  el?.focus();
}

const inputClass = cn(
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "dark:border-zinc-600 dark:bg-zinc-900"
);
