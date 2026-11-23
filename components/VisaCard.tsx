import Link from "next/link";
import { countryName, isSchengen } from "@/lib/countries";
import { isVisaNumber, visaTypeName } from "@/lib/visa-types";
import { formatDate, formatShortDate, visaState, type Profile, type Trip, type Visa } from "@/lib/data";
import { Flag } from "./Flag";
import { DeleteAttachmentButton } from "./DeleteAttachmentButton";
import { ConfirmButton } from "./SubmitButton";
import { deleteVisa } from "@/lib/visa-actions";

const TONE: Record<string, string> = {
  valid: "bg-emerald-600 text-white",
  expired: "bg-red-600 text-white",
  upcoming: "bg-amber-500 text-navy",
  closed: "bg-gray-500 text-white",
};

/** Trips to the visa's country that fall inside its travel window (or its validity). */
export function tripsOnVisa(visa: Visa, trips: Trip[]) {
  const from = visa.travelFrom ?? visa.issueDate;
  const to = visa.travelTo ?? visa.expiryDate;
  if (!from && !to) return [];
  return trips.filter(
    (t) =>
      (t.countryCode === visa.countryCode || (isSchengen(visa.countryCode) && isSchengen(t.countryCode))) &&
      (!from || t.departureDate >= from) &&
      (!to || t.departureDate <= to),
  );
}

/** Stay: as saved, or from Travel from → Travel to (both days counted). */
function stayText(visa: Visa): string | null {
  if (visa.stayDays) return `${visa.stayDays} days`;
  if (!visa.travelFrom || !visa.travelTo) return null;
  const days = Math.round((Date.parse(visa.travelTo) - Date.parse(visa.travelFrom)) / 86_400_000) + 1;
  return days >= 1 ? `${days} days` : null;
}

function Item({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono tracking-wide" : ""}`}>
        {value || <span className="text-ink-soft/60">—</span>}
      </dd>
    </div>
  );
}

export function VisaCard({
  visa,
  holder,
  trips,
  canViewDocument,
  editPage = "update",
  canDelete = false,
}: {
  /** Admins: "Delete PDF / photo" for the visa's document. */
  canDelete?: boolean;
  visa: Visa;
  holder?: Profile;
  trips: Trip[];
  canViewDocument?: boolean;
  editPage?: "update" | "visas";
}) {
  const state = visaState(visa);
  const linked = tripsOnVisa(visa, trips);
  const name = countryName(visa.countryCode);
  const schengen = isSchengen(visa.countryCode);
  // Saved earlier with the visa number in the passport box (not one of the holder's passports): show it as the visa number.
  const ppKey = (p: string | null | undefined) => (p ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const own = holder ? [holder.passportNumber, ...holder.previousPassports].filter((p) => ppKey(p)) : [];
  const misplaced = !visa.visaNumber && !!ppKey(visa.passportNumber) && own.length > 0 && !own.some((p) => ppKey(p) === ppKey(visa.passportNumber));
  const visaNo = visa.visaNumber ?? (misplaced ? visa.passportNumber : null);
  const passportNo = (misplaced || isVisaNumber(visa.passportNumber, visa.visaNumber) ? null : visa.passportNumber) ?? holder?.passportNumber;
  const mrz = `V<${visa.countryCode}${(visa.visaType || "VISA").toUpperCase().replace(/[^A-Z0-9]/g, "<")}<<${(visaNo ?? "").replace(/[^A-Z0-9]/gi, "")}`
    .padEnd(44, "<")
    .slice(0, 44);

  return (
    <article className="visa-card flex flex-col rounded-3xl">
      {/* Compact by default: click the visa to see every detail, the trips and the document. */}
      <details className="group">
      <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:[content:'']">
      <header className="flex items-start gap-4 border-b border-[#e3d6b4] p-5">
        <Flag code={visa.countryCode} className="h-11 w-16 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
            {schengen ? `🇪🇺 Schengen visa · issued by ${name}` : `Visa · ${name}`}
          </p>
          {schengen && <p className="text-[11px] text-sky-800">Valid in all 29 Schengen countries</p>}
          <h3 className="truncate font-serif text-xl font-bold text-navy">{visaTypeName(visa.countryCode, visa.visaType)}</h3>
          {visa.visaFormat && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${visa.visaFormat === "Paper visa" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>
              {visa.visaFormat === "Paper visa" ? "📄 Paper visa" : `💻 ${visa.visaFormat}`}
            </span>
          )}
          {visa.purpose && <p className="text-xs text-ink-soft">Purpose: {visa.purpose}</p>}
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[state.tone === "expired" && state.label !== "Expired" ? "closed" : state.tone]}`}>
            {state.label}
          </span>
          {state.detail && (
            <p className={`mt-1 text-[11px] font-medium ${state.tone === "valid" ? "text-emerald-700" : "text-ink-soft"}`}>{state.detail}</p>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#e3d6b4] bg-white/40 px-5 py-2.5 text-sm">
        {visaNo && <span className="font-mono font-semibold text-navy">No. {visaNo}</span>}
        <span className="text-ink-soft tabular-nums">
          {visa.issueDate || visa.expiryDate ? `${visa.issueDate ? formatShortDate(visa.issueDate) : "…"} → ${visa.expiryDate ? formatShortDate(visa.expiryDate) : "…"}` : "No dates yet"}
        </span>
        {visa.entries && <span className="text-ink-soft">{visa.entries} entry</span>}
        {visa.hasDocument && <span className="text-ink-soft">📎 document</span>}
        <span className="ml-auto rounded-full bg-navy px-3 py-1 text-xs font-semibold text-gold-soft">
          <span className="group-open:hidden">▾ Show details</span>
          <span className="hidden group-open:inline">▴ Hide details</span>
        </span>
      </div>
      </summary>

      {holder && (
        <div className="flex items-center gap-4 border-b border-[#e3d6b4] bg-white/40 px-5 py-4">
          <div className="h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-lg border border-[#d9c99f] bg-paper-2">
            {holder.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={holder.photo} alt={holder.fullName} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-[10px] text-ink-soft">No photo</span>
            )}
          </div>
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Holder</dt>
              <dd className="truncate text-sm font-semibold text-navy">{holder.fullName}</dd>
            </div>
            <Item label="Nationality" value={holder.nationality} />
            <Item label="Date of birth" value={holder.dateOfBirth ? formatShortDate(holder.dateOfBirth) : null} />
            <Item label="Sex" value={holder.sex} />
          </dl>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 p-5 sm:grid-cols-4">
        <Item label="Visa no." value={visaNo} mono />
        <Item label="Entries" value={visa.entries} />
        <Item label="Stay" value={stayText(visa)} />
        <Item label="Passport" value={passportNo} mono />
        <Item label="Issue date" value={visa.issueDate ? formatDate(visa.issueDate) : null} />
        <Item label="Expiry date" value={visa.expiryDate ? formatDate(visa.expiryDate) : null} />
        <Item
          label="Travel from → to"
          wide
          value={
            visa.travelFrom || visa.travelTo
              ? `${formatShortDate(visa.travelFrom)} → ${formatShortDate(visa.travelTo)}`
              : null
          }
        />
        {visa.countriesTravelled.length > 0 && (
          <Item label="Countries travelled" value={visa.countriesTravelled.map(countryName).join(", ")} wide />
        )}
        {visa.issuedAt && <Item label="Issued at" value={visa.issuedAt} wide />}        {visa.notes && <Item label="Notes" value={visa.notes} wide />}
      </dl>

      <div className="mt-auto space-y-3 border-t border-[#e3d6b4] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Trips on this visa ({linked.length})
          </p>
          {linked.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {linked.map((t) => (
                <span key={t.id} className="rounded-full bg-navy/5 px-2.5 py-1 text-xs tabular-nums text-navy">
                  {formatShortDate(t.departureDate)} → {formatShortDate(t.returnDate)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">No recorded trips to {schengen ? "the Schengen Area" : name} in this visa&apos;s dates.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/profiles/${visa.profileId}/${editPage}#visa-${visa.id}`} className="btn btn-primary !py-1.5 text-xs">
            ✏️ Update visa
          </Link>
          {canDelete && (
            <form action={deleteVisa.bind(null, visa.id)}>
              <ConfirmButton message="Delete this visa and its document? (You can get it back from Backup & recovery.)" className="btn btn-danger !py-1.5 text-xs">
                🗑 Delete visa
              </ConfirmButton>
            </form>
          )}
        </div>
        {canViewDocument && visa.hasDocument && /\.(png|jpe?g|webp)$/i.test(visa.documentName ?? "") && (
          <a href={`/api/visas/${visa.id}/document`} target="_blank" rel="noopener" title="Open full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/visas/${visa.id}/document`} alt="Visa photo" loading="lazy" className="max-h-56 w-full rounded-xl object-contain bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
          </a>
        )}
        {/* PDF visa page: shown right on the card */}
        {canViewDocument && visa.hasDocument && /\.pdf$/i.test(visa.documentName ?? "") && (
          <iframe
            src={`/api/visas/${visa.id}/document#toolbar=0&navpanes=0&view=FitH`}
            title={`${visa.documentName ?? "Visa"} (PDF)`}
            loading="lazy"
            className="h-[28rem] w-full rounded-xl border-0 bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
          />
        )}
        {canViewDocument && visa.pages?.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">More pages ({visa.pages.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {visa.pages.map((p, i) => (
                <a key={p.id} href={`/api/visa-pages/${p.id}`} target="_blank" rel="noopener" title={`Page ${i + 1}`} className="block h-16 w-12 overflow-hidden rounded-md bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                  {p.mime.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/visa-pages/${p.id}`} alt={`Visa page ${i + 1}`} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center">📄</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
        {canViewDocument && visa.hasDocument && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/visas/${visa.id}/document`} target="_blank" rel="noopener" className="btn btn-ghost !py-1.5 text-xs">
              View visa document
            </a>
            <a href={`/api/visas/${visa.id}/document?download=1`} className="btn btn-ghost !py-1.5 text-xs">
              Download
            </a>
            {canDelete && <DeleteAttachmentButton kind="visa" id={visa.id} />}
          </div>
        )}
        <p className="truncate rounded-lg bg-navy/[0.04] px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">{mrz}</p>
      </div>
      </details>
    </article>
  );
}
