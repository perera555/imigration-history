"use client";

import { useState } from "react";

const MAX = 10;

/** Up to 10 previous passport numbers, one input each. */
export function PassportListInput({ name, defaultValue }: { name: string; defaultValue?: string[] }) {
  const [items, setItems] = useState<string[]>(defaultValue?.length ? defaultValue.slice(0, MAX) : [""]);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-ink-soft">{i + 1}.</span>
            <input
              name={name}
              value={value}
              onChange={(e) => setItems((list) => list.map((v, j) => (j === i ? e.target.value.toUpperCase() : v)))}
              className="field font-mono uppercase"
              placeholder="Passport number"
            />
            <button
              type="button"
              aria-label={`Remove passport ${i + 1}`}
              onClick={() => setItems((list) => (list.length === 1 ? [""] : list.filter((_, j) => j !== i)))}
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-danger"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {items.length < MAX ? (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, ""])}
          className="text-sm font-semibold text-navy-2 hover:underline"
        >
          + Add passport ({items.length}/{MAX})
        </button>
      ) : (
        <p className="text-xs text-ink-soft">Maximum of {MAX} previous passports.</p>
      )}
    </div>
  );
}
