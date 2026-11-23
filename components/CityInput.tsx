"use client";

import { useEffect, useId, useState } from "react";

/**
 * City field with suggestions from the chosen country (type to search). Any city can still be typed
 * by hand — the list only helps.
 */
export function CityInput({
  countryCode,
  value,
  onChange,
  className = "field",
  placeholder = "Type to search, or write it in",
}: {
  countryCode: string;
  value: string;
  onChange: (city: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    if (!/^[A-Z]{2}$/i.test(countryCode)) return setCities([]);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?country=${countryCode}&q=${encodeURIComponent(value)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { cities?: string[] };
        setCities(data.cities ?? []);
      } catch {
        /* offline: type it in */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [countryCode, value]);

  return (
    <>
      <input value={value} list={listId} onChange={(e) => onChange(e.target.value)} className={className} placeholder={countryCode ? placeholder : "Choose the country first"} autoComplete="off" />
      <datalist id={listId}>
        {cities.filter((c) => c !== value).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
