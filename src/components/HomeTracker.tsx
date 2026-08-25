"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import type { OrderDetail } from "@/lib/types";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { TrackOrderForm, focusOrderInput } from "./TrackOrderForm";
import { OrderDetailView } from "./OrderDetailView";

const DEMO_ORDERS = [
  { number: "ORD-2024-1001", email: "priya.sharma@example.com" },
  { number: "ORD-2024-1002", email: "rohan.verma@example.com" },
  { number: "ORD-2024-1003", email: "demo@guest.test" },
];

type Props = {
  initialOrderNumber?: string;
  initialEmail?: string;
};

export function HomeTracker({
  initialOrderNumber = "",
  initialEmail = "",
}: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [email, setEmail] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const shortcuts = useMemo(
    () => [
      { keys: "?", description: "Show keyboard shortcuts", action: () => setHelpOpen((o) => !o) },
      { keys: "/", description: "Focus order number field", action: focusOrderInput, global: true },
      {
        keys: "Escape",
        description: "Back to search / close help",
        action: () => {
          if (helpOpen) setHelpOpen(false);
          else setOrder(null);
        },
      },
      { keys: "h", description: "Go to home (clear order)", action: () => setOrder(null) },
    ],
    [helpOpen]
  );

  useKeyboardShortcuts(
    shortcuts.map((s) => ({
      keys: s.keys,
      description: s.description,
      global: "global" in s ? s.global : false,
      action: s.action,
    }))
  );

  const fillDemo = useCallback(
    (orderNumber: string, demoEmail: string) => {
      setOrder(null);
      router.push(
        `/?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(demoEmail)}`
      );
    },
    [router]
  );

  return (
    <>
      <KeyboardShortcutsHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts.map(({ keys, description }) => ({ keys, description }))}
      />

      {!order ? (
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Track your order
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Enter your order number to see status, timeline, and live delivery map.
            </p>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Shortcuts (?)
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <TrackOrderForm
              onFound={(found, foundEmail) => {
                setOrder(found);
                setEmail(foundEmail);
              }}
              initialOrderNumber={initialOrderNumber}
              initialEmail={initialEmail}
            />
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Test order numbers
            </p>
            <ul className="flex flex-wrap gap-2">
              {DEMO_ORDERS.map((demo) => (
                <li key={demo.number}>
                  <button
                    type="button"
                    onClick={() => fillDemo(demo.number, demo.email)}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-left text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    <span className="block font-mono">{demo.number}</span>
                    <span className="block text-xs text-zinc-500">{demo.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={() => setOrder(null)}
            className="mb-4 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Track another order
          </button>
          <OrderDetailView initialOrder={order} email={email} />
        </div>
      )}
    </>
  );
}
