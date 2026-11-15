"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { readVisaDocument, saveVisa, type VisaSaveState } from "@/lib/visa-actions";
import type { Visa } from "@/lib/data";
import { CountrySelect } from "./CountrySelect";
import { countryName, flagSvg } from "@/lib/countries";
import { SubmitButton } from "./SubmitButton";

const PURPOSES = [
  "Tourism",
  "Business",
  "Study",
  "Work",
  "Family visit",
  "Medical",
  "Transit",
  "Conference / Training",
  "Religious",
  "Sports",
  "Official / Diplomatic",
  "Residence",
  "Working holiday",
];

const TYPES = ["Schengen visa (short stay)", "Schengen visa (national, type D)", "Tourist", "Visit", "Business", "Student", "Work", "Transit", "Family", "Medical", "Working Holiday", "Resident", "e-Visa", "Visa on arrival", "ETA"];

type Fields = {
  countryCode: string;
  visaType: string;
  visaFormat: string;
  visaNumber: string;
  issueDate: string;
  expiryDate: string;
  travelFrom: string;
  travelTo: string;
  purpose: string;
  entries: string;
  stayDays: string;
  issuedAt: string;
  passportNumber: string;
  status: string;
  notes: string;
};

const fromVisa = (v?: Visa, defaultPassport?: string | null, defaultCountry?: string, defaultType?: string): Fields => ({
  countryCode: v?.countryCode ?? defaultCountry ?? "",
  visaType: v?.visaType ?? defaultType ?? "",
  visaFormat: v?.visaFormat ?? "",
  visaNumber: v?.visaNumber ?? "",
  issueDate: v?.issueDate ?? "",
  expiryDate: v?.expiryDate ?? "",
  travelFrom: v?.travelFrom ?? "",
  travelTo: v?.travelTo ?? "",
  purpose: v?.purpose ?? "",
  entries: v?.entries ?? "",
  stayDays: v?.stayDays != null ? String(v.stayDays) : "",
  issuedAt: v?.issuedAt ?? "",
  passportNumber: v ? (v.passportNumber ?? "") : (defaultPassport ?? ""),
  status: v?.status ?? "",
  notes: v?.notes ?? "",
});

export function VisaForm({
  profileId,
  visa,
  passports,
  defaultPassport,
  defaultCountry,
  defaultType,
  schengenCountries,
  onDone,
}: {
  /** Schengen section: the Schengen countries travelled, shown as fields with their flags. */
  schengenCountries?: { code: string; visits: number }[];
  /** Pre-filled visa type for a new visa (e.g. Schengen). */
  defaultType?: string;
  /** Pre-selected country for a new visa (e.g. "+ Add Thailand visa"). */
  defaultCountry?: string;
  profileId: string;
  visa?: Visa;
  passports: string[];
  defaultPassport?: string | null;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<VisaSaveState, FormData>(saveVisa.bind(null, profileId, visa?.id ?? null), undefined);
  const [f, setF] = useState<Fields>(() => fromVisa(visa, defaultPassport, defaultCountry, defaultType));
  const [countryKey, setCountryKey] = useState(0);
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  const [reading, startReading] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  function readDetails() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setReadMsg({ error: "Choose the visa document first." });
    setReadMsg({});
    startReading(async () => {
      const fd = new FormData();
      fd.append("document", file);
      const result = await readVisaDocument(profileId, fd);
      if (!result || "error" in result) return setReadMsg({ error: result?.error ?? "Could not read the document." });
      const d = result.details;
      setF((x) => ({
        ...x,
        countryCode: d.countryCode ?? x.countryCode,
        visaType: d.visaType ?? x.visaType,
        visaFormat: d.visaFormat ?? x.visaFormat,
        visaNumber: d.visaNumber ?? x.visaNumber,
        issueDate: d.issueDate ?? x.issueDate,
        expiryDate: d.expiryDate ?? x.expiryDate,
        travelFrom: d.travelFrom ?? x.travelFrom,
        travelTo: d.travelTo ?? x.travelTo,
        purpose: d.purpose ?? x.purpose,
        entries: d.entries ?? x.entries,
        stayDays: d.stayDays != null ? String(d.stayDays) : x.stayDays,
        issuedAt: d.issuedAt ?? x.issuedAt,
        passportNumber: d.passportNumber ?? x.passportNumber,
      }));
      if (d.countryCode) setCountryKey((k) => k + 1);
      const found = Object.values(d).filter((v) => v !== null).length;
      setReadMsg({ ok: `✓ ${found} detail${found === 1 ? "" : "s"} read from the document. ${result.note ?? ""}` });
    });
  }

  return (
    <form action={action} className="space-y-6">
      {/* 1. Document */}
      <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4">
        <p className="field-label">Visa document (PDF or photo, max 8 MB)</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            name="document"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <button type="button" onClick={readDetails} disabled={reading} className="btn btn-gold">
            {reading ? "Reading…" : "Read details from document"}
          </button>
        </div>
        {visa?.hasDocument && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <a href={`/api/visas/${visa.id}/document`} target="_blank" rel="noopener" className="font-semibold text-navy-2 hover:underline">
              View saved document ({visa.documentName})
            </a>
            <label className="flex items-center gap-1.5 text-ink-soft">
              <input type="checkbox" name="removeDocument" className="accent-navy" /> Remove it
            </label>
          </div>
        )}
        {readMsg.ok && <p className="mt-2 text-sm font-medium text-ok">{readMsg.ok}</p>}
        {readMsg.error && <p className="mt-2 text-sm font-medium text-danger">{readMsg.error}</p>}
      </div>

      {/* Schengen visa: the Schengen countries travelled (from the immigration record) */}
      {schengenCountries && schengenCountries.length > 0 && (
        <div>
          <span className="field-label">Schengen countries travelled</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schengenCountries.map((c) => (
              <div key={c.code} className="field flex items-center gap-2 bg-paper/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flagSvg(c.code)} alt="" className="h-5 w-7 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
                <span className="font-medium">{countryName(c.code)}</span>
                <span className="ml-auto text-xs text-ink-soft">
                  {c.visits ? `${c.visits} visit${c.visits === 1 ? "" : "s"}` : "no visits"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-soft">One Schengen visa covers all of these. Countries come from the immigration record.</p>
        </div>
      )}

      {/* 2. Details */}      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="field-label">Country *</span>
          <CountrySelect key={countryKey} name="countryCode" defaultValue={f.countryCode} onChange={(c) => setF((x) => ({ ...x, countryCode: c }))} />
        </div>
        <label>
          <span className="field-label">Visa type</span>
          <input name="visaType" list="visa-types" value={f.visaType} onChange={set("visaType")} className="field" placeholder="Tourist, Student…" />
          <datalist id="visa-types">
            {TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="field-label">Visa format</span>
          <select name="visaFormat" value={f.visaFormat} onChange={set("visaFormat")} className="field">
            <option value="">—</option>
            <option>e-Visa</option>
            <option>Paper visa</option>
            <option>Visa on arrival</option>
            <option>ETA</option>
          </select>
        </label>
        <label>
          <span className="field-label">Visa number</span>
          <input name="visaNumber" value={f.visaNumber} onChange={set("visaNumber")} className="field font-mono uppercase" />
        </label>
        <label>
          <span className="field-label">Issue date</span>
          <input type="date" name="issueDate" value={f.issueDate} onChange={set("issueDate")} className="field" />
        </label>
        <label>
          <span className="field-label">Expiry date</span>
          <input type="date" name="expiryDate" value={f.expiryDate} onChange={set("expiryDate")} className="field" />
        </label>
        <label>
          <span className="field-label">Purpose</span>
          <select name="purpose" value={f.purpose} onChange={set("purpose")} className="field">
            <option value="">—</option>
            {/* keep a value read from a document even if it isn't in the list */}
            {f.purpose && !PURPOSES.includes(f.purpose) && <option value={f.purpose}>{f.purpose}</option>}
            {PURPOSES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Travel from</span>
          <input type="date" name="travelFrom" value={f.travelFrom} onChange={set("travelFrom")} className="field" />
        </label>
        <label>
          <span className="field-label">Travel to</span>
          <input type="date" name="travelTo" value={f.travelTo} onChange={set("travelTo")} className="field" />
        </label>
        <label>
          <span className="field-label">Entries</span>
          <select name="entries" value={f.entries} onChange={set("entries")} className="field">
            <option value="">—</option>
            <option>Single</option>
            <option>Double</option>
            <option>Multiple</option>
          </select>
        </label>
        <label>
          <span className="field-label">Stay (days)</span>
          <input type="number" min={0} max={3650} name="stayDays" value={f.stayDays} onChange={set("stayDays")} className="field" />
        </label>
        <label>
          <span className="field-label">Passport used</span>
          <input name="passportNumber" list="visa-passports" value={f.passportNumber} onChange={set("passportNumber")} className="field font-mono uppercase" />
          <datalist id="visa-passports">
            {passports.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="field-label">Issued at</span>
          <input name="issuedAt" value={f.issuedAt} onChange={set("issuedAt")} className="field" placeholder="Embassy / city" />
        </label>
        <label>
          <span className="field-label">Status</span>
          <select name="status" value={f.status} onChange={set("status")} className="field">
            <option value="">Automatic (Valid / Expired)</option>
            <option>Used</option>
            <option>Cancelled</option>
            <option>Refused</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Notes</span>
          <input name="notes" value={f.notes} onChange={set("notes")} className="field" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…">{visa ? "Save visa" : "Add visa"}</SubmitButton>
        {onDone && (
          <button type="button" onClick={onDone} className="btn btn-ghost">
            Cancel
          </button>
        )}
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
      </div>
    </form>
  );
}
