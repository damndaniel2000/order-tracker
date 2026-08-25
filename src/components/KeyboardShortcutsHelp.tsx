"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  shortcuts: { keys: string; description: string }[];
};

export function KeyboardShortcutsHelp({ open, onClose, shortcuts }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-lg font-semibold">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-zinc-600 dark:text-zinc-400">
                {s.description}
              </span>
              <kbd
                className={cn(
                  "shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-800"
                )}
              >
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Press <kbd className="rounded border px-1">?</kbd> anytime to toggle
          this panel.
        </p>
      </div>
    </div>
  );
}
