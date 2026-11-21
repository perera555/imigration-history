"use client";

import { useEffect, useRef, useState } from "react";

const PARTS = [
  { key: "card", label: "Travel card", hint: "Photo and personal details" },
  { key: "record", label: "Immigration record", hint: "Table of all countries and visits" },
  { key: "stays", label: "Hotels & Airbnb", hint: "Table of every place stayed" },
  { key: "visas", label: "Visa record", hint: "Table of all visas, incl. Schengen" },
  { key: "boarding", label: "Boarding passes", hint: "Table of flights + real-size passes" },
] as const;

type PartKey = (typeof PARTS)[number]["key"];

/** "PDF" button: asks which parts to include, then View (new tab) or Download. */
export function PdfButtons({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<PartKey, boolean>>({ card: true, record: true, stays: true, visas: true, boarding: true });
  const allOn = PARTS.every((p) => chosen[p.key]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const selected = PARTS.filter((p) => chosen[p.key]).map((p) => p.key);
  const href = `/api/profiles/${profileId}/pdf?parts=${selected.join(",")}`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn btn-gold">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        PDF ▾
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-card p-4 text-ink shadow-2xl">
          <p className="font-semibold">Which parts do you want?</p>
          <p className="mb-3 text-xs text-ink-soft">Each part is a table on its own page, so it prints page by page.</p>
          <label className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-xl bg-paper-2 px-2 py-1.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => setChosen(Object.fromEntries(PARTS.map((p) => [p.key, e.target.checked])) as Record<PartKey, boolean>)}
              className="size-4 accent-navy"
            />
            All data (everything)
          </label>
          <div className="space-y-2">
            {PARTS.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper-2">
                <input
                  type="checkbox"
                  checked={chosen[p.key]}
                  onChange={(e) => setChosen((c) => ({ ...c, [p.key]: e.target.checked }))}
                  className="mt-1 size-4 accent-navy"
                />
                <span>
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="block text-xs text-ink-soft">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            {selected.length ? (
              <>
                <a href={`${href}&view=1`} target="_blank" rel="noopener" className="btn btn-ghost flex-1" onClick={() => setOpen(false)}>
                  👁 View
                </a>
                <a href={href} className="btn btn-primary flex-1" onClick={() => setOpen(false)}>
                  ⬇ Download
                </a>
              </>
            ) : (
              <p className="text-sm text-danger">Choose at least one part.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
