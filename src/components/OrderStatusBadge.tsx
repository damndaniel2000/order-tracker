import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={STYLES[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
