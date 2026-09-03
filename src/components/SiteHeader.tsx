"use client";

import Link from "next/link";
import { Package } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Package className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Likhit Track</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/track"
            className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Track order
          </Link>
          <Link
            href="/admin/login"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
