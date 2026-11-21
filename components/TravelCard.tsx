import { ageFrom, formatDate, recordNumber, type Profile } from "@/lib/data";

function mrzLine(profile: Profile) {
  const name = profile.fullName.toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/);
  const surname = name.pop() ?? "";
  const given = name.join("<");
  const top = `P<${(profile.nationality ?? "").slice(0, 3).toUpperCase().padEnd(3, "<")}${surname}<<${given}`;
  const bottom = `${(profile.passportNumber ?? "").padEnd(9, "<")}<${(profile.dateOfBirth ?? "").replaceAll("-", "").slice(2)}<${(profile.sex ?? "<").charAt(0).toUpperCase()}`;
  return [top.padEnd(44, "<").slice(0, 44), bottom.padEnd(44, "<").slice(0, 44)];
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 lg:col-span-3" : ""}>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-gold-soft/70">{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] leading-snug text-white ${mono ? "font-mono tracking-wider" : ""}`}>
        {value || <span className="text-white/40">—</span>}
      </dd>
    </div>
  );
}

export function TravelCard({ profile, title = "Previous Immigration History" }: { profile: Profile; title?: string }) {
  const age = ageFrom(profile.dateOfBirth);
  const [mrz1, mrz2] = mrzLine(profile);

  return (
    <article className="id-card rounded-[1.75rem] p-5 sm:p-8">
      <div className="relative z-10">
        <header className="flex items-start justify-between gap-4 border-b border-gold-soft/25 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-soft/80">
              Travel identity card
            </p>
            <h2 className="gold-text mt-1 font-serif text-xl font-bold sm:text-2xl">{title}</h2>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-full border border-gold-soft/50 bg-white/5 text-gold-soft">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
            </svg>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className="relative h-44 w-36 overflow-hidden rounded-2xl border-2 border-gold-soft/70 bg-white/10 shadow-lg sm:h-52 sm:w-40">
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo} alt={profile.fullName} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-white/40">
                  <svg viewBox="0 0 24 24" className="size-16" fill="currentColor" aria-hidden>
                    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
                  </svg>
                </div>
              )}
            </div>
            <p className="mt-2 text-center font-mono text-[10px] tracking-widest text-gold-soft/60">
              {profile.passportNumber ?? "—"}
            </p>
          </div>

          {/* Same card size: three compact columns on wide screens so the extra details fit. */}
          <dl className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-3">
            <Field label="Full name" value={profile.fullName} wide />
            <Field label="Sex" value={profile.sex} />
            <Field
              label="Age"
              value={age !== null ? `${age} yrs · ${formatDate(profile.dateOfBirth)}` : null}
            />
            <Field label="Nationality" value={profile.nationality} />
            <Field label="Citizenship" value={profile.citizenship} />
            {profile.otherCitizenship && <Field label="Other citizenship" value={profile.otherCitizenship} />}
            <Field label="ID number (NIC)" value={profile.nationalId} mono />
            {profile.tin && <Field label="TIN" value={profile.tin} mono />}
            <Field label="Passport no." value={profile.passportNumber} mono />
            <Field label="Passport issued" value={profile.passportIssueDate ? formatDate(profile.passportIssueDate) : null} />
            <Field
              label="Passport expires"
              value={
                profile.passportExpiryDate ? (
                  <>
                    {formatDate(profile.passportExpiryDate)}
                    {profile.passportExpiryDate < new Date().toISOString().slice(0, 10) && (
                      <span className="ml-2 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Expired</span>
                    )}
                  </>
                ) : null
              }
            />
            <Field
              label="Previous passports"
              value={profile.previousPassports.length ? profile.previousPassports.join(", ") : null}
              mono
              wide
            />
            <Field label="Phone" value={[profile.phone, profile.phone2].filter(Boolean).join(" · ")} />
            {profile.whatsapp && <Field label="WhatsApp" value={profile.whatsapp} />}
            <Field label="Email" value={profile.email} />
            {profile.email2 && <Field label="Other email" value={profile.email2} />}
            <Field label="Address" value={profile.address} wide />
          </dl>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-gold-soft/25 pt-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft/70">Record no.</dt>
            <dd className="mt-0.5 font-mono text-sm tracking-wider text-white">{recordNumber(profile.id)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft/70">Date issued</dt>
            <dd className="mt-0.5 text-sm text-white">{formatDate(profile.issuedOn)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft/70">Last updated</dt>
            <dd className="mt-0.5 text-sm text-white">{formatDate(profile.lastUpdated)}</dd>
          </div>
        </dl>

        <div className="mt-4 overflow-hidden rounded-xl bg-black/25 px-4 py-3 font-mono text-[10px] leading-relaxed tracking-[0.2em] text-white/70 sm:text-xs">
          <p className="truncate">{mrz1}</p>
          <p className="truncate">{mrz2}</p>
        </div>
      </div>
    </article>
  );
}
