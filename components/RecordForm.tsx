"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveImport, updateRecord, type ImportProfile, type ImportTrip } from "@/lib/actions";
import { CountrySelect } from "./CountrySelect";
import { PhotoInput } from "./PhotoInput";
import { Flag } from "./Flag";
import { EMPTY_PROFILE } from "@/lib/record";
import { NationalitySelect } from "./NationalitySelect";

type Visit = { key: number; id?: string | null; departureDate: string; returnDate: string; purpose: string; passportNumber: string; notes: string };
type CountryBlock = { key: number; countryCode: string; city: string; visits: Visit[] };

// Rows added by the user get keys from this counter (client-only, after hydration).
// Initial rows use fixed keys (see toBlocks) so server and browser HTML match.
let seq = 1_000_000;
const nextKey = () => seq++;
const emptyVisit = (): Visit => ({ key: nextKey(), departureDate: "", returnDate: "", purpose: "", passportNumber: "", notes: "" });
const emptyCountry = (): CountryBlock => ({ key: nextKey(), countryCode: "", city: "", visits: [emptyVisit()] });



/** Groups flat trips into country blocks (same country → one block), in order of first visit. */
function toBlocks(trips: ImportTrip[]): CountryBlock[] {
  let k = 0;
  const key = () => ++k; // deterministic keys for the first render
  const blocks = new Map<string, CountryBlock>();
  for (const t of [...trips].sort((a, b) => (a.departureDate || "").localeCompare(b.departureDate || ""))) {
    const id = `${t.countryCode}|${t.city ?? ""}`;
    let block = blocks.get(id);
    if (!block) {
      block = { key: key(), countryCode: t.countryCode, city: t.city ?? "", visits: [] };
      blocks.set(id, block);
    }
    block.visits.push({
      key: key(),
      id: t.id ?? null,
      departureDate: t.departureDate ?? "",
      returnDate: t.returnDate ?? "",
      purpose: t.purpose ?? "",
      passportNumber: t.passportNumber ?? "",
      notes: t.notes ?? "",
    });
  }
  return blocks.size
    ? [...blocks.values()]
    : [{ key: key(), countryCode: "", city: "", visits: [{ key: key(), departureDate: "", returnDate: "", purpose: "", passportNumber: "", notes: "" }] }];
}

const PROFILE_FIELDS: { key: keyof Omit<ImportProfile, "previousPassports" | "photo">; label: string; type?: string; wide?: boolean }[] = [
  { key: "fullName", label: "Full name *", wide: true },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "sex", label: "Sex" },
  { key: "nationality", label: "Nationality" },
  { key: "phone", label: "Phone number", type: "tel" },
  { key: "email", label: "Email", type: "email", wide: true },
  { key: "address", label: "Address", wide: true },
  { key: "nationalId", label: "ID number (NIC)" },
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
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
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
    const trips: ImportTrip[] = [];
    for (const b of blocks) {
      for (const v of b.visits) {
        const empty = !v.departureDate && !v.returnDate && !v.purpose && !v.passportNumber && !v.notes;
        if (empty) continue;
        if (!b.countryCode) return setError("Choose a country for every section that has visits.");
        if (!v.departureDate) return setError("Every visit needs a departure date.");
        trips.push({
          id: v.id ?? null,
          countryCode: b.countryCode,
          city: b.city || null,
          departureDate: v.departureDate,
          returnDate: v.returnDate || null,
          purpose: v.purpose,
          passportNumber: v.passportNumber || null,
          notes: v.notes || null,
        });
      }
    }
    if (saveTo === "new" && !profile.fullName?.trim()) return setError("Full name is required.");
    startSaving(async () => {
      const result = updateId
        ? await updateRecord(updateId, { profile, trips })
        : await saveImport(saveTo, { profile, trips });
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
  const [partSaving, setPartSaving] = useState<"card" | "record" | null>(null);

  async function savePart(part: "card" | "record") {
    if (!updateId) return;
    setPartMsg((m) => ({ ...m, [part]: undefined }));
    const trips: ImportTrip[] = [];
    if (part === "record") {
      for (const b of blocks) {
        for (const v of b.visits) {
          const empty = !v.departureDate && !v.returnDate && !v.purpose && !v.passportNumber && !v.notes;
          if (empty) continue;
          if (!b.countryCode) return setPartMsg((m) => ({ ...m, record: { error: "Choose a country for every section that has visits." } }));
          if (!v.departureDate) return setPartMsg((m) => ({ ...m, record: { error: "Every visit needs a departure date." } }));
          trips.push({
            id: v.id ?? null,
            countryCode: b.countryCode,
            city: b.city || null,
            departureDate: v.departureDate,
            returnDate: v.returnDate || null,
            purpose: v.purpose,
            passportNumber: v.passportNumber || null,
            notes: v.notes || null,
          });
        }
      }
    } else if (!profile.fullName?.trim()) {
      return setPartMsg((m) => ({ ...m, card: { error: "Full name is required." } }));
    }
    setPartSaving(part);
    try {
      const result = await updateRecord(updateId, { profile, trips }, part);
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
                  <label key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                    <span className="field-label">{f.label}</span>
                    <input
                      type={f.type ?? "text"}
                      value={profile[f.key] ?? ""}
                      onChange={(e) =>
                        setProfile({ ...profile, [f.key]: (f.key === "passportNumber" || f.key === "nationalId" ? e.target.value.toUpperCase() : e.target.value) || null })
                      }
                      className={`field ${f.key === "passportNumber" ? "font-mono uppercase" : ""}`}
                    />
                  </label>
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
            Choose a country, then use <b>+</b> / <b>−</b> next to “No. of visits” to add or remove visit rows.
          </p>
        </div>

        <div className="divide-y divide-line">
          {blocks.map((b, bi) => {
            return (
              <div key={b.key} className={`p-5 sm:p-6 ${bi % 2 ? "bg-paper/50" : ""}`}>
                <div className="flex flex-wrap items-end gap-4">
                  {b.countryCode && <Flag code={b.countryCode} className="mb-1 h-9 w-14" />}
                  <div className="min-w-56 flex-1">
                    <span className="field-label">Country</span>
                    <CountrySelect key={b.key} name={`country-${b.key}`} defaultValue={b.countryCode} onChange={(code) => setBlock(b.key, { countryCode: code })} />
                  </div>
                  <label className="w-48">
                    <span className="field-label">City (optional)</span>
                    <input value={b.city} onChange={(e) => setBlock(b.key, { city: e.target.value })} className="field" placeholder="e.g. Dubai" />
                  </label>
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
                    Remove country
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                        <th className="pb-2 pr-2">#</th>
                        <th className="pb-2 pr-2">Departure date *</th>
                        <th className="pb-2 pr-2">Return date</th>
                        <th className="pb-2 pr-2">Purpose</th>
                        <th className="pb-2 pr-2">Passport used</th>
                        <th className="pb-2 pr-2">Notes</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {b.visits.map((v, vi) => (
                        <tr key={v.key}>
                          <td className="py-1 pr-2 text-ink-soft">{vi + 1}</td>
                          <td className="py-1 pr-2">
                            <input type="date" value={v.departureDate} onChange={(e) => setVisit(b.key, v.key, { departureDate: e.target.value })} className="field !py-2" />
                          </td>
                          <td className="py-1 pr-2">
                            <input type="date" value={v.returnDate} onChange={(e) => setVisit(b.key, v.key, { returnDate: e.target.value })} className="field !py-2" />
                          </td>
                          <td className="py-1 pr-2">
                            <input value={v.purpose} list="purpose-options" onChange={(e) => setVisit(b.key, v.key, { purpose: e.target.value })} className="field !py-2" placeholder="Tour" />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              value={v.passportNumber}
                              list="passport-options"
                              onChange={(e) => setVisit(b.key, v.key, { passportNumber: e.target.value.toUpperCase() })}
                              className="field !py-2 font-mono uppercase"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input value={v.notes} onChange={(e) => setVisit(b.key, v.key, { notes: e.target.value })} className="field !py-2" />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              aria-label="Remove visit"
                              onClick={() =>
                                setBlock(b.key, { visits: b.visits.length === 1 ? [emptyVisit()] : b.visits.filter((x) => x.key !== v.key) })
                              }
                              className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-danger"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setBlock(b.key, { visits: [...b.visits, emptyVisit()] })} className="mt-3 text-sm font-semibold text-navy-2 hover:underline">
                  + Add another visit to {b.countryCode ? "this country" : "this country"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line bg-paper/60 px-6 py-4">
          <button type="button" onClick={() => setBlocks((list) => [...list, emptyCountry()])} className="btn btn-ghost">
            + Add country
          </button>
        </div>
        {updateId && (
          <div className="px-6 pb-6">
            <PartButton part="record" label="Save immigration record" />
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

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-xl backdrop-blur">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary !px-6 !py-3">
          {saving ? "Saving…" : saveLabel}
        </button>
        <span className="text-sm text-ink-soft">
          {blocks.filter((b) => b.countryCode).length} countries · {visitCount} visits
        </span>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        {saved && <p className="text-sm font-medium text-ok">{saved}</p>}
      </div>
    </div>
  );
}
