"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteStay, readStayDocument, saveStay, type StaySaveState } from "@/lib/stay-actions";
import type { Stay } from "@/lib/data";
import { STAY_ICON, STAY_KINDS, findLinks, stayNights } from "@/lib/stay-kinds";
import { countryName } from "@/lib/countries";
import { CountrySelect } from "./CountrySelect";
import { CountrySearch } from "./CountrySearch";
import { DateInput } from "./DateInput";
import { DocumentPicker, isImageName } from "./DocumentPicker";
import { ConfirmButton, SubmitButton } from "./SubmitButton";

export type StayTrip = { id: string; label: string; date: string; countryCode: string; purpose: string | null; city: string | null; stayedAt?: string | null; stayedAddress?: string | null };

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";

type Fields = {
  tripId: string;
  kind: string;
  name: string;
  countryCode: string;
  city: string;
  address: string;
  checkIn: string;
  checkOut: string;
  bookingRef: string;
  link: string;
  rating: string;
  notes: string;
};

const fromStay = (s?: Stay, tripId = ""): Fields => ({
  tripId: s?.tripId ?? tripId,
  kind: s?.kind ?? "Hotel",
  name: s?.name ?? "",
  countryCode: s?.countryCode ?? "",
  city: s?.city ?? "",
  address: s?.address ?? "",
  checkIn: s?.checkIn ?? "",
  checkOut: s?.checkOut ?? "",
  bookingRef: s?.bookingRef ?? "",
  link: s?.link ?? "",
  rating: s?.rating ? String(s.rating) : "",
  notes: s?.notes ?? "",
});

/** Add / update one stay (hotel, Airbnb home, …). */
function StayForm({
  profileId,
  stay,
  trips,
  allStays,
  startTrip,
  onDone,
}: {
  profileId: string;
  stay?: Stay;
  trips: StayTrip[];
  allStays: Stay[];
  startTrip?: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<StaySaveState, FormData>(saveStay.bind(null, profileId, stay?.id ?? null), undefined);
  const [f, setF] = useState<Fields>(() => {
    const base = fromStay(stay, startTrip);
    const t = trips.find((x) => x.id === base.tripId);
    // New stay for a trip: start with the trip's country, city and dates.
    if (!stay && t) {
      const [dep, ret] = t.date.split("|");
      return { ...base, name: t.stayedAt ?? "", address: t.stayedAddress ?? "", countryCode: t.countryCode, city: t.city ?? "", checkIn: dep, checkOut: ret || "" };
    }
    return base;
  });
  const [countryKey, setCountryKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  function pickTrip(id: string) {
    const t = trips.find((x) => x.id === id);
    setF((x) => {
      if (!t) return { ...x, tripId: id };
      const [dep, ret] = t.date.split("|");
      return { ...x, tripId: id, countryCode: t.countryCode, city: x.city || t.city || "", checkIn: x.checkIn || dep, checkOut: x.checkOut || ret || "" };
    });
    if (t) setCountryKey((k) => k + 1);
  }

  const [reading, startReading] = useTransition();
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  function readBooking() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setReadMsg({ error: "Choose the booking confirmation first (📷 / 🖼 above)." });
    setReadMsg({});
    startReading(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await readStayDocument(profileId, fd);
      if ("error" in r) return setReadMsg({ error: r.error });
      const d = r.details;
      // Link to the visit whose dates include the check-in date.
      const match = d.checkIn ? trips.find((t) => { const [a, b] = t.date.split("|"); return a <= d.checkIn! && d.checkIn! <= (b || a); }) : undefined;
      setF((x) => ({
        ...x,
        kind: d.kind ?? x.kind,
        name: d.name ?? x.name,
        address: d.address ?? x.address,
        checkIn: d.checkIn ?? x.checkIn,
        checkOut: d.checkOut ?? x.checkOut,
        bookingRef: d.bookingRef ?? x.bookingRef,
        tripId: x.tripId || match?.id || "",
        countryCode: x.countryCode || match?.countryCode || "",
      }));
      if (match && !f.countryCode) setCountryKey((k) => k + 1);
      const n = Object.values(d).filter((v) => v !== null).length;
      setReadMsg({ ok: `✓ ${n} detail${n === 1 ? "" : "s"} read. Please check them, then save.` });
    });
  }

  // Places stayed before (same country first): click to fill the form.
  const before = useMemo(() => {
    const seen = new Map<string, Stay>();
    for (const s of allStays) if (s.id !== stay?.id && !seen.has(s.name.toLowerCase())) seen.set(s.name.toLowerCase(), s);
    return [...seen.values()].sort((a, b) => Number(b.countryCode === f.countryCode) - Number(a.countryCode === f.countryCode));
  }, [allStays, stay?.id, f.countryCode]);
  const sameCountry = before.filter((s) => f.countryCode && s.countryCode === f.countryCode).slice(0, 8);

  const place = [f.city, f.countryCode ? countryName(f.countryCode) : ""].filter(Boolean).join(", ");

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="sm:col-span-2">
          <span className="field-label">Visit (from the immigration record)</span>
          <select name="tripId" value={f.tripId} onChange={(e) => pickTrip(e.target.value)} className="field">
            <option value="">Not linked (linked automatically by the check-in date)</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Type</span>
          <select name="kind" value={f.kind} onChange={set("kind")} className="field">
            {STAY_KINDS.map((k) => (
              <option key={k} value={k}>
                {STAY_ICON[k]} {k}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Hotel / home name *</span>
          <input name="name" value={f.name} onChange={set("name")} list={`stay-names-${stay?.id ?? "new"}`} className="field" placeholder="e.g. Hotel name or Airbnb listing title" required />
          <datalist id={`stay-names-${stay?.id ?? "new"}`}>
            {before.map((s) => (
              <option key={s.id} value={s.name}>
                {[s.city, s.countryCode && countryName(s.countryCode)].filter(Boolean).join(", ")}
              </option>
            ))}
          </datalist>
        </label>
        <div>
          <span className="field-label">Country</span>
          <CountrySelect key={countryKey} name="countryCode" defaultValue={f.countryCode} onChange={(c) => setF((x) => ({ ...x, countryCode: c }))} />
        </div>
        <label>
          <span className="field-label">City</span>
          <input name="city" value={f.city} onChange={set("city")} className="field" placeholder="e.g. Bangkok" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Address</span>
          <input name="address" value={f.address} onChange={set("address")} className="field" />
        </label>
        <label>
          <span className="field-label">Check-in</span>
          <DateInput name="checkIn" value={f.checkIn} onChange={set("checkIn")} className="field" />
        </label>
        <label>
          <span className="field-label">Check-out</span>
          <DateInput name="checkOut" value={f.checkOut} onChange={set("checkOut")} className="field" />
        </label>
        <label>
          <span className="field-label">Booking number</span>
          <input name="bookingRef" value={f.bookingRef} onChange={set("bookingRef")} className="field font-mono" />
        </label>
        <label>
          <span className="field-label">My rating</span>
          <select name="rating" value={f.rating} onChange={set("rating")} className="field">
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
                {"☆".repeat(5 - n)}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Link (booking page / listing)</span>
          <input name="link" value={f.link} onChange={set("link")} className="field" placeholder="https://…" />
        </label>
        <label className="sm:col-span-2 lg:col-span-3">
          <span className="field-label">Notes</span>
          <input name="notes" value={f.notes} onChange={set("notes")} className="field" placeholder="e.g. near the university, good for work trips" />
        </label>
      </div>

      {sameCountry.length > 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
            ⭐ Places you stayed before in {countryName(f.countryCode)} (click to use)
          </p>
          <div className="flex flex-wrap gap-2">
            {sameCountry.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setF((x) => ({ ...x, name: s.name, kind: s.kind, city: s.city ?? x.city, address: s.address ?? x.address, link: s.link ?? x.link }))}
                className="rounded-full border border-line bg-white px-3 py-1 text-sm hover:border-gold"
              >
                {STAY_ICON[s.kind] ?? "📍"} {s.name}
                {s.rating ? <span className="ml-1 text-gold">{"★".repeat(s.rating)}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {place && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Find a place in {place}:</span>
          {findLinks(f.city ? place : countryName(f.countryCode), f.checkIn, f.checkOut).map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener" className="btn btn-ghost !px-3 !py-1 text-xs">
              🔎 {l.label}
            </a>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4">
        <DocumentPicker
          name="file"
          inputRef={fileRef}
          label="Booking confirmation or photo (optional)"
          saved={stay?.hasFile ? { url: `/api/stays/${stay.id}/file`, name: stay.fileName, image: isImageName(stay.fileName, stay.mime) } : null}
        />
        <button type="button" onClick={readBooking} disabled={reading} className="btn btn-gold mt-3">
          {reading ? "Reading…" : "✨ Read details from booking (PDF)"}
        </button>
        {readMsg.ok && <p className="mt-2 text-sm font-medium text-ok">{readMsg.ok}</p>}
        {readMsg.error && <p className="mt-2 text-sm font-medium text-danger">{readMsg.error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…">{stay ? "Save stay" : "Add stay"}</SubmitButton>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Cancel
        </button>
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

/** "Where I stayed": hotels, Airbnb homes, … for every visit, grouped by country. */
export function StaySection({
  profileId,
  stays,
  trips,
  canDelete,
}: {
  profileId: string;
  stays: Stay[];
  trips: StayTrip[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null); // stay id, "new" or "new:<tripId>"
  const [saved, setSaved] = useState("");
  const tripLabel = (id: string | null) => trips.find((t) => t.id === id)?.label;

  // Hotels typed in the immigration record ("Where you stayed") that have no full stay yet: listed automatically.
  const typed = useMemo(
    () =>
      trips.filter(
        (t) => t.stayedAt?.trim() && !stays.some((s) => s.tripId === t.id && s.name.toLowerCase() === t.stayedAt!.trim().toLowerCase()),
      ),
    [trips, stays],
  );

  const groups = useMemo(() => {
    const m = new Map<string, { stays: Stay[]; typed: StayTrip[] }>();
    const get = (c: string) => m.get(c) ?? (m.set(c, { stays: [], typed: [] }), m.get(c)!);
    for (const s of stays) get(s.countryCode ? countryName(s.countryCode) : "Other").stays.push(s);
    for (const t of typed) get(countryName(t.countryCode)).typed.push(t);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [stays, typed]);

  const done = (msg: string) => () => {
    setEditing(null);
    setSaved(msg);
  };

  const card = (s: Stay) => {
    const nights = stayNights(s);
    return (
      <article key={s.id} className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy text-xl" aria-hidden>
            {STAY_ICON[s.kind] ?? "📍"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy">
              {s.name}
              {s.rating ? <span className="ml-2 text-sm text-gold">{"★".repeat(s.rating)}</span> : null}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">{s.kind}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {[s.city, s.countryCode && countryName(s.countryCode)].filter(Boolean).join(", ")}
              {s.address && <span className="block">{s.address}</span>}
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {fmt(s.checkIn)} → {fmt(s.checkOut)}
              {nights !== null && <span className="text-ink-soft"> · {nights} night{nights === 1 ? "" : "s"}</span>}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {s.tripId ? `Visit: ${tripLabel(s.tripId) ?? "recorded visit"}` : "Not linked to a visit"}
              {s.bookingRef && <span className="font-mono"> · Booking {s.bookingRef}</span>}
            </p>
            {s.notes && <p className="mt-1 text-xs text-ink-soft">{s.notes}</p>}
          </div>
        </div>
        {s.hasFile && isImageName(s.fileName, s.mime) && (
          <a href={`/api/stays/${s.id}/file`} target="_blank" rel="noopener" className="mt-3 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/stays/${s.id}/file`} alt="Booking" loading="lazy" className="max-h-40 w-full rounded-xl bg-paper object-contain" />
          </a>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent([s.name, s.address, s.city, s.countryCode && countryName(s.countryCode)].filter(Boolean).join(", "))}`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost !px-3 !py-1.5 text-xs"
          >
            📍 Map
          </a>
          {s.link && (
            <a href={s.link} target="_blank" rel="noopener" className="btn btn-ghost !px-3 !py-1.5 text-xs">
              🔗 Booking page
            </a>
          )}
          {s.hasFile && (
            <a href={`/api/stays/${s.id}/file`} target="_blank" rel="noopener" className="btn btn-ghost !px-3 !py-1.5 text-xs">
              📄 Confirmation
            </a>
          )}
          <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} className="btn btn-primary !px-3 !py-1.5 text-xs">
            {editing === s.id ? "Close" : "✏️ Update"}
          </button>
          {canDelete && (
            <form action={deleteStay.bind(null, s.id)}>
              <ConfirmButton message={`Delete the stay at ${s.name}? (You can get it back from Backup & recovery.)`} className="btn btn-danger !px-3 !py-1.5 text-xs">
                Delete
              </ConfirmButton>
            </form>
          )}
        </div>
        {editing === s.id && (
          <div className="mt-4 border-t border-line pt-4">
            <StayForm profileId={profileId} stay={s} trips={trips} allStays={stays} onDone={done("✓ Stay updated.")} />
          </div>
        )}
      </article>
    );
  };

  // Visits without a stay yet (newest first): quick "+ Add stay" for previous visits.
  const linked = new Set(stays.map((s) => s.tripId));
  const missing = trips.filter((t) => !linked.has(t.id) && !t.stayedAt?.trim());

  return (
    <section id="stays" className="panel scroll-mt-24 p-6 sm:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Where I stayed</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Hotels &amp; Airbnb homes</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Hotels, Airbnb homes and other places you stayed on each visit (tour, study or work). They also show under each visit in the immigration record.
          </p>
        </div>
        {editing !== "new" && (
          <button type="button" onClick={() => { setEditing("new"); setSaved(""); }} className="btn btn-gold ml-auto">
            + Add hotel / Airbnb
          </button>
        )}
      </div>
      {saved && <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-ok">{saved}</p>}

      {(editing === "new" || editing?.startsWith("new:")) && (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-gold/50 bg-white p-5">
          <h3 className="mb-4 font-serif text-lg font-bold text-navy">Add a place you stayed</h3>
          <StayForm
            key={editing}
            profileId={profileId}
            trips={trips}
            allStays={stays}
            startTrip={editing.startsWith("new:") ? editing.slice(4) : undefined}
            onDone={done("✓ Stay added.")}
          />
        </div>
      )}

      <div className="mt-6 space-y-6">
        {groups.length ? (
          <CountrySearch placeholder="Search a country, city or hotel…">
            {groups.map(([country, g]) => {
              const n = g.stays.length + g.typed.length;
              return (
                <div
                  key={country}
                  data-search={`${country} ${g.stays.map((s) => `${s.city ?? ""} ${s.name}`).join(" ")} ${g.typed.map((t) => t.stayedAt).join(" ")}`}
                  className="space-y-3"
                >
                  <h3 className="font-serif text-lg font-bold text-navy">
                    {country} <span className="text-sm font-normal text-ink-soft">· {n} place{n === 1 ? "" : "s"}</span>
                  </h3>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {g.stays.map(card)}
                    {g.typed.map((t) => (
                      <article key={`typed-${t.id}`} className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-paper/40 p-4">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy text-xl" aria-hidden>
                          🏨
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-navy">{t.stayedAt}</p>
                          {t.stayedAddress && <p className="text-sm text-ink-soft">{t.stayedAddress}</p>}
                          <p className="text-xs text-ink-soft">From the immigration record · {t.label}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={`https://www.google.com/maps/search/${encodeURIComponent(`${t.stayedAt}, ${t.stayedAddress ? `${t.stayedAddress}, ` : t.city ? `${t.city}, ` : ""}${countryName(t.countryCode)}`)}`}
                              target="_blank"
                              rel="noopener"
                              className="btn btn-ghost !px-3 !py-1.5 text-xs"
                            >
                              📍 Map
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(`new:${t.id}`);
                                setSaved("");
                                document.getElementById("stays")?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="btn btn-primary !px-3 !py-1.5 text-xs"
                            >
                              + Add details (dates, address, booking)
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </CountrySearch>
        ) : (
          <p className="text-sm text-ink-soft">No stays yet. Press &ldquo;+ Add hotel / Airbnb&rdquo;, or pick a visit below.</p>
        )}

        {missing.length > 0 && (
          <details className="rounded-2xl border border-line bg-paper/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-navy">
              🧳 Previous visits without a stay yet ({missing.length}): add where you stayed
            </summary>
            <ul className="mt-3 divide-y divide-line">
              {missing.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="mr-auto">{t.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(`new:${t.id}`);
                      setSaved("");
                      document.getElementById("stays")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="btn btn-ghost !px-3 !py-1 text-xs"
                  >
                    + Add stay
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
