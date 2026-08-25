"use client";

import { useEffect, useMemo } from "react";
import type { DeliveryLocation } from "@/lib/types";
import { MapPin, Navigation } from "lucide-react";

type Props = {
  deliveryLat: number | null;
  deliveryLng: number | null;
  locations: DeliveryLocation[];
  address: string;
};

export default function DeliveryMap({
  deliveryLat,
  deliveryLng,
  locations,
  address,
}: Props) {
  const latest = locations[locations.length - 1];
  const center = useMemo(() => {
    if (latest) return [latest.lat, latest.lng] as [number, number];
    if (deliveryLat != null && deliveryLng != null) {
      return [deliveryLat, deliveryLng] as [number, number];
    }
    return [39.8283, -98.5795] as [number, number];
  }, [latest, deliveryLat, deliveryLng]);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const el = document.getElementById("delivery-map");
      if (!el || cancelled) return;

      if ((el as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
        return;
      }

      map = L.map(el, { scrollWheelZoom: false }).setView(center, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const driverIcon = L.divIcon({
        className: "",
        html: `<span style="background:#4f46e5;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:block"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const destIcon = L.divIcon({
        className: "",
        html: `<span style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25);display:block"></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      if (locations.length > 1) {
        const path = locations.map((l) => [l.lat, l.lng] as [number, number]);
        L.polyline(path, { color: "#6366f1", weight: 4, opacity: 0.7 }).addTo(
          map
        );
      }

      if (latest) {
        L.marker([latest.lat, latest.lng], { icon: driverIcon })
          .addTo(map)
          .bindPopup(
            `<strong>${latest.driver_name}</strong><br/>Current position<br/>${new Date(latest.recorded_at).toLocaleString()}`
          );
        map.setView([latest.lat, latest.lng], 14);
      }

      if (deliveryLat != null && deliveryLng != null) {
        L.marker([deliveryLat, deliveryLng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<strong>Delivery address</strong><br/>${address}`);
      }

      const bounds: [number, number][] = [];
      if (latest) bounds.push([latest.lat, latest.lng]);
      if (deliveryLat != null && deliveryLng != null) {
        bounds.push([deliveryLat, deliveryLng]);
      }
      if (bounds.length >= 2) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    init();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center, locations, deliveryLat, deliveryLng, address, latest]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Navigation className="h-4 w-4 text-indigo-600" />
          Live delivery map
        </div>
        <span className="text-xs text-zinc-500">OpenStreetMap</span>
      </div>
      <div id="delivery-map" className="h-56 w-full sm:h-72" />
      {latest ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
            {latest.driver_name}
          </span>
          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <MapPin className="h-3.5 w-3.5" />
            {latest.lat.toFixed(4)}, {latest.lng.toFixed(4)}
          </span>
        </div>
      ) : (
        <p className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
          Driver location will appear when the order is out for delivery.
        </p>
      )}
    </section>
  );
}
