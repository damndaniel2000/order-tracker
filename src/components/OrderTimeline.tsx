import { Check, Circle } from "lucide-react";
import { STATUS_LABELS, type OrderEvent, type OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Props = {
  events: OrderEvent[];
  currentStatus: OrderStatus;
};

const MAIN_SEQUENCE: OrderStatus[] = ["booked", "arrived_at_hub", "out_for_delivery"];

type Step = {
  status: OrderStatus;
  done: boolean;
  title: string;
  description: string | null;
  createdAt: string | null;
  locationLabel: string | null;
};

export function OrderTimeline({ events, currentStatus }: Props) {
  // Cancellation can happen from any stage, so there's no fixed sequence to
  // backfill against -- fall back to showing whatever events actually
  // happened, same as before.
  const steps: Step[] =
    currentStatus === "cancelled"
      ? events.map((event) => ({
          status: event.status,
          done: false,
          title: event.title,
          description: event.description,
          createdAt: event.created_at,
          locationLabel: event.location_label,
        }))
      : buildFixedSteps(events, currentStatus);

  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={`${step.status}-${i}`} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5",
                  step.done ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700"
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                step.done
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
              )}
            >
              {step.done ? (
                <Check className="h-4 w-4" />
              ) : (
                <Circle className="h-3 w-3 text-zinc-400" />
              )}
            </span>
            <div className={cn("min-w-0 flex-1 pt-0.5", !step.done && "opacity-60")}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{step.title}</p>
              {step.description && (
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              )}
              {step.createdAt && (
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(step.createdAt)}
                  {step.locationLabel ? ` · ${step.locationLabel}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Always render the full booked -> arrived_at_hub -> out_for_delivery ->
// delivered/undelivered sequence, regardless of how many order_events rows
// actually exist -- admin/driver actions only log an event for whatever
// status was just set, so a status jump (e.g. booked straight to
// out_for_delivery) leaves earlier stages with no row at all. Without this,
// two orders at the same status can show a different number of steps.
function buildFixedSteps(events: OrderEvent[], currentStatus: OrderStatus): Step[] {
  const finalStatus: OrderStatus = currentStatus === "undelivered" ? "undelivered" : "delivered";
  const sequence = [...MAIN_SEQUENCE, finalStatus];
  const currentIdx = sequence.indexOf(currentStatus);

  return sequence.map((status, idx) => {
    const event = events.find((e) => e.status === status);
    return {
      status,
      done: idx <= currentIdx,
      title: event?.title ?? STATUS_LABELS[status],
      description: event?.description ?? null,
      createdAt: event?.created_at ?? null,
      locationLabel: event?.location_label ?? null,
    };
  });
}
