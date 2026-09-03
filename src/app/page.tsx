import Link from "next/link";
import { Truck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Truck className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Likhit Logistics
        </h1>
        <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
          Track your shipment's status, timeline, and live delivery location.
        </p>
        <Button className="mt-6 h-12 rounded-xl px-6 text-sm" render={<Link href="/track" />}>
          Track an order
        </Button>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Likhit Order Tracking · Testing environment
      </footer>
    </>
  );
}
