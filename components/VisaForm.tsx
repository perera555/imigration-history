Cuse clientC;

import { DateInput } from C./DateInputC;
import { useActionState, useEffect, useRef, useState, useTransition } from CreactC;
import { readVisaDocument, readVisaPageText, saveVisa, type VisaSaveState } from C@/lib/visa-actionsC;
import { fileToImages, ocrImages } from C@/lib/ocrC;
import type { VisaDetails } from C@/lib/visa-readerC;
import type { Visa } from C@/lib/dataC;
import { CountrySelect } from C./CountrySelectC;
import { isSchengen } from C@/lib/countriesC;
import { SubmitButton } from C./SubmitButtonC;
import { DocumentPicker, isImageName } from C./DocumentPickerC;
import { VisaPages, uploadVisaPages } from C./VisaPagesC;
import { toast, useToastOn } from C./ToasterC;
import { deleteAttachment } from C@/lib/attachment-actionsC;

const PURPOSES = [
  CTourismC,
  CBusinessC,
  CStudyC,
  CWorkC,
  CFamily visitC,
  CMedicalC,
  CTransitC,
  CConference / TrainingC,
  CReligiousC,
  CSportsC,
  COfficial / DiplomaticC,
  CResidenceC,
  CWorking holidayC,
];

const TYPES = [CSchengen visa (short stay)C, CSchengen visa (national, type D)C, CTouristC, CVisitC, CBusinessC, CStudentC, CWorkC, CTransitC, CFamilyC, CMedicalC, CWorking HolidayC, CResidentC, Ce-VisaC, CVisa on arrivalC, CETAC];

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

const fromVisa = (v?: Visa, defaultPassport?: string | null, defaultCountry?: string, defaultType?: string): Fields => ({
  countryCode: v?.countryCode ?? defaultCountry ?? CC,
  visaType: v?.visaType ?? defaultType ?? CC,
  visaFormat: v?.visaFormat ?? CC,
  visaNumber: v?.visaNumber ?? CC,
  issueDate: v?.issueDate ?? CC,
  expiryDate: v?.expiryDate ?? CC,
  travelFrom: v?.travelFrom ?? CC,
  travelTo: v?.travelTo ?? CC,
  purpose: v?.purpose ?? CC,
  entries: v?.entries ?? CC,
  // Saved without a stay: work it out from the travel dates.
  stayDays: v?.stayDays != null ? String(v.stayDays) : String(stayBetween(v?.travelFrom ?? CC, v?.travelTo ?? CC) ?? CC),
  issuedAt: v?.issuedAt ?? CC,
  passportNumber: v ? (v.passportNumber ?? CC) : (defaultPassport ?? CC),
  status: v?.status ?? CC,
  notes: v?.notes ?? CC,
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
  /** Pre-selected country for a new visa (e.g. C+ Add Thailand visaC). */
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
  /** The document chosen last (kept when the browser empties the file box after sending the form). */
  const lastFile = useRef<File | null>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => {
      const next = { ...x, [k]: e.target.value };
      // Stay (days) from Travel from → Travel to, counting both days (24 May → 22 Jul = 60 days).
      if (k === CtravelFromC || k === CtravelToC) {
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
      toast(`Visa ${f.visaNumber || CC} is already saved — loading the next visa from this document…`, CinfoC);
      readDetails(file);
    } else {
      toast(`Visa ${f.visaNumber || CC} is already saved, so it wasn't saved again.`, CinfoC);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Extra pages picked for a new visa: uploaded right after the visa is first saved.
  const [queued, setQueued] = useState<File[]>([]);
  const [pageMsg, setPageMsg] = useState(CC);
  useEffect(() => {
    if (!state?.ok) return;
    if (!visa && state.id && queued.length) {
      const files = queued;
      setQueued([]);
      setPageMsg(`Uploading ${files.length} page${files.length === 1 ? CC : CsC}…`);
      uploadVisaPages(state.id, files, (n) => setPageMsg(`Uploading pages… ${n} of ${files.length}`)).then((failed) => {
        setPageMsg(failed ? `${failed} page(s) could not be added.` : CC);
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
    if (!file) return setReadMsg({ error: CChoose the visa document first.C });
    setReadMsg({});
    startReading(async () => {
      const fd = new FormData();
      fd.append(CdocumentC, file);
      const result = await readVisaDocument(profileId, fd);
      let d: VisaDetails | null = result && CokC in result ? result.details : null;
      let note = result && CokC in result ? (result.note ?? CC) : CC;
      // Same visa if the digits match (printed with a letter in front, machine-read without it).
      const digitsOf = (n: string) => n.replace(/[^0-9]/g, CC).replace(/^0+/, CC);
      const known = new Set([...existingNumbers, ...skipNumbers.current].map(digitsOf).filter((d) => d.length >= 5));
      const isKnown = (x: VisaDetails | null) => !!x?.visaNumber && known.has(digitsOf(x.visaNumber));
      // Scanned PDF or photo (no text inside), or a visa that is already in the record (e.g. page 1 of a
      // PDF with several visas): read each page and use the first visa that isn't saved yet.
      if (!d || !Object.values(d).some((v) => v !== null) || isKnown(d)) {
        try {
          const texts = await ocrImages(await fileToImages(file, 6), (m) => setReadMsg({ ok: m }));
          const pages: VisaDetails[] = [];
          for (const t of texts) {
            const p = await readVisaPageText(profileId, t);
            if (p && Object.values(p).some((v) => v !== null)) pages.push(p);
          }
          const next = pages.find((p) => !isKnown(p));
          if (next) {
            d = next;
            note = pages.length > 1 ? `Read from the scan (the next visa in this document that isn't saved yet). Please check every detail.` : CRead from the scan. Please check every detail before saving.C;
          } else if (pages.length && pages.every(isKnown)) {
            return setReadMsg({ error: CEvery visa in this document is already in your record. Choose another visa page, or type the details below.C });
          }
        } catch {
          /* fall through to the message below */
        }
      }
      if (!d || !Object.values(d).some((v) => v !== null)) {
        return setReadMsg({ error: CCouldn't find visa details in this document, even by reading the scan. It is attached, so type the details below and save.C });
      }
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
        stayDays:
          d.stayDays != null
            ? String(d.stayDays)
            : String(stayBetween(d.travelFrom ?? x.travelFrom, d.travelTo ?? x.travelTo) ?? x.stayDays),
        issuedAt: d.issuedAt ?? x.issuedAt,
        passportNumber: d.passportNumber ?? x.passportNumber,
      }));
      if (d.countryCode) setCountryKey((k) => k + 1);
      const found = Object.values(d).filter((v) => v !== null).length;
      setReadMsg({ ok: `✓ ${found} detail${found === 1 ? CC : CsC} read from the document. ${note}` });
    });
  }

  return (
    <form action={action} className=Cspace-y-6C>
      {/* 1. Document */}
      <div className=Crounded-2xl border border-dashed border-line bg-paper/50 p-4C>
        <DocumentPicker
          name=CdocumentC
          inputRef={fileRef}
          onPicked={(f) => readDetails(f)}
          label=CVisa photo or documentC
          saved={visa?.hasDocument ? { url: `/api/visas/${visa.id}/document`, name: visa.documentName, image: isImageName(visa.documentName) } : null}
          onDelete={visa ? () => deleteAttachment(CvisaC, visa.id) : undefined}
        />
        <button type=CbuttonC onClick={() => readDetails()} disabled={reading} className=Cbtn btn-gold mt-3C>
          {reading ? CReading the document…C : C↻ Read details againC}
        </button>
        {visa?.hasDocument && (
          <div className=Cmt-2 flex flex-wrap items-center gap-3 text-smC>
            <label className=Cflex items-center gap-1.5 text-ink-softC>
              <input type=CcheckboxC name=CremoveDocumentC className=Caccent-navyC /> Remove it
            </label>
          </div>
        )}
        {readMsg.ok && <p className=Cmt-2 text-sm font-medium text-okC>{readMsg.ok}</p>}
        {readMsg.error && <p className=Cmt-2 text-sm font-medium text-dangerC>{readMsg.error}</p>}
      </div>

      <VisaPages visaId={visa?.id} pages={visa?.pages} canDelete queued={visa ? undefined : queued} onQueue={setQueued} />
      {pageMsg && <p className=Ctext-sm font-medium text-navy-2C>{pageMsg}</p>}

      {/* Countries travelled on this visa (Schengen: any number of countries) */}
      {showTravelled && (
        <div className=Crounded-2xl border border-sky-200 bg-sky-50/50 p-4C>
          <span className=Cfield-labelC>Countries travelled on this visa</span>
          <div className=Cgrid gap-3 sm:grid-cols-2 lg:grid-cols-3C>
            {travelled.map((t) => (
              <div key={t.key} className=Cflex items-center gap-2C>
                <div className=Cmin-w-0 flex-1C>
                  <CountrySelect
                    name=CcountriesTravelledC
                    defaultValue={t.code}
                    onChange={(code) => setTravelled((list) => list.map((x) => (x.key === t.key ? { ...x, code } : x)))}
                  />
                </div>
                {visitsBy.get(t.code) ? (
                  <span className=Cshrink-0 text-[11px] text-ink-softC>
                    {visitsBy.get(t.code)} visit{visitsBy.get(t.code) === 1 ? CC : CsC}
                  </span>
                ) : null}
                <button
                  type=CbuttonC
                  aria-label=CRemove countryC
                  onClick={() => setTravelled((list) => list.filter((x) => x.key !== t.key))}
                  className=Cgrid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white hover:text-dangerC
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type=CbuttonC
            onClick={() => setTravelled((list) => [...list, { key: Date.now(), code: CC }])}
            className=Cmt-3 text-sm font-semibold text-navy-2 hover:underlineC
          >
            + Add country
          </button>
          <p className=Cmt-1 text-xs text-ink-softC>
            Add every country you travelled to on this visa. For a Schengen visa, list each Schengen country visited.
          </p>
        </div>
      )}

      {/* 2. Details */}      <div className=Cgrid gap-4 sm:grid-cols-2 lg:grid-cols-3C>
        <div className=Csm:col-span-2 lg:col-span-1C>
          <span className=Cfield-labelC>Country *</span>
          <CountrySelect key={countryKey} name=CcountryCodeC defaultValue={f.countryCode} onChange={(c) => setF((x) => ({ ...x, countryCode: c }))} />
        </div>
        <label>
          <span className=Cfield-labelC>Visa type</span>
          <input name=CvisaTypeC list=Cvisa-typesC value={f.visaType} onChange={set(CvisaTypeC)} className=CfieldC placeholder=CTourist, Student…C />
          <datalist id=Cvisa-typesC>
            {TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label>
          <span className=Cfield-labelC>Visa format</span>
          <select name=CvisaFormatC value={f.visaFormat} onChange={set(CvisaFormatC)} className=CfieldC>
            <option value=CC>—</option>
            <option>e-Visa</option>
            <option>Paper visa</option>
            <option>Visa on arrival</option>
            <option>ETA</option>
          </select>
        </label>
        <label>
          <span className=Cfield-labelC>Visa number</span>
          <input name=CvisaNumberC value={f.visaNumber} onChange={set(CvisaNumberC)} className=Cfield font-mono uppercaseC />
        </label>
        <label>
          <span className=Cfield-labelC>Issue date</span>
          <DateInput name=CissueDateC value={f.issueDate} onChange={set(CissueDateC)} className=CfieldC />
        </label>
        <label>
          <span className=Cfield-labelC>Expiry date</span>
          <DateInput name=CexpiryDateC value={f.expiryDate} onChange={set(CexpiryDateC)} className=CfieldC />
        </label>
        <label>
          <span className=Cfield-labelC>Purpose</span>
          <select name=CpurposeC value={f.purpose} onChange={set(CpurposeC)} className=CfieldC>
            <option value=CC>—</option>
            {/* keep a value read from a document even if it isn't in the list */}
            {f.purpose && !PURPOSES.includes(f.purpose) && <option value={f.purpose}>{f.purpose}</option>}
            {PURPOSES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span className=Cfield-labelC>Travel from</span>
          <DateInput name=CtravelFromC value={f.travelFrom} onChange={set(CtravelFromC)} className=CfieldC />
        </label>
        <label>
          <span className=Cfield-labelC>Travel to</span>
          <DateInput name=CtravelToC value={f.travelTo} onChange={set(CtravelToC)} className=CfieldC />
        </label>
        <label>
          <span className=Cfield-labelC>Entries</span>
          <select name=CentriesC value={f.entries} onChange={set(CentriesC)} className=CfieldC>
            <option value=CC>—</option>
            <option>Single</option>
            <option>Double</option>
            <option>Multiple</option>
          </select>
        </label>
        <label>
          <span className=Cfield-labelC>Stay (days)</span>
          <input type=CnumberC min={0} max={3650} name=CstayDaysC value={f.stayDays} onChange={set(CstayDaysC)} className=CfieldC placeholder=CFilled from the travel datesC />
        </label>
        <label>
          <span className=Cfield-labelC>Passport used</span>
          <input name=CpassportNumberC list=Cvisa-passportsC value={f.passportNumber} onChange={set(CpassportNumberC)} className=Cfield font-mono uppercaseC />
          <datalist id=Cvisa-passportsC>
            {passports.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label>
          <span className=Cfield-labelC>Issued at</span>
          <input name=CissuedAtC value={f.issuedAt} onChange={set(CissuedAtC)} className=CfieldC placeholder=CEmbassy / cityC />
        </label>
        <label>
          <span className=Cfield-labelC>Status</span>
          <select name=CstatusC value={f.status} onChange={set(CstatusC)} className=CfieldC>
            <option value=CC>Automatic (Valid / Expired)</option>
            <option>Used</option>
            <option>Cancelled</option>
            <option>Refused</option>
          </select>
        </label>
        <label className=Csm:col-span-2C>
          <span className=Cfield-labelC>Notes</span>
          <input name=CnotesC value={f.notes} onChange={set(CnotesC)} className=CfieldC />
        </label>
      </div>
      <div className=Cflex flex-wrap items-center gap-3C>
        <SubmitButton pendingText=CSaving…C>{visa ? CSave visaC : CAdd visaC}</SubmitButton>
        {onDone && (
          <button type=CbuttonC onClick={onDone} className=Cbtn btn-ghostC>
            Cancel
          </button>
        )}
        {state?.error && <p className=Ctext-sm font-medium text-dangerC>{state.error}</p>}
        {state?.ok && <p className=Ctext-sm font-medium text-okC>✓ {state.ok}</p>}
      </div>
    </form>
  );
}
