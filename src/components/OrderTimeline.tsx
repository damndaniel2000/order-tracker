import { Check, Circle } from "lucide-react";
import { STATUS_ORDER, type OrderEvent, type OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Props = {
  events: OrderEvent[];
  currentStatus: OrderStatus;
};

export function OrderTimeline({ events, currentStatus }: Props) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  return (
    <ol className="relative space-y-0">
      {events.map((event, i) => {
        const stepIdx = STATUS_ORDER.indexOf(event.status);
        const done = stepIdx <= currentIdx && currentStatus !== "cancelled";
        const isLast = i === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5",
                  done ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700"
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                done
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
              )}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : (
                <Circle className="h-3 w-3 text-zinc-400" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {event.title}
              </p>
              {event.description && (
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {event.description}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                {formatDate(event.created_at)}
                {event.location_label ? ` · ${event.location_label}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
