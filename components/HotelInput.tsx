"use client";

import { useEffect, useId, useState } from "react";

type Hotel = { name: string; address: string | null; kind?: string };
/** Each city's list, loaded once per page (shared by every visit in that city). */
const cityLists = new Map<string, Promise<{ hotels?: Hotel[]; total?: number; error?: string }>>();

/**
 * Hotel / Airbnb field: your saved hotels for the country first, then hotels of the visit's city with
 * their addresses (OpenStreetMap). Picking one also fills its address. Any hotel can be typed in.
 */
export function HotelInput({
  countryCode,
  city,
  value,
  saved,
  onChange,
  className = "field",
}: {
  countryCode: string;
  city: string;
  value: string;
  saved: Hotel[];
  onChange: (name: string, address: string | null) => void;
  className?: string;
}) {
  const listId = useId();
  const [all, setAll] = useState<Hotel[]>([]);
  const [status, setStatus] = useState("");
  // Only load a city's hotels when this box is used (not for every visit when the page opens).
  const [active, setActive] = useState(false);

  // The city's whole list is loaded once (the first time can take ~30 s), then searched here.
  useEffect(() => {
    const c = city.trim();
    if (!active || !/^[A-Z]{2}$/i.test(countryCode) || c.length < 2) {
      setAll([]);
      setStatus("");
      return;
    }
    const key = `${countryCode}|${c.toLowerCase()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus(`Loading hotels in ${c}… (the first time can take up to a minute)`);
      try {
        let job = cityLists.get(key);
        if (!job) {
          job = fetch(`/api/hotels?country=${countryCode}&city=${encodeURIComponent(c)}`).then((r) => r.json());
          cityLists.set(key, job);
          job.catch(() => cityLists.delete(key));
        }
        const data = await job;
        if (ctrl.signal.aborted) return;
        if (data.error) cityLists.delete(key); // try again next time
        setAll(data.hotels ?? []);
        setStatus(data.error ?? (data.total ? `${data.total} places to stay in ${c} · type to search` : `No hotel list for ${c}. Type the hotel in.`));
      } catch {
        if (!ctrl.signal.aborted) setStatus("");
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [countryCode, city, active]);

  const q = value.trim().toLowerCase();
  const found = (q ? [...all.filter((h) => h.name.toLowerCase().startsWith(q)), ...all.filter((h) => !h.name.toLowerCase().startsWith(q) && h.name.toLowerCase().includes(q))] : all).slice(0, 40);
  const seen = new Set<string>();
  const options = [...saved, ...found].filter((h) => !seen.has(h.name.toLowerCase()) && !!seen.add(h.name.toLowerCase()));

  return (
    <>
      <input
        value={value}
        list={listId}
        onFocus={() => setActive(true)}
        onChange={(e) => {
          const name = e.target.value;
          const known = options.find((h) => h.name.toLowerCase() === name.trim().toLowerCase());
          onChange(name, known?.address ?? null);
        }}
        className={className}
        placeholder={city ? `Search hotels in ${city}, or type it in` : "Choose the city first, or type it in"}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options
          .filter((h) => h.name !== value)
          .map((h) => (
            <option key={h.name} value={h.name}>
              {[h.address, h.kind && h.kind !== "hotel" ? h.kind : null].filter(Boolean).join(" · ")}
            </option>
          ))}
      </datalist>
      {status && (
        <span className="mt-1 block text-[11px] text-ink-soft">
          {status}
          {all.length > 0 && <> · © OpenStreetMap</>}
        </span>
      )}
    </>
  );
}
