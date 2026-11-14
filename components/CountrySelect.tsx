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
      <div className="field flex items-center gap-2 !py-0">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flagSvg(value)} alt="" className="h-4 w-6 rounded-[2px] object-cover" />
        )}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full bg-transparent py-2.5 outline-none"
          placeholder={value ? countryName(value) : "Search country…"}
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
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl"
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
