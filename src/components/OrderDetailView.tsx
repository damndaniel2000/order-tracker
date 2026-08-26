"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Package, MapPin, Clock, Wifi } from "lucide-react";
import type { OrderDetail } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 sm:h-72 dark:border-zinc-800 dark:bg-zinc-900">
      Loading map…
    </div>
  ),
});

type Props = {
  initialOrder: OrderDetail;
  email: string;
};

export function OrderDetailView({ initialOrder, email }: Props) {
  const [order, setOrder] = useState<OrderDetail>(initialOrder);
  const [live] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: order.order_number, email }),
    });
    if (res.ok) {
      const data = (await res.json()) as OrderDetail;
      setOrder(data);
    }
  }, [order.order_number, email]);

  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const items = order.order_items ?? [];
  const events = order.order_events ?? [];
  const locations = order.delivery_locations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">Order</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {order.order_number}
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Hi {order.customer_name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <OrderStatusBadge status={order.status} />
          {live && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Wifi className="h-3 w-3" />
              Live updates
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon={Package} label="Total" value={formatCurrency(order.total_cents, order.currency)} />
        <InfoCard icon={Clock} label="Est. delivery" value={formatDate(order.estimated_delivery)} />
        <InfoCard icon={MapPin} label="Ship to" value={order.shipping_address} small />
      </div>

      <DeliveryMap
        deliveryLat={order.delivery_lat}
        deliveryLng={order.delivery_lng}
        locations={locations}
        address={order.shipping_address}
      />

      <Card>
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">Tracking timeline</h2>
          <OrderTimeline events={events} currentStatus={order.status} />
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">Items</h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between py-3 text-sm">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.unit_price_cents * item.quantity, order.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <Card className="bg-zinc-50/50 dark:bg-zinc-900/50">
      <CardContent>
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className={small ? "text-sm leading-snug" : "text-lg font-semibold"}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
