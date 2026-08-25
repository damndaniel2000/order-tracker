"use client";

import { useEffect } from "react";

export type ShortcutDef = {
  keys: string;
  description: string;
  action: () => void;
  /** When true, fires even if focus is in an input */
  global?: boolean;
};

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const help = shortcuts.find((s) => s.keys === "?");
        if (help && (help.global || !isInputFocused())) {
          e.preventDefault();
          help.action();
        }
        return;
      }

      if (isInputFocused() && e.key !== "Escape") return;

      for (const shortcut of shortcuts) {
        if (shortcut.keys === "?") continue;
        const parts = shortcut.keys.toLowerCase().split("+");
        const key = parts[parts.length - 1];
        const needsMeta = parts.includes("meta") || parts.includes("ctrl");
        const needsShift = parts.includes("shift");
        const needsAlt = parts.includes("alt");

        if (e.key.toLowerCase() !== key) continue;
        if (needsMeta !== (e.metaKey || e.ctrlKey)) continue;
        if (needsShift !== e.shiftKey) continue;
        if (needsAlt !== e.altKey) continue;

        e.preventDefault();
        shortcut.action();
        break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
