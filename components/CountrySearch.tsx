"use client";

import { useEffect, useRef, useState } from "react";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Search bar that filters the countries inside it as you type.
 * Items to filter carry data-search="names to match"; they are hidden when they don't match.
 */
export function CountrySearch({ children, placeholder = "Search a country…" }: { children: React.ReactNode; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = box.current?.querySelectorAll<HTMLElement>("[data-search]") ?? [];
    const words = norm(q).split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    items.forEach((el) => {
      const text = norm(el.dataset.search ?? "");
      const match = words.every((w) => text.includes(w));
      el.style.display = match ? "" : "none";
      if (match) seen.add(el.dataset.search ?? "");
    });
    setShown(words.length ? seen.size : null);
  }, [q]);

  return (
    <div ref={box} className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search a country"
          className="field !pl-11"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 text-sm text-ink-soft hover:text-ink">
            ✕
          </button>
        )}
      </div>
      {shown !== null && (
        <p className="text-sm text-ink-soft">
          {shown ? `${shown} countr${shown === 1 ? "y" : "ies"} found for “${q}”` : `No country found for “${q}”.`}
        </p>
      )}
      {children}
    </div>
  );
}
