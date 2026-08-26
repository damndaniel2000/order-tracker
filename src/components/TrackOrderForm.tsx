"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { OrderDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  onFound: (order: OrderDetail, email: string) => void;
  orderNumber: string;
  email: string;
  onOrderNumberChange: (value: string) => void;
  onEmailChange: (value: string) => void;
};

export function TrackOrderForm({
  onFound,
  orderNumber,
  email,
  onOrderNumberChange,
  onEmailChange,
}: Props) {
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
        <Label htmlFor="orderNumber" className="mb-1.5">
          Order number
        </Label>
        <Input
          id="orderNumber"
          name="orderNumber"
          type="text"
          autoComplete="off"
          placeholder="ORD-2024-1001"
          value={orderNumber}
          onChange={(e) => onOrderNumberChange(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <Label htmlFor="trackEmail" className="mb-1.5">
          Email used at checkout
        </Label>
        <Input
          id="trackEmail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-sm">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Track order
      </Button>
    </form>
  );
}

export function focusOrderInput() {
  const el = document.getElementById("orderNumber") as HTMLInputElement | null;
  el?.focus();
}

const inputClass = cn("h-12 rounded-xl px-4 text-base");
