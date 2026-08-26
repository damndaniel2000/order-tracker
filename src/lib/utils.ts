import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents: number, currency = "INR") {
  const locale = currency === "INR" ? "en-IN" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
