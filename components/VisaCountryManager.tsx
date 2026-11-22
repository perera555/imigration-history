"use client";

import { useEffect, useRef, useState } from "react";
import { addVisaFromPhoto, deleteVisa, removeDuplicateVisas } from "@/lib/visa-actions";
import { prepareUpload } from "@/lib/upload-prep";
import { countryName, flagSvg, isSchengen } from "@/lib/countries";
import type { Visa } from "@/lib/data";
import { VisaForm } from "./VisaForm";
import { ConfirmButton } from "./SubmitButton";
import { CountrySearch } from "./CountrySearch";
import { toast, useToastOn } from "./Toaster";
import { VisaPdfImport } from "./VisaPdfImport";

type Group = {
  key: string;
  title: string;
  flag: string;
  subtitle: string | null;
  visits: number;
  codes: string[];
  /** Visits per country (shown as chips for the Schengen section). */
  perCountry: Record<string, number>;
  /** Country pre-selected when adding a visa from this section. */
  addCountry: string | null;
  addType?: string;
  addLabel: string;
};

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "📷 Add several visa photos": one new visa per chosen photo, for this country. */
function BulkVisaPhotos({ profileId, countryCode, visaType, title }: { profileId: string; countryCode: string; visaType: string; title: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ busy?: string; ok?: string; error?: string }>({});
  useToastOn(msg.ok, msg.error);
  async function go(list: FileList | null) {
    const files = [...(list ?? [])];
    if (!files.length) return;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setMsg({ busy: `Adding ${title} visa ${i + 1} of ${files.length}…` });
      const fd = new FormData();
      fd.append("document", await prepareUpload(files[i]));
      try {
        const r = await addVisaFromPhoto(profileId, countryCode, visaType, fd);
        if (r.error) failed++;
      } catch {
        failed++;
      }
    }
    const ok = files.length - failed;
    setMsg(
      failed
        ? { error: `${ok} visa${ok === 1 ? "" : "s"} added, ${failed} photo(s) could not be added (JPEG, PNG or PDF, max 8 MB).` }
        : { ok: `✓ ${ok} ${title} visa${ok === 1 ? "" : "s"} added. Open each one below to fill in its dates and number.` },
    );
  }
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={!!msg.busy} className="btn btn-ghost !py-1.5" title="Choose several photos: one visa is made for each">
        📷 Add several visa photos
      </button>
      <input ref={ref} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { go(e.target.files); e.target.value = ""; }} />
      {(msg.busy || msg.ok || msg.error) && (
        <p className={`basis-full text-sm font-medium ${msg.error ? "text-danger" : msg.ok ? "text-ok" : "text-navy-2"}`}>{msg.busy ?? msg.ok ?? msg.error}</p>
      )}
    </>
  );
}

/**
 * Visas arranged like the immigration record: one section per visited country
 * (e.g. Thailand · 8 visits) with its visas as filled forms and "+ Add Thailand visa".
 * Schengen countries (e.g. Belgium, France, Netherlands) share one "Schengen Area" section,
 * because one Schengen visa covers them all.
 */
export function VisaCountryManager({
  profileId,
  visas,
  countries,
  passports,
  defaultPassport,
  canDelete,
}: {
  profileId: string;
  visas: Visa[];
  /** Visited countries in record order, with the number of visits. */
  countries: { code: string; visits: number }[];
  passports: string[];
  defaultPassport?: string | null;
  canDelete: boolean;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  // Duplicates (same visa twice) are removed automatically, keeping the most complete copy.
  const cleaned = useRef("");
  useEffect(() => {
    const seen = new Set<string>();
    let dup = false;
    for (const v of visas) {
      const digits = (v.visaNumber ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");
      const key = digits.length >= 5 ? `n:${digits}` : v.issueDate && v.expiryDate ? `d:${v.countryCode}|${v.issueDate}|${v.expiryDate}` : null;
      if (key && seen.has(key)) dup = true;
      if (key) seen.add(key);
    }
    const signature = visas.map((v) => v.id).join(",");
    if (!dup || cleaned.current === signature) return;
    cleaned.current = signature;
    removeDuplicateVisas(profileId)
      .then((r) => r.removed && toast(`${r.removed} duplicate visa${r.removed === 1 ? "" : "s"} removed automatically (you can get ${r.removed === 1 ? "it" : "them"} back from Backup & recovery)`))
      .catch(() => {});
  }, [visas, profileId]);
  const [addKey, setAddKey] = useState(0);

  // Build sections: Schengen countries together, every other country on its own.
  const groups: Group[] = [];
  let schengen: Group | null = null;
  const touch = (code: string, visits: number) => {
    if (isSchengen(code)) {
      if (!schengen) {
        schengen = {
          key: "schengen",
          title: "Schengen Area",
          flag: "eu",
          subtitle: null,
          visits: 0,
          codes: [],
          perCountry: {},
          addCountry: code,
          addType: "Schengen visa (short stay)",
          addLabel: "+ Add Schengen visa",
        };
        groups.push(schengen);
      }
      const g = schengen as Group;
      if (!g.codes.includes(code)) g.codes.push(code);
      g.visits += visits;
      g.perCountry[code] = (g.perCountry[code] ?? 0) + visits;
    } else if (!groups.some((g) => g.key === code)) {
      groups.push({
        key: code,
        title: countryName(code),
        flag: code,
        subtitle: null,
        visits,
        codes: [code],
        perCountry: { [code]: visits },
        addCountry: code,
        addLabel: `+ Add ${countryName(code)} visa`,
      });
    }
  };
  for (const c of countries) touch(c.code, c.visits);
  for (const v of visas) touch(v.countryCode, 0);
  for (const g of groups) {
    if (g.key === "schengen") g.subtitle = "One Schengen visa covers all Schengen countries.";
  }

  const addForm = (g: Group | null) => (
    <div className="mt-4 rounded-2xl border-2 border-dashed border-gold/50 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <h4 className="font-serif text-lg font-bold text-navy">
          {g ? (g.key === "schengen" ? "Add Schengen visa" : `Add ${g.title} visa`) : "Add a visa for another country"}
        </h4>
        <button type="button" onClick={() => setAdding(null)} className="ml-auto text-sm text-ink-soft hover:underline">
          Cancel
        </button>
      </div>
      {g?.key === "schengen" && (
        <p className="mb-3 text-sm text-ink-soft">
          Choose the country that <b>issued</b> the Schengen visa (the embassy you applied to). It is valid for every
          Schengen country.
        </p>
      )}
      <VisaForm
        key={`${g?.key ?? "other"}-${addKey}`}
        profileId={profileId}
        passports={passports}
        defaultPassport={defaultPassport}
        defaultCountry={g?.addCountry ?? undefined}
        defaultType={g?.addType}
        existingNumbers={visas.map((v) => v.visaNumber).filter((n): n is string => !!n)}
        schengenCountries={g?.key === "schengen" ? g.codes.map((code) => ({ code, visits: g.perCountry[code] ?? 0 })) : undefined}
        onDone={() => {
          setAdding(null);
          setAddKey((k) => k + 1);
        }}
      />
    </div>
  );

  return (
    <>
    <VisaPdfImport profileId={profileId} />
    <CountrySearch>
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {groups.map((g, i) => {
        const own = visas.filter((v) => g.codes.includes(v.countryCode));
        return (
          <section
            key={g.key}
            id={`visa-country-${g.key}`}
            data-search={[g.title, g.subtitle ?? "", g.key, ...g.codes, ...g.codes.map(countryName), ...own.map((v) => `${v.countryCode} ${countryName(v.countryCode)}`)].join(" ")}
            className={`p-5 sm:p-6 ${i % 2 ? "bg-paper/40" : ""}`}
          >
            <header className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagSvg(g.flag)} alt="" className="h-9 w-14 rounded-md object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
              <div className="min-w-0">
                <h3 className="font-serif text-xl font-bold text-navy">
                  {g.title}
                  {g.key === "schengen" && (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-sky-900">
                      Schengen visa category
                    </span>
                  )}
                </h3>
                {g.subtitle && <p className="text-xs text-ink-soft">{g.subtitle}</p>}
                <p className="text-sm text-ink-soft">
                  {g.visits ? `${g.visits} visit${g.visits === 1 ? "" : "s"}` : "No recorded visits"} ·{" "}
                  <b className="text-navy">
                    {own.length} visa{own.length === 1 ? "" : "s"}
                  </b>
                </p>
              </div>
              {adding !== g.key && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {g.addCountry && (
                    <BulkVisaPhotos profileId={profileId} countryCode={g.addCountry} visaType={g.addType ?? ""} title={g.title} />
                  )}
                  <button type="button" onClick={() => setAdding(g.key)} className="btn btn-gold !py-1.5">
                    {g.addLabel}
                  </button>
                </div>
              )}
            </header>

            {own.map((v, n) => (
              // Compact row per saved visa; click "Update" to open its form.
              <details key={v.id} id={`visa-${v.id}`} className="group mt-3 scroll-mt-24 rounded-2xl border border-line bg-white transition-shadow open:shadow-md">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-gold-soft">{n + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">
                      {g.key === "schengen" ? `Schengen visa (issued by ${countryName(v.countryCode)})` : `${v.visaType || "Visa"}`}
                      {v.visaNumber && <span className="font-mono font-normal text-ink-soft"> · {v.visaNumber}</span>}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {v.issueDate || v.expiryDate
                        ? `${v.issueDate ? shortDate(v.issueDate) : "…"} → ${v.expiryDate ? shortDate(v.expiryDate) : "…"}`
                        : "No dates yet"}
                      {v.hasDocument ? " · 📎 document" : ""}
                    </span>
                  </span>
                  <span className="ml-auto rounded-full bg-navy px-3 py-1 text-xs font-semibold text-gold-soft">
                    <span className="group-open:hidden">✏️ Update ▾</span>
                    <span className="hidden group-open:inline">Close ▴</span>
                  </span>
                </summary>
                <div className="border-t border-line p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                    {g.title} visa{own.length > 1 ? ` ${n + 1} of ${own.length}` : ""} · update
                  </p>
                  {/* Owner or admin can delete a visa (a restore point is saved first) */}
                  <form action={deleteVisa.bind(null, v.id)} className="ml-auto">
                    <ConfirmButton message="Delete this visa and its document? (You can get it back from Backup & recovery.)" className="btn btn-danger !py-1">
                      🗑 Delete visa
                    </ConfirmButton>
                  </form>
                </div>
                <VisaForm
                  canDeletePages={canDelete}
                  profileId={profileId}
                  visa={v}
                  passports={passports}
                  schengenCountries={g.key === "schengen" ? g.codes.map((code) => ({ code, visits: g.perCountry[code] ?? 0 })) : undefined}
                />
                </div>
              </details>
            ))}

            {adding === g.key ? (
              addForm(g)
            ) : (
              own.length > 0 && (
                // Under the last visa, so the next one can be added right where you are after saving.
                <button
                  type="button"
                  onClick={() => setAdding(g.key)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold/60 bg-gold/5 px-4 py-3 text-sm font-semibold text-navy transition hover:bg-gold/10"
                >
                  {g.key === "schengen" ? "+ Add another Schengen visa" : `+ Add another ${g.title} visa`}
                </button>
              )
            )}
          </section>
        );
      })}

      <section className="p-5 sm:p-6">
        {adding === "__other" ? (
          addForm(null)
        ) : (
          <button type="button" onClick={() => setAdding("__other")} className="btn btn-ghost">
            🌍 + Add visa for another country
          </button>
        )}
      </section>
    </div>
    </CountrySearch>
    </>
  );
}
