"use client";

import { useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, NATIONALITIES, flagSvg } from "@/lib/countries";

/** Searchable country list with flags for citizenship; submits the country name (e.g. "Sri Lanka"). */
export function CountryNameSelect(props: { name?: string; defaultValue?: string | null; onChange?: (value: string) => void; className?: string; placeholder?: string }) {
  return <NationalitySelect {...props} list={COUNTRIES} placeholder={props.placeholder ?? "Choose country (type to search)"} emptyText="No country found" />;
}

/** Searchable nationality dropdown with flags; submits the nationality name (e.g. "Sri Lankan"). */
export function NationalitySelect({
  name,
  defaultValue,
  onChange,
  className = "",
  list = NATIONALITIES,
  placeholder = "Choose nationality (type to search)",
  emptyText = "No nationality found",
}: {
  name?: string;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  className?: string;
  /** Options to choose from (default: nationalities). */
  list?: { code: string; name: string }[];
  placeholder?: string;
  emptyText?: string;
}) {
  const NATIONALITIES = list;
  const [value, setValueState] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = NATIONALITIES.find((n) => n.name.toLowerCase() === value.toLowerCase());

  const setValue = (v: string) => {
    setValueState(v);
    onChange?.(v);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? NATIONALITIES.filter((n) => n.name.toLowerCase().includes(q)) : NATIONALITIES;
  }, [query, NATIONALITIES]);

  function choose(v: string) {
    setValue(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="field flex cursor-pointer items-center gap-2 !py-0" onClick={() => inputRef.current?.focus()}>
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flagSvg(selected.code)} alt="" className="h-5 w-7 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full bg-transparent py-2.5 outline-none"
          placeholder={value || placeholder}
          value={open ? query : value}
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
              if (matches[active]) choose(matches[active].name);
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
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-xl border border-line bg-white p-1 shadow-2xl">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">{emptyText}</li>}
          {matches.map((n, i) => (
            <li
              key={n.code}
              role="option"
              aria-selected={n.name === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(n.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-paper-2" : ""} ${n.name === value ? "font-semibold" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagSvg(n.code)} alt="" loading="lazy" className="h-4 w-6 rounded-[2px] object-cover" />
              {n.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
