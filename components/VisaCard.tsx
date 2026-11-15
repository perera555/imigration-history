import Link from "next/link";
import { countryName } from "@/lib/countries";
import { formatDate, formatShortDate, visaState, type Profile, type Trip, type Visa } from "@/lib/data";
import { Flag } from "./Flag";

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
      t.countryCode === visa.countryCode &&
      (!from || t.departureDate >= from) &&
      (!to || t.departureDate <= to),
  );
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
}: {
  visa: Visa;
  holder?: Profile;
  trips: Trip[];
  canViewDocument?: boolean;
}) {
  const state = visaState(visa);
  const linked = tripsOnVisa(visa, trips);
  const name = countryName(visa.countryCode);
  const mrz = `V<${visa.countryCode}${(visa.visaType || "VISA").toUpperCase().replace(/[^A-Z0-9]/g, "<")}<<${(visa.visaNumber ?? "").replace(/[^A-Z0-9]/gi, "")}`
    .padEnd(44, "<")
    .slice(0, 44);

  return (
    <article className="visa-card flex flex-col rounded-3xl">
      <header className="flex items-start gap-4 border-b border-[#e3d6b4] p-5">
        <Flag code={visa.countryCode} className="h-11 w-16 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">Visa · {name}</p>
          <h3 className="truncate font-serif text-xl font-bold text-navy">{visa.visaType || "Visa"}</h3>
          {visa.visaFormat && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${visa.visaFormat === "Paper visa" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>
              {visa.visaFormat === "Paper visa" ? "📄 Paper visa" : `💻 ${visa.visaFormat}`}
            </span>
          )}
          {visa.purpose && <p className="text-xs text-ink-soft">Purpose: {visa.purpose}</p>}
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[state.tone]}`}>
            {state.label}
          </span>
          {state.detail && <p className="mt-1 text-[11px] font-medium text-emerald-700">{state.detail}</p>}
        </div>
      </header>

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
        <Item label="Visa no." value={visa.visaNumber} mono />
        <Item label="Entries" value={visa.entries} />
        <Item label="Stay" value={visa.stayDays ? `${visa.stayDays} days` : null} />
        <Item label="Passport" value={visa.passportNumber ?? holder?.passportNumber} mono />
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
        {visa.issuedAt && <Item label="Issued at" value={visa.issuedAt} wide />}
        {visa.notes && <Item label="Notes" value={visa.notes} wide />}
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
            <p className="mt-1 text-xs text-ink-soft">No recorded trips to {name} in this visa&apos;s dates.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/profiles/${visa.profileId}/update#visa-${visa.id}`} className="btn btn-primary !py-1.5 text-xs">
            ✏️ Update visa
          </Link>
        </div>
        {canViewDocument && visa.hasDocument && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/visas/${visa.id}/document`} target="_blank" rel="noopener" className="btn btn-ghost !py-1.5 text-xs">
              View visa document
            </a>
            <a href={`/api/visas/${visa.id}/document?download=1`} className="btn btn-ghost !py-1.5 text-xs">
              Download
            </a>
          </div>
        )}
        <p className="truncate rounded-lg bg-navy/[0.04] px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">{mrz}</p>
      </div>
    </article>
  );
}
