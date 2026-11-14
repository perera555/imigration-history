"use client";

import { useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryName, flagSvg } from "@/lib/countries";

export function CountrySelect({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
}) {
  const [value, setValueState] = useState(defaultValue ?? "");
  const setValue = (code: string) => {
    setValueState(code);
    onChange?.(code);
  };
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  function choose(code: string) {
    setValue(code);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="field flex cursor-pointer items-center gap-2 !py-0" onClick={() => inputRef.current?.focus()}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flagSvg(value)} alt="" className="h-5 w-7 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
          </svg>
        )}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full bg-transparent py-2.5 outline-none"
          placeholder={value ? countryName(value) : "Choose a country (type to search)"}
          value={open ? query : value ? countryName(value) : ""}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (matches[active]) choose(matches[active].code);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <svg viewBox="0 0 24 24" className={`size-4 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-xl border border-line bg-white p-1 shadow-2xl"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No country found</li>}
          {matches.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.code === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c.code);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                i === active ? "bg-paper-2" : ""
              } ${c.code === value ? "font-semibold" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagSvg(c.code)} alt="" loading="lazy" className="h-4 w-6 rounded-[2px] object-cover" />
              {c.name}
              <span className="ml-auto text-xs text-ink-soft">{c.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
