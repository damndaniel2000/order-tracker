"use client";

import { useMemo, useState } from "react";
import { Keyboard } from "lucide-react";
import type { OrderDetail } from "@/lib/types";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { TrackOrderForm, focusOrderInput } from "./TrackOrderForm";
import { OrderDetailView } from "./OrderDetailView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DEMO_ORDERS = [
  { number: "ORD-2024-1007", password: "TestOrder123!" },
  { number: "ORD-2024-1008", password: "TestOrder123!" },
  { number: "ORD-2024-1009", password: "TestOrder123!" },
];

type Props = {
  initialOrderNumber?: string;
};

export function CustomerTracker({ initialOrderNumber = "" }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [authPassword, setAuthPassword] = useState("");
  const [orderNumberInput, setOrderNumberInput] = useState(initialOrderNumber);
  const [passwordInput, setPasswordInput] = useState("");
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

  function fillDemo(orderNumber: string, demoPassword: string) {
    setOrderNumberInput(orderNumber);
    setPasswordInput(demoPassword);
  }

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
              Enter your order number and password to see status, timeline, and live delivery map.
            </p>
            <Button
              type="button"
              variant="link"
              onClick={() => setHelpOpen(true)}
              className="mt-3 h-auto p-0 text-xs"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Shortcuts (?)
            </Button>
          </div>

          <Card className="p-5 sm:p-6">
            <CardContent className="px-0">
              <TrackOrderForm
                onFound={(found, password) => {
                  setOrder(found);
                  setAuthPassword(password);
                }}
                orderNumber={orderNumberInput}
                password={passwordInput}
                onOrderNumberChange={setOrderNumberInput}
                onPasswordChange={setPasswordInput}
              />
            </CardContent>
          </Card>

          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Test order numbers
            </p>
            <ul className="flex flex-wrap gap-2">
              {DEMO_ORDERS.map((demo) => (
                <li key={demo.number}>
                  <button
                    type="button"
                    onClick={() => fillDemo(demo.number, demo.password)}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-left text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    <span className="block font-mono">{demo.number}</span>
                    <span className="block text-xs text-zinc-500">{demo.password}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <Button
            type="button"
            variant="link"
            onClick={() => setOrder(null)}
            className="mb-4 h-auto p-0 text-sm"
          >
            ← Track another order
          </Button>
          <OrderDetailView initialOrder={order} password={authPassword} />
        </div>
      )}
    </>
  );
}
