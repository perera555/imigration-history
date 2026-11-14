"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  readDocument,
  saveImport,
  type ExtractState,
  type ImportProfile,
  type ImportTrip,
} from "@/lib/actions";
import { COUNTRIES, flagSvg } from "@/lib/countries";
import { SubmitButton } from "./SubmitButton";

type Row = ImportTrip & { keep: boolean; key: number };

const PROFILE_FIELDS: { key: keyof Omit<ImportProfile, "previousPassports">; label: string; type?: string }[] = [
  { key: "fullName", label: "Full name" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "sex", label: "Sex" },
  { key: "nationality", label: "Nationality" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "passportNumber", label: "Current passport" },
  { key: "address", label: "Address" },
];

export function DocumentImport({
  profiles,
  defaultTarget,
}: {
  profiles: { id: string; fullName: string }[];
  defaultTarget: string;
}) {
  const [state, action] = useActionState<ExtractState, FormData>(readDocument, undefined);
  const [target, setTarget] = useState(defaultTarget);
  const [profile, setProfile] = useState<ImportProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      setProfile({ ...state.profile, previousPassports: state.profile.previousPassports.slice(0, 10) });
      setRows(state.trips.map((t, i) => ({ ...t, keep: true, key: i })));
      setSaveError("");
    }
  }, [state]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function save() {
    if (!profile) return;
    setSaveError("");
    startSaving(async () => {
      const result = await saveImport(target, {
        profile,
        trips: rows.filter((r) => r.keep).map(({ keep: _k, key: _i, ...t }) => t),
      });
      if ("error" in result) setSaveError(result.error);
      else router.push(`/admin/profiles/${result.profileId}?imported=1#trips`);
    });
  }

  const kept = rows.filter((r) => r.keep).length;

  return (
    <div className="space-y-8">
      {/* Step 1: upload */}
      <section className="panel p-6 sm:p-8">
        <h2 className="font-serif text-xl font-bold text-navy">1. Upload a document</h2>
        <p className="mt-1 text-sm text-ink-soft">
          PDF or photo of an immigration history, travel record or passport page. The app reads it and fills the form below
          for you to check.
        </p>
        <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <SubmitButton className="btn btn-gold" pendingText="Reading document… (up to a minute)">
            Read document
          </SubmitButton>
        </form>
        {state && "error" in state && <p className="mt-3 text-sm font-medium text-danger">{state.error}</p>}
      </section>

      {profile && (
        <>
          {state && "ok" in state && state.issues.length > 0 && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">Please check these points from the document:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Step 2: personal details */}
          <section className="panel p-6 sm:p-8">
            <h2 className="font-serif text-xl font-bold text-navy">2. Check the travel card details</h2>
            <label className="mt-4 block max-w-md">
              <span className="field-label">Save into</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="field">
                <option value="new">➕ Create a new traveller profile</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} (fill empty fields only)
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {PROFILE_FIELDS.map((f) => (
                <label key={f.key} className={f.key === "address" ? "sm:col-span-2" : ""}>
                  <span className="field-label">{f.label}</span>
                  <input
                    type={f.type ?? "text"}
                    value={profile[f.key] ?? ""}
                    onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value || null })}
                    className="field"
                  />
                </label>
              ))}
              <label className="sm:col-span-2">
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
                />
              </label>
            </div>
          </section>

          {/* Step 3: trips */}
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
              <h2 className="font-serif text-xl font-bold text-navy">3. Check the trips</h2>
              <span className="text-sm text-ink-soft">
                {kept} of {rows.length} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  setRows((list) => [
                    ...list,
                    { key: Date.now(), keep: true, countryCode: "", city: null, departureDate: "", returnDate: null, purpose: "", passportNumber: null, notes: null },
                  ])
                }
                className="btn btn-ghost ml-auto !py-1.5"
              >
                + Add row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-navy text-left text-[11px] uppercase tracking-[0.12em] text-gold-soft">
                  <tr>
                    <th className="px-3 py-3">Save</th>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">City</th>
                    <th className="px-3 py-3">Departure</th>
                    <th className="px-3 py-3">Return</th>
                    <th className="px-3 py-3">Purpose</th>
                    <th className="px-3 py-3">Passport</th>
                    <th className="px-3 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.key} className={r.keep ? "" : "opacity-40"}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.keep} onChange={(e) => update(r.key, { keep: e.target.checked })} className="size-4 accent-navy" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.countryCode && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={flagSvg(r.countryCode)} alt="" className="h-4 w-6 rounded-[2px] object-cover" />
                          )}
                          <select value={r.countryCode} onChange={(e) => update(r.key, { countryCode: e.target.value })} className="field !py-1.5 !text-sm">
                            <option value="">Choose…</option>
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input value={r.city ?? ""} onChange={(e) => update(r.key, { city: e.target.value || null })} className="field !py-1.5 !text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" value={r.departureDate} onChange={(e) => update(r.key, { departureDate: e.target.value })} className="field !py-1.5 !text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" value={r.returnDate ?? ""} onChange={(e) => update(r.key, { returnDate: e.target.value || null })} className="field !py-1.5 !text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={r.purpose} onChange={(e) => update(r.key, { purpose: e.target.value })} className="field !py-1.5 !text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={r.passportNumber ?? ""} onChange={(e) => update(r.key, { passportNumber: e.target.value.toUpperCase() || null })} className="field !py-1.5 font-mono !text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={r.notes ?? ""} onChange={(e) => update(r.key, { notes: e.target.value || null })} className="field !py-1.5 !text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary !px-6 !py-3">
              {saving ? "Saving…" : `Save profile & ${kept} trips`}
            </button>
            {saveError && <p className="text-sm font-medium text-danger">{saveError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
