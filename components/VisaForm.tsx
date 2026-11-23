"use client";

import { DateInput } from "./DateInput";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { readVisaDocument, readVisaPageText, saveVisa, type VisaSaveState } from "@/lib/visa-actions";
import { fileToImages, ocrImages } from "@/lib/ocr";
import type { VisaDetails } from "@/lib/visa-reader";
import type { Visa } from "@/lib/data";
import { CountrySelect } from "./CountrySelect";
import { isSchengen } from "@/lib/countries";
import { isVisaNumber, looksLikePassport, visaTypeMeaning } from "@/lib/visa-types";
import { SubmitButton } from "./SubmitButton";
import { DocumentPicker, isImageName } from "./DocumentPicker";
import { VisaPages, uploadVisaPages } from "./VisaPages";
import { toast, useToastOn } from "./Toaster";
import { deleteAttachment } from "@/lib/attachment-actions";

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

/** Days from one date to another, both included; null when either is missing or the order is wrong. */
function stayBetween(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return days >= 1 && days <= 3650 ? days : null;
}

const OTHER = "__other__";
const ppKey = (p: string | null | undefined) => (p ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const samePassport = (a: string | null | undefined, b: string | null | undefined) => !!ppKey(a) && ppKey(a) === ppKey(b);

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
  // Saved without a stay: work it out from the travel dates.
  stayDays: v?.stayDays != null ? String(v.stayDays) : String(stayBetween(v?.travelFrom ?? "", v?.travelTo ?? "") ?? ""),
  issuedAt: v?.issuedAt ?? "",
  // A visa number saved here by mistake (read from the sticker) isn't a passport: leave it empty to choose.
  passportNumber: v ? (isVisaNumber(v.passportNumber, v.visaNumber) ? "" : (v.passportNumber ?? "")) : (defaultPassport ?? ""),
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
  canDeletePages = false,
  existingNumbers = [],
}: {
  /** Visa numbers already in the record: reading skips those visas (next visa in a multi-visa PDF). */
  existingNumbers?: string[];
  /** Admins can remove single visa pages. */
  canDeletePages?: boolean;
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
  const [state, action] = useActionState<VisaSaveState, FormData>(async (prev, fd) => {
    try {
      return await saveVisa(profileId, visa?.id ?? null, prev, fd);
    } catch {
      // The server didn't answer properly (restarting, asleep, network): keep the form and say so.
      return { error: "The server didn't answer. Nothing was lost — please press Save again." };
    }
  }, undefined);
  const [f, setF] = useState<Fields>(() => {
    const x = fromVisa(visa, defaultPassport, defaultCountry, defaultType);
    // Saved earlier with the visa number in the passport box: move it to Visa number.
    if (visa && !x.visaNumber && x.passportNumber && !looksLikePassport(x.passportNumber) && !passports.some((p) => samePassport(p, x.passportNumber))) {
      return { ...x, visaNumber: x.passportNumber, passportNumber: "" };
    }
    return x;
  });
  const [countryKey, setCountryKey] = useState(0);
  // Current passport first, then previous ones (no repeats).
  const passportList = passports.filter((p, i) => ppKey(p) && passports.findIndex((q) => samePassport(q, p)) === i);
  const [otherPassport, setOtherPassport] = useState(() => !!f.passportNumber && !passportList.some((p) => samePassport(p, f.passportNumber)));
  // Countries travelled on this visa: saved list, or (new Schengen visa) the Schengen countries from the record.
  const [travelled, setTravelled] = useState<{ key: number; code: string }[]>(() =>
    (visa?.countriesTravelled.length ? visa.countriesTravelled : (schengenCountries ?? []).map((c) => c.code)).map((code, i) => ({
      key: i,
      code,
    })),
  );
  const visitsBy = new Map((schengenCountries ?? []).map((c) => [c.code, c.visits]));
  const showTravelled = isSchengen(f.countryCode) || /schengen/i.test(f.visaType) || travelled.length > 0;
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  const [reading, startReading] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formEl = useRef<HTMLFormElement>(null);
  /** The document chosen last (kept when the browser empties the file box after sending the form). */
  const lastFile = useRef<File | null>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => {
      const next = { ...x, [k]: e.target.value };
      // Stay (days) from Travel from → Travel to, counting both days (24 May → 22 Jul = 60 days).
      if (k === "travelFrom" || k === "travelTo") {
        const days = stayBetween(next.travelFrom, next.travelTo);
        if (days !== null) next.stayDays = String(days);
      }
      return next;
    });

  useToastOn(readMsg.ok, readMsg.error ?? (state?.error && !/already/i.test(state.error) ? state.error : null));

  // Saving a visa that is already in the record: don't save it again — load the next visa from the document.
  const skipNumbers = useRef<string[]>([]);
  useEffect(() => {
    if (!state?.error) return;
    // The browser empties the file box when the form is sent: put the chosen document back.
    const file = lastFile.current;
    if (file && fileRef.current && !fileRef.current.files?.length) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
    }
    if (!/already/i.test(state.error) || visa) return;
    if (f.visaNumber) skipNumbers.current = [...skipNumbers.current, f.visaNumber];
    if (file) {
      toast(`Visa ${f.visaNumber || ""} is already saved — loading the next visa from this document…`, "info");
      readDetails(file);
    } else {
      toast(`Visa ${f.visaNumber || ""} is already saved, so it wasn't saved again.`, "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Extra pages picked for a new visa: uploaded right after the visa is first saved.
  const [queued, setQueued] = useState<File[]>([]);
  const [pageMsg, setPageMsg] = useState("");
  useEffect(() => {
    if (!state?.ok) return;
    lastFile.current = null; // saved with this visa; don't send it again on the next save
    // Saved an existing visa: fold its form back into the short row (open again with "Update").
    if (visa) formEl.current?.closest("details")?.removeAttribute("open");
    if (!visa && state.id && queued.length) {
      const files = queued;
      setQueued([]);
      setPageMsg(`Uploading ${files.length} page${files.length === 1 ? "" : "s"}…`);
      uploadVisaPages(state.id, files, (n) => setPageMsg(`Uploading pages… ${n} of ${files.length}`)).then((failed) => {
        setPageMsg(failed ? `${failed} page(s) could not be added.` : "");
        onDone?.();
      });
      return;
    }
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /** Reads the visa details; runs by itself as soon as a file is chosen (and from the button). */
  function readDetails(picked?: File) {
    const file = picked ?? fileRef.current?.files?.[0] ?? lastFile.current ?? undefined;
    if (file) lastFile.current = file;
    if (!file) return setReadMsg({ error: "Choose the visa document first." });
    setReadMsg({});
    startReading(async () => {
      const fd = new FormData();
      fd.append("document", file);
      let result: Awaited<ReturnType<typeof readVisaDocument>>;
      try {
        result = await readVisaDocument(profileId, fd);
      } catch {
        // The server didn't answer properly: say so instead of breaking the page.
        return setReadMsg({ error: "The server didn't answer while reading the document. Please press “↻ Read details again”." });
      }
      // A read "passport" that isn't one of yours is the visa number (some stickers print it in that place).
      const fixNumbers = (x: VisaDetails | null): VisaDetails | null =>
        x?.passportNumber && !x.visaNumber && !looksLikePassport(x.passportNumber) && !passportList.some((p) => samePassport(p, x.passportNumber))
          ? { ...x, visaNumber: x.passportNumber.toUpperCase(), passportNumber: null }
          : x;
      let d: VisaDetails | null = fixNumbers(result && "ok" in result ? result.details : null);
      let note = result && "ok" in result ? (result.note ?? "") : "";
      // Same visa if the digits match (printed with a letter in front, machine-read without it).
      const digitsOf = (n: string) => n.replace(/[^0-9]/g, "").replace(/^0+/, "");
      const known = new Set([...existingNumbers, ...skipNumbers.current].map(digitsOf).filter((d) => d.length >= 5));
      const isKnown = (x: VisaDetails | null) => !!x?.visaNumber && known.has(digitsOf(x.visaNumber));
      // Scanned PDF or photo (no text inside), or a visa that is already in the record (e.g. page 1 of a
      // PDF with several visas): read each page and use the first visa that isn't saved yet.
      if (!d || !Object.values(d).some((v) => v !== null) || isKnown(d)) {
        try {
          const texts = await ocrImages(await fileToImages(file, 6), (m) => setReadMsg({ ok: m }));
          const pages: VisaDetails[] = [];
          for (const t of texts) {
            const p = fixNumbers(await readVisaPageText(profileId, t));
            if (p && Object.values(p).some((v) => v !== null)) pages.push(p);
          }
          const next = pages.find((p) => !isKnown(p));
          if (next) {
            d = next;
            note = pages.length > 1 ? `Read from the scan (the next visa in this document that isn't saved yet). Please check every detail.` : "Read from the scan. Please check every detail before saving.";
          } else if (pages.length && pages.every(isKnown)) {
            return setReadMsg({ error: "Every visa in this document is already in your record. Choose another visa page, or type the details below." });
          }
        } catch {
          /* fall through to the message below */
        }
      }
      if (!d || !Object.values(d).some((v) => v !== null)) {
        return setReadMsg({ error: "Couldn't find visa details in this document, even by reading the scan. It is attached, so type the details below and save." });
      }
      // Passport read from the document: never the visa number; use the matching passport from your list.
      // A number that isn't one of your passports is the visa number (when none was read), not a passport.
      let readPassport = d.passportNumber && !isVisaNumber(d.passportNumber, d.visaNumber ?? f.visaNumber) ? d.passportNumber : null;
      const mine = readPassport ? passportList.find((p) => samePassport(p, readPassport)) : undefined;
      if (readPassport && !mine && !looksLikePassport(readPassport)) {
        if (!d.visaNumber && !f.visaNumber) d = { ...d, visaNumber: readPassport.toUpperCase() };
        readPassport = null;
      }
      const passport = mine ?? readPassport;
      if (passport) setOtherPassport(!mine);
      setF((x) => ({
        ...x,
        passportNumber: passport ?? (isVisaNumber(x.passportNumber, d.visaNumber) ? "" : x.passportNumber),
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
        stayDays:
          d.stayDays != null
            ? String(d.stayDays)
            : String(stayBetween(d.travelFrom ?? x.travelFrom, d.travelTo ?? x.travelTo) ?? x.stayDays),
        issuedAt: d.issuedAt ?? x.issuedAt,
      }));
      if (d.countryCode) setCountryKey((k) => k + 1);
      const found = Object.values(d).filter((v) => v !== null).length;
      setReadMsg({ ok: `✓ ${found} detail${found === 1 ? "" : "s"} read from the document. ${note}` });
    });
  }

  return (
    <form
      ref={formEl}
      action={(fd) => {
        // The file box may have been emptied after an earlier send (e.g. the next visa of the same
        // document): always save the document that was chosen, so every visa keeps it.
        const doc = fd.get("document");
        if (!(doc instanceof File && doc.size > 0) && lastFile.current && fd.get("removeDocument") !== "on") fd.set("document", lastFile.current);
        return action(fd);
      }}
      className="space-y-6"
    >
      {/* 1. Document */}
      <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4">
        <DocumentPicker
          name="document"
          inputRef={fileRef}
          onPicked={(f) => readDetails(f)}
          label="Visa photo or document"
          saved={visa?.hasDocument ? { url: `/api/visas/${visa.id}/document`, name: visa.documentName, image: isImageName(visa.documentName) } : null}
          onDelete={visa ? () => deleteAttachment("visa", visa.id) : undefined}
        />
        <button type="button" onClick={() => readDetails()} disabled={reading} className="btn btn-gold mt-3">
          {reading ? "Reading the document…" : "↻ Read details again"}
        </button>
        {visa?.hasDocument && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 text-ink-soft">
              <input type="checkbox" name="removeDocument" className="accent-navy" /> Remove it
            </label>
          </div>
        )}
        {readMsg.ok && <p className="mt-2 text-sm font-medium text-ok">{readMsg.ok}</p>}
        {readMsg.error && <p className="mt-2 text-sm font-medium text-danger">{readMsg.error}</p>}
      </div>

      <VisaPages visaId={visa?.id} pages={visa?.pages} canDelete queued={visa ? undefined : queued} onQueue={setQueued} />
      {pageMsg && <p className="text-sm font-medium text-navy-2">{pageMsg}</p>}

      {/* Countries travelled on this visa (Schengen: any number of countries) */}
      {showTravelled && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
          <span className="field-label">Countries travelled on this visa</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {travelled.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CountrySelect
                    name="countriesTravelled"
                    defaultValue={t.code}
                    onChange={(code) => setTravelled((list) => list.map((x) => (x.key === t.key ? { ...x, code } : x)))}
                  />
                </div>
                {visitsBy.get(t.code) ? (
                  <span className="shrink-0 text-[11px] text-ink-soft">
                    {visitsBy.get(t.code)} visit{visitsBy.get(t.code) === 1 ? "" : "s"}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove country"
                  onClick={() => setTravelled((list) => list.filter((x) => x.key !== t.key))}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white hover:text-danger"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTravelled((list) => [...list, { key: Date.now(), code: "" }])}
            className="mt-3 text-sm font-semibold text-navy-2 hover:underline"
          >
            + Add country
          </button>
          <p className="mt-1 text-xs text-ink-soft">
            Add every country you travelled to on this visa. For a Schengen visa, list each Schengen country visited.
          </p>
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
          {visaTypeMeaning(f.countryCode, f.visaType) && (
            <span className="mt-1 block text-xs text-emerald-700">
              “{f.visaType.trim()}” = {visaTypeMeaning(f.countryCode, f.visaType)} visa
            </span>
          )}
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
          <DateInput name="issueDate" value={f.issueDate} onChange={set("issueDate")} className="field" />
        </label>
        <label>
          <span className="field-label">Expiry date</span>
          <DateInput name="expiryDate" value={f.expiryDate} onChange={set("expiryDate")} className="field" />
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
          <DateInput name="travelFrom" value={f.travelFrom} onChange={set("travelFrom")} className="field" />
        </label>
        <label>
          <span className="field-label">Travel to</span>
          <DateInput name="travelTo" value={f.travelTo} onChange={set("travelTo")} className="field" />
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
          <input type="number" min={0} max={3650} name="stayDays" value={f.stayDays} onChange={set("stayDays")} className="field" placeholder="Filled from the travel dates" />
        </label>
        <label>
          <span className="field-label">Passport used</span>
          {/* Your passports (current and previous); "Other" for one that isn't on your travel card. */}
          <select
            value={otherPassport ? OTHER : passportList.find((p) => samePassport(p, f.passportNumber)) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setOtherPassport(v === OTHER);
              setF((x) => ({ ...x, passportNumber: v === OTHER ? "" : v }));
            }}
            className="field font-mono"
          >
            <option value="">Choose passport…</option>
            {passportList.map((p, i) => (
              <option key={p} value={p}>
                {p} {i === 0 ? "(current passport)" : "(previous passport)"}
              </option>
            ))}
            <option value={OTHER}>Other passport…</option>
          </select>
          {otherPassport && (
            <input
              value={f.passportNumber}
              onChange={(e) => setF((x) => ({ ...x, passportNumber: e.target.value.toUpperCase() }))}
              className="field mt-2 font-mono uppercase"
              placeholder="Passport number"
            />
          )}
          <input type="hidden" name="passportNumber" value={f.passportNumber} />
          {!passportList.length && <span className="mt-1 block text-xs text-ink-soft">Add your passport numbers on the travel card to pick them here.</span>}
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
