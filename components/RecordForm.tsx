"use client";

import { DateInput } from "./DateInput";
import { useEffect, useRef, useState, useTransition } from "react";
import { CityInput } from "./CityInput";
import { HotelInput } from "./HotelInput";
import { useRouter } from "next/navigation";
import { saveImport, updateRecord, type ImportProfile, type ImportTrip } from "@/lib/actions";
import { CountrySelect } from "./CountrySelect";
import { PhotoInput } from "./PhotoInput";
import { Flag } from "./Flag";
import { EMPTY_PROFILE } from "@/lib/record";
import { CountryNameSelect, NationalitySelect } from "./NationalitySelect";
import { flagSvg, isSchengen } from "@/lib/countries";
import { useToastOn } from "./Toaster";

const visitDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : d;

type Visit = {
  key: number;
  id?: string | null;
  /** Schengen trip: the saved trip id for each country (one trip per country, same dates). */
  ids?: Record<string, string>;
  departureDate: string;
  returnDate: string;
  purpose: string;
  passportNumber: string;
  notes: string;
  /** City of this visit (each visit to the same country can be in a different city). */
  city?: string;
  /** Hotel / Airbnb home stayed on this visit. */
  stayedAt?: string;
  stayedAddress?: string;
};
type CountryBlock = {
  key: number;
  countryCode: string;
  city: string;
  visits: Visit[];
  /** Schengen trip: several Schengen countries visited on the same dates, under one Schengen visa. */
  schengen?: boolean;
  codes?: { key: number; code: string }[];
};

// Rows added by the user get keys from this counter (client-only, after hydration).
// Initial rows use fixed keys (see toBlocks) so server and browser HTML match.
let seq = 1_000_000;
const nextKey = () => seq++;
const emptyVisit = (): Visit => ({ key: nextKey(), departureDate: "", returnDate: "", purpose: "", passportNumber: "", notes: "" });
const emptyCountry = (): CountryBlock => ({ key: nextKey(), countryCode: "", city: "", visits: [emptyVisit()] });
const emptySchengen = (): CountryBlock => ({
  key: nextKey(),
  countryCode: "",
  city: "",
  schengen: true,
  codes: [{ key: nextKey(), code: "" }],
  visits: [emptyVisit()],
});

/**
 * Groups flat trips into blocks in order of first visit: one block per country, except
 * Schengen countries visited on the same dates, which become one Schengen block
 * (e.g. Netherlands + Belgium + France, 14–21 Feb 2018).
 */
function toBlocks(trips: ImportTrip[]): CountryBlock[] {
  let k = 0;
  const key = () => ++k; // deterministic keys for the first render
  const sorted = [...trips].sort((a, b) => (a.departureDate || "").localeCompare(b.departureDate || ""));

  // Schengen trips grouped by their dates: which countries, and each country's trip id.
  const byDate = new Map<string, { codes: string[]; ids: Record<string, string> }>();
  for (const t of sorted) {
    if (!isSchengen(t.countryCode)) continue;
    const d = `${t.departureDate}|${t.returnDate ?? ""}`;
    const g = byDate.get(d) ?? { codes: [], ids: {} };
    if (!g.codes.includes(t.countryCode)) g.codes.push(t.countryCode);
    if (t.id) g.ids[t.countryCode] = t.id;
    byDate.set(d, g);
  }

  const blocks = new Map<string, CountryBlock>();
  const doneDates = new Set<string>();
  for (const t of sorted) {
    const visit = (extra: Partial<Visit>): Visit => ({
      key: key(),
      id: t.id ?? null,
      departureDate: t.departureDate ?? "",
      returnDate: t.returnDate ?? "",
      purpose: t.purpose ?? "",
      passportNumber: t.passportNumber ?? "",
      notes: t.notes ?? "",
      city: t.city ?? "",
      stayedAt: t.stayedAt ?? "",
      stayedAddress: t.stayedAddress ?? "",
      ...extra,
    });
    if (isSchengen(t.countryCode)) {
      const d = `${t.departureDate}|${t.returnDate ?? ""}`;
      if (doneDates.has(d)) continue;
      doneDates.add(d);
      const g = byDate.get(d)!;
      const id = `schengen|${g.codes.join(",")}`;
      let block = blocks.get(id);
      if (!block) {
        block = { key: key(), countryCode: "", city: "", schengen: true, codes: g.codes.map((code) => ({ key: key(), code })), visits: [] };
        blocks.set(id, block);
      }
      block.visits.push(visit({ id: null, ids: g.ids }));
      continue;
    }
    // One section per country; each visit keeps its own city.
    const id = t.countryCode;
    let block = blocks.get(id);
    if (!block) {
      block = { key: key(), countryCode: t.countryCode, city: "", visits: [] };
      blocks.set(id, block);
    }
    block.visits.push(visit({}));
  }
  return blocks.size
    ? [...blocks.values()]
    : [{ key: key(), countryCode: "", city: "", visits: [{ key: key(), departureDate: "", returnDate: "", purpose: "", passportNumber: "", notes: "" }] }];
}

/** Turns the form blocks into trips; a Schengen visit becomes one trip per Schengen country. */
function collectTrips(blocks: CountryBlock[]): { trips: ImportTrip[] } | { error: string } {
  const trips: ImportTrip[] = [];
  for (const b of blocks) {
    const codes = b.schengen ? [...new Set((b.codes ?? []).map((c) => c.code).filter(Boolean))] : [b.countryCode];
    for (const v of b.visits) {
      const empty = !v.departureDate && !v.returnDate && !v.purpose && !v.passportNumber && !v.notes && !v.city && !v.stayedAt && !v.stayedAddress;
      if (empty) continue;
      if (b.schengen && !codes.length) return { error: "Add the Schengen countries you travelled to." };
      if (!b.schengen && !b.countryCode) return { error: "Choose a country for every section that has visits." };
      if (!v.departureDate) return { error: "Every visit needs a departure date." };
      for (const code of codes) {
        trips.push({
          id: b.schengen ? (v.ids?.[code] ?? null) : (v.id ?? null),
          countryCode: code,
          city: b.schengen ? null : v.city?.trim() || b.city || null,
          departureDate: v.departureDate,
          returnDate: v.returnDate || null,
          purpose: v.purpose,
          passportNumber: v.passportNumber || null,
          notes: v.notes || null,
          stayedAt: v.stayedAt || null,
          stayedAddress: v.stayedAddress || null,
        });
      }
    }
  }
  return { trips };
}

const PROFILE_FIELDS: { key: keyof Omit<ImportProfile, "previousPassports" | "photo">; label: string; type?: string; wide?: boolean }[] = [
  { key: "fullName", label: "Full name *", wide: true },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "sex", label: "Sex" },
  { key: "nationality", label: "Nationality" },
  { key: "citizenship", label: "Citizenship" },
  { key: "otherCitizenship", label: "Other country citizenship (dual, optional)" },
  { key: "phone", label: "Phone number", type: "tel" },
  { key: "phone2", label: "Second phone number (optional)", type: "tel" },
  { key: "whatsapp", label: "WhatsApp number (optional)", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "email2", label: "Other email (optional)", type: "email" },
  { key: "address", label: "Address", wide: true },
  { key: "nationalId", label: "ID number (NIC)" },
  { key: "tin", label: "TIN – tax number (optional)" },
  { key: "passportNumber", label: "Current passport number" },
  { key: "passportIssueDate", label: "Passport issue date", type: "date" },
  { key: "passportExpiryDate", label: "Passport expiry date", type: "date" },
];

export function RecordForm({
  target,
  targets,
  initialProfile,
  initialTrips,
  showProfile = true,
  saveLabel = "Save record",
  stayOnPage = false,
  updateId,
  afterUpdateHref,
}: {
  /** Update mode: replace this record (card + all visits) with the form contents. */
  updateId?: string;
  afterUpdateHref?: string;
  /** Clear the form and refresh in place after saving (used on an existing record's page). */
  stayOnPage?: boolean;
  /** "new" to create a traveller, or an existing profile id */
  target: string;
  /** Optional choice of where to save (admins) */
  targets?: { value: string; label: string }[];
  initialProfile?: ImportProfile;
  initialTrips?: ImportTrip[];
  showProfile?: boolean;
  saveLabel?: string;
}) {
  const router = useRouter();
  const [saveTo, setSaveTo] = useState(target);
  const [profile, setProfile] = useState<ImportProfile>(initialProfile ?? EMPTY_PROFILE);
  const [blocks, setBlocks] = useState<CountryBlock[]>(() => toBlocks(initialTrips ?? []));
  // Hotels already saved in the record, per country (suggestions for the Hotel / Airbnb field).
  const [savedHotels, setSavedHotels] = useState<Record<string, { name: string; address: string | null }[]>>({});
  const countriesKey = [...new Set(blocks.map((b) => b.countryCode).filter(Boolean))].sort().join(",");
  // The record being edited: the Update page (updateId) or the user's own page (target).
  const recordId = updateId ?? (/^[0-9a-f-]{36}$/i.test(target) ? target : null);
  useEffect(() => {
    if (!recordId) return;
    for (const code of countriesKey.split(",").filter(Boolean)) {
      if (savedHotels[code]) continue;
      fetch(`/api/profiles/${recordId}/hotels?country=${code}`)
        .then((r) => (r.ok ? r.json() : { hotels: [] }))
        .then((d: { hotels?: { name: string; address: string | null }[] }) => setSavedHotels((m) => ({ ...m, [code]: d.hotels ?? [] })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countriesKey, recordId]);
  /** Hotel suggestions for a country block: saved ones plus ones typed on visits to the same country. */
  const hotelsFor = (b: CountryBlock) => {
    const typed = blocks
      .filter((x) => x.countryCode === b.countryCode)
      .flatMap((x) => x.visits)
      .filter((v) => v.stayedAt?.trim())
      .map((v) => ({ name: v.stayedAt!.trim(), address: v.stayedAddress?.trim() || null }));
    const seen = new Set<string>();
    return [...(savedHotels[b.countryCode] ?? []), ...typed].filter((h) => !seen.has(h.name.toLowerCase()) && !!seen.add(h.name.toLowerCase()));
  };
  // Visit cards: a filled visit starts as a short row (open it with "Update"); a new, empty one starts open.
  // Decided once per visit, so typing a date doesn't fold the card while it is being filled.
  const visitOpen = useRef(new Map<string | number, boolean>());
  const startsOpen = (key: string | number, departure: string) => {
    if (!visitOpen.current.has(key)) visitOpen.current.set(key, !departure);
    return visitOpen.current.get(key);
  };
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  // Success pop-ups come from the server ("Record saved successfully"); errors pop up here.
  useToastOn(null, error);
  const [saving, startSaving] = useTransition();

  const setBlock = (key: number, patch: Partial<CountryBlock>) =>
    setBlocks((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const setVisit = (blockKey: number, visitKey: number, patch: Partial<Visit>) =>
    setBlocks((list) =>
      list.map((b) =>
        b.key === blockKey ? { ...b, visits: b.visits.map((v) => (v.key === visitKey ? { ...v, ...patch } : v)) } : b,
      ),
    );

  const passports = [profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p);

  function save() {
    setError("");
    setSaved("");
    // Skip completely empty rows; every other row needs a country and departure date.
    const collected = collectTrips(blocks);
    if ("error" in collected) return setError(collected.error);
    const trips = collected.trips;
    if (saveTo === "new" && !profile.fullName?.trim()) return setError("Full name is required.");
    startSaving(async () => {
      let result: Awaited<ReturnType<typeof saveImport>>;
      try {
        result = updateId
          ? await updateRecord(updateId, { profile, trips })
          : await saveImport(saveTo, { profile, trips });
      } catch {
        setError("Couldn't save (no answer from the server). Please check your connection and press Save again.");
        return;
      }
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const skipped = result.skipped ?? 0;
      const plural = (n: number) => `${n} visit${n === 1 ? " was" : "s were"}`;
      if (updateId) {
        // Save / Update record: travel card + all visits saved together; stay on the page.
        // Reload the whole page with fresh data from the database.
        router.replace(`?saved=all&visits=${trips.length - skipped}&merged=${skipped}`, { scroll: false });
        router.refresh();
      } else if (stayOnPage) {
        const added = "added" in result ? (result.added ?? trips.length) : trips.length;
        setBlocks([emptyCountry()]);
        setSaved(
          `✓ Saved ${added} new visit${added === 1 ? "" : "s"}.` +
            (skipped ? ` ${plural(skipped)} already in the record and not added again.` : ""),
        );
        router.refresh();
      } else {
        if (skipped) window.alert(`${plural(skipped)} already in the record and not added again.`);
        router.push(`/profiles/${result.profileId}`);
      }
    });
  }

  // Update mode: save the travel card and the immigration record separately.
  const [partMsg, setPartMsg] = useState<{ card?: { ok?: string; error?: string }; record?: { ok?: string; error?: string } }>({});
  useToastOn(null, partMsg.card?.error ?? partMsg.record?.error);
  const [partSaving, setPartSaving] = useState<"card" | "record" | null>(null);

  async function savePart(part: "card" | "record") {
    if (!updateId) return;
    setPartMsg((m) => ({ ...m, [part]: undefined }));
    let trips: ImportTrip[] = [];
    if (part === "record") {
      const collected = collectTrips(blocks);
      if ("error" in collected) return setPartMsg((m) => ({ ...m, record: { error: collected.error } }));
      trips = collected.trips;
    } else if (!profile.fullName?.trim()) {
      return setPartMsg((m) => ({ ...m, card: { error: "Full name is required." } }));
    }
    setPartSaving(part);
    try {
      let result: Awaited<ReturnType<typeof updateRecord>>;
      try {
        result = await updateRecord(updateId, { profile, trips }, part);
      } catch {
        setPartMsg((m) => ({ ...m, [part]: { error: "Couldn't save (no answer from the server). Please check your connection and press Save again." } }));
        return;
      }
      if ("error" in result) {
        setPartMsg((m) => ({ ...m, [part]: { error: result.error } }));
      } else {
        const skipped = result.skipped ?? 0;
        // Reload the whole page with fresh data from the database.
        router.replace(`?saved=${part}&visits=${trips.length - skipped}&merged=${skipped}`, { scroll: false });
        router.refresh();
      }
    } finally {
      setPartSaving(null);
    }
  }

  const PartButton = ({ part, label }: { part: "card" | "record"; label: string }) => (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <button type="button" onClick={() => savePart(part)} disabled={partSaving !== null} className="btn btn-primary !px-6 !py-3">
        {partSaving === part ? "Saving…" : label}
      </button>
      {partMsg[part]?.ok && <p className="text-sm font-medium text-ok">{partMsg[part]!.ok}</p>}
      {partMsg[part]?.error && <p className="text-sm font-medium text-danger">{partMsg[part]!.error}</p>}
    </div>
  );

  const visitCount = blocks.reduce((n, b) => n + b.visits.filter((v) => v.departureDate).length, 0);

  return (
    <div className="space-y-8">
      {targets && targets.length > 1 && (
        <label className="block max-w-md">
          <span className="field-label">Save into</span>
          <select value={saveTo} onChange={(e) => setSaveTo(e.target.value)} className="field">
            {targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {showProfile && (
        <section id="card" className="panel scroll-mt-24 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Travel card</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Personal details</h2>
          {saveTo !== "new" && !updateId && (
            <p className="mt-1 text-sm text-ink-soft">Only empty fields of the existing record will be filled.</p>
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr]">
            <div>
              <span className="field-label">Photo</span>
              <PhotoInput name="photo" defaultValue={profile.photo} onChange={(photo) => setProfile((p) => ({ ...p, photo: photo || null }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROFILE_FIELDS.map((f) =>
                f.key === "nationality" ? (
                  <div key={f.key}>
                    <span className="field-label">{f.label}</span>
                    <NationalitySelect defaultValue={profile.nationality} onChange={(v) => setProfile((p) => ({ ...p, nationality: v || null }))} />
                  </div>
                ) : f.key === "citizenship" || f.key === "otherCitizenship" ? (
                  <div key={f.key}>
                    <span className="field-label">{f.label}</span>
                    <CountryNameSelect
                      defaultValue={profile[f.key]}
                      placeholder={f.key === "otherCitizenship" ? "None, or choose a country" : undefined}
                      onChange={(v) => setProfile((p) => ({ ...p, [f.key]: v || null }))}
                    />
                  </div>
                ) : f.key === "sex" ? (
                  <label key={f.key}>
                    <span className="field-label">{f.label}</span>
                    <select value={profile.sex ?? ""} onChange={(e) => setProfile({ ...profile, sex: e.target.value || null })} className="field">
                      <option value="">—</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </label>
                ) : (
                  f.type === "date" ? (
                  <label key={f.key}>
                    <span className="field-label">{f.label}</span>
                    <DateInput value={profile[f.key] ?? ""} onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value || null })} />
                  </label>
                  ) : (
                  <label key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                    <span className="field-label">{f.label}</span>
                    <input
                      type={f.type ?? "text"}
                      value={profile[f.key] ?? ""}
                      onChange={(e) =>
                        setProfile({ ...profile, [f.key]: (f.key === "passportNumber" || f.key === "nationalId" || f.key === "tin" ? e.target.value.toUpperCase() : e.target.value) || null })
                      }
                      className={`field ${f.key === "passportNumber" ? "font-mono uppercase" : ""}`}
                    />
                  </label>
                  )
                ),
              )}
              <label>
                <span className="field-label">Previous passports (comma separated, max 10)</span>
                <input
                  value={profile.previousPassports.join(", ")}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      previousPassports: e.target.value.split(",").map((s) => s.trim().toUpperCase()).slice(0, 10),
                    })
                  }
                  className="field font-mono uppercase"
                  placeholder="N1234567, N7654321"
                />
              </label>
            </div>
          </div>
          {updateId && (
            <div className="mt-6">
              <PartButton part="card" label="Save travel card" />
            </div>
          )}
        </section>
      )}

      {/* Immigration record, laid out like the paper form: one section per country, visits listed under it */}
      <section id="record" className="panel scroll-mt-24">
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Immigration record</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Countries & visits</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Choose a country, then use <b>+</b> / <b>−</b> next to “No. of visits” to add or remove visits. Each visit has its own city and hotel.
          </p>
        </div>

        <div className="divide-y divide-line">
          {blocks.map((b, bi) => {
            return (
              <div key={b.key} className={`p-5 sm:p-6 ${bi % 2 ? "bg-paper/50" : ""}`}>
                <div className="flex flex-wrap items-end gap-4">
                  {b.schengen ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flagSvg("eu")} alt="" className="mb-1 h-9 w-14 rounded-md object-cover" />
                      <div className="min-w-56 flex-1">
                        <p className="font-serif text-xl font-bold text-navy">
                          Schengen Area
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-sky-900">
                            Schengen visa
                          </span>
                        </p>
                        <p className="text-xs text-ink-soft">Countries travelled on the same dates under one Schengen visa.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {b.countryCode && <Flag code={b.countryCode} className="mb-1 h-9 w-14" />}
                      <div className="min-w-56 flex-1">
                        <span className="field-label">Country</span>
                        <CountrySelect key={b.key} name={`country-${b.key}`} defaultValue={b.countryCode} onChange={(code) => setBlock(b.key, { countryCode: code })} />
                      </div>
                    </>
                  )}
                  <div className="text-center">
                    <span className="field-label">No. of visits</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Remove last visit"
                        title="Remove last visit"
                        disabled={b.visits.length <= 1}
                        onClick={() => setBlock(b.key, { visits: b.visits.slice(0, -1) })}
                        className="grid size-9 place-items-center rounded-full border border-line bg-white text-lg font-bold text-navy hover:bg-paper-2 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="inline-grid size-11 place-items-center rounded-full bg-navy font-serif text-lg font-bold text-gold-soft">
                        {b.visits.length}
                      </span>
                      <button
                        type="button"
                        aria-label="Add a visit"
                        title="Add a visit"
                        disabled={b.visits.length >= 50}
                        onClick={() => setBlock(b.key, { visits: [...b.visits, emptyVisit()] })}
                        className="grid size-9 place-items-center rounded-full bg-gold text-lg font-bold text-navy hover:brightness-105 disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBlocks((list) => (list.length === 1 ? [emptyCountry()] : list.filter((x) => x.key !== b.key)))}
                    className="btn btn-danger !py-1.5"
                  >
                    {b.schengen ? "Remove Schengen trip" : "Remove country"}
                  </button>
                </div>

                {b.schengen && (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
                    <span className="field-label">Schengen countries travelled</span>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(b.codes ?? []).map((c) => (
                        <div key={c.key} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <CountrySelect
                              name={`schengen-${b.key}-${c.key}`}
                              defaultValue={c.code}
                              onChange={(code) =>
                                setBlock(b.key, { codes: (b.codes ?? []).map((x) => (x.key === c.key ? { ...x, code } : x)) })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="Remove country"
                            onClick={() => setBlock(b.key, { codes: (b.codes ?? []).filter((x) => x.key !== c.key) })}
                            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white hover:text-danger"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBlock(b.key, { codes: [...(b.codes ?? []), { key: nextKey(), code: "" }] })}
                      className="mt-3 text-sm font-semibold text-navy-2 hover:underline"
                    >
                      + Add Schengen country
                    </button>
                    {(b.codes ?? []).some((c) => c.code && !isSchengen(c.code)) && (
                      <p className="mt-1 text-xs font-medium text-amber-700">Some countries chosen here are not in the Schengen Area.</p>
                    )}
                  </div>
                )}

                {/* One card per visit: dates / purpose / passport, then a hotel strip and notes. */}
                <div className="mt-4 space-y-4">
                  {b.visits.map((v, vi) => {
                    const lbl = "mb-2 block text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-ink-soft";
                    return (
                      <details
                        key={v.key}
                        open={startsOpen(v.key, v.departureDate)}
                        className="group rounded-2xl border border-line bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-gold/60 open:shadow-md"
                      >
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-gold-soft" aria-hidden>
                            {vi + 1}
                          </span>
                          <span className="min-w-0 text-sm">
                            <span className="font-semibold text-navy">
                              {v.departureDate ? `${visitDate(v.departureDate)} → ${v.returnDate ? visitDate(v.returnDate) : "…"}` : "New visit: fill in the dates"}
                            </span>
                            {(v.city || v.purpose || v.stayedAt) && (
                              <span className="text-ink-soft"> · {[v.city && `🏙 ${v.city}`, v.purpose, v.stayedAt && `🏨 ${v.stayedAt}`].filter(Boolean).join(" · ")}</span>
                            )}
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-gold-soft">
                              <span className="group-open:hidden">✏️ Update ▾</span>
                              <span className="hidden group-open:inline">Close ▴</span>
                            </span>
                            <button
                              type="button"
                              aria-label="Remove visit"
                              title="Remove this visit"
                              onClick={(e) => {
                                e.preventDefault(); // don't open/close the row
                                setBlock(b.key, { visits: b.visits.length === 1 ? [emptyVisit()] : b.visits.filter((x) => x.key !== v.key) });
                              }}
                              className="grid size-8 place-items-center rounded-full text-lg text-ink-soft hover:bg-red-50 hover:text-danger"
                            >
                              ×
                            </button>
                          </span>
                        </summary>
                        <div className="border-t border-line p-4 sm:p-5">
                        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                          <label>
                            <span className={lbl}>✈ Departure *</span>
                            <DateInput value={v.departureDate} onChange={(e) => setVisit(b.key, v.key, { departureDate: e.target.value })} className="field !py-2" />
                          </label>
                          <label>
                            <span className={lbl}>🏠 Return</span>
                            <DateInput value={v.returnDate} onChange={(e) => setVisit(b.key, v.key, { returnDate: e.target.value })} className="field !py-2" />
                          </label>
                          <label>
                            <span className={lbl}>🎯 Purpose</span>
                            <input value={v.purpose} list="purpose-options" onChange={(e) => setVisit(b.key, v.key, { purpose: e.target.value })} className="field !py-2" placeholder="Tour" />
                          </label>
                          <label>
                            <span className={lbl}>🛂 Passport used</span>
                            <input
                              value={v.passportNumber}
                              list="passport-options"
                              onChange={(e) => setVisit(b.key, v.key, { passportNumber: e.target.value.toUpperCase() })}
                              className="field !py-2 font-mono uppercase"
                            />
                          </label>
                        </div>
                        <div className={`mt-5 grid gap-x-4 gap-y-5 rounded-xl bg-gradient-to-r from-gold/10 via-paper/60 to-transparent p-4 sm:grid-cols-2 ${b.schengen ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
                          {!b.schengen && (
                            <label>
                              <span className={lbl}>🏙 City (optional)</span>
                              <CityInput countryCode={b.countryCode} value={v.city ?? ""} onChange={(city) => setVisit(b.key, v.key, { city })} className="field !py-2" />
                            </label>
                          )}
                          <label>
                            <span className={lbl}>🏨 Hotel / Airbnb (optional)</span>
                            <HotelInput
                              countryCode={b.countryCode}
                              city={v.city ?? ""}
                              value={v.stayedAt ?? ""}
                              saved={hotelsFor(b)}
                              // A hotel from the list: fill its address too.
                              onChange={(name, address) => setVisit(b.key, v.key, { stayedAt: name, ...(address ? { stayedAddress: address } : {}) })}
                              className="field !py-2"
                            />
                          </label>
                          <label>
                            <span className={lbl}>📍 Hotel address (optional)</span>
                            <input
                              value={v.stayedAddress ?? ""}
                              onChange={(e) => setVisit(b.key, v.key, { stayedAddress: e.target.value })}
                              className="field !py-2"
                              placeholder="Street, city"
                            />
                          </label>
                          <label className={b.schengen ? "sm:col-span-2 lg:col-span-1" : ""}>
                            <span className={lbl}>📝 Notes</span>
                            <input value={v.notes} onChange={(e) => setVisit(b.key, v.key, { notes: e.target.value })} className="field !py-2" />
                          </label>
                        </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setBlock(b.key, { visits: [...b.visits, emptyVisit()] })} className="mt-3 text-sm font-semibold text-navy-2 hover:underline">
                  + Add another visit to {b.countryCode ? "this country" : "this country"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line bg-paper/60 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setBlocks((list) => [...list, emptyCountry()])} className="btn btn-ghost">
              + Add country
            </button>
            <button type="button" onClick={() => setBlocks((list) => [...list, emptySchengen()])} className="btn btn-ghost">
              🇪🇺 + Add Schengen trip
            </button>
          </div>
        </div>
        {updateId ? (
          <div className="px-6 pb-6">
            <PartButton part="record" label="💾 Save immigration record" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-5">
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary !px-6 !py-3">
              {saving ? "Saving…" : "💾 Save immigration record"}
            </button>
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            {saved && <p className="text-sm font-medium text-ok">{saved}</p>}
          </div>
        )}
      </section>

      <datalist id="purpose-options">
        {["Tour", "Business", "Business & Tour", "Visit", "Family Visit", "Student", "Work", "Transit", "Medical"].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="passport-options">
        {passports.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary !px-6 !py-3">
          {saving ? "Saving…" : saveLabel}
        </button>
        <span className="text-sm text-ink-soft">
          {blocks.reduce((n, b) => n + (b.schengen ? (b.codes ?? []).filter((c) => c.code).length : b.countryCode ? 1 : 0), 0)} countries · {visitCount} visits
        </span>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        {saved && <p className="text-sm font-medium text-ok">{saved}</p>}
      </div>
    </div>
  );
}
