import { visaState, type Profile, type Trip, type Visa } from "@/lib/data";
import Link from "next/link";
import { VisaCard } from "./VisaCard";
import { countryName, flagSvg, isSchengen } from "@/lib/countries";

/** Visas grouped by country (Schengen visas together), countries A–Z, newest visa first. */
function byCountry(visas: Visa[]) {
  const groups = new Map<string, { key: string; title: string; flag: string; visas: Visa[] }>();
  for (const v of visas) {
    const schengen = isSchengen(v.countryCode);
    const key = schengen ? "schengen" : v.countryCode;
    const g = groups.get(key) ?? { key, title: schengen ? "Schengen Area" : countryName(v.countryCode), flag: schengen ? "eu" : v.countryCode, visas: [] };
    g.visas.push(v);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** "Visas" section: totals and one visa card per visa, newest first. */
export function VisaList({
  profileId,
  holder,
  visas,
  trips,
  canViewDocument = false,
  editPage = "update",
  emptyHint = "No visas recorded yet.",
  canDelete = false,
  stays = [],
}: {
  /** Hotels / Airbnb homes: each visa shows how many were stayed in on its visits (🏨 2). */
  stays?: { tripId: string | null; name: string }[];
  /** Admins: "Delete PDF / photo" on each visa card. */
  canDelete?: boolean;
  /** Shows "View / Download visas PDF" when given. */
  profileId?: string;
  /** Visa holder (from the travel card), shown on each visa card. */
  holder?: Profile;
  visas: Visa[];
  trips: Trip[];
  canViewDocument?: boolean;
  /** Where the Update visa buttons go: the Update record page or the Visas page. */
  editPage?: "update" | "visas";
  emptyHint?: string;
}) {
  const states = visas.map((v) => visaState(v).tone);
  const countries = new Set(visas.map((v) => v.countryCode)).size;
  const stats = [
    { label: "Visas", value: visas.length },
    { label: "Countries", value: countries },
    { label: "Valid now", value: states.filter((s) => s === "valid").length },
    { label: "Expired", value: states.filter((s) => s === "expired").length },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Visas</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Visas held</h2>
        </div>
        {profileId && editPage === "update" && (
          <Link href={`/admin/profiles/${profileId}/visas`} className="btn btn-gold sm:ml-auto">
            🛂 Open Visas page
          </Link>
        )}
        {profileId && visas.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${editPage === "update" ? "" : "ml-auto"}`}>
            <Link href={`/admin/profiles/${profileId}/${editPage}#visas`} className="btn btn-primary">
              ✏️ Update visas
            </Link>
            <a href={`/api/profiles/${profileId}/pdf?only=visas&view=1`} target="_blank" rel="noopener" className="btn btn-ghost">
              View visas PDF
            </a>
            <a href={`/api/profiles/${profileId}/pdf?only=visas`} className="btn btn-gold">
              Download visas PDF
            </a>
          </div>
        )}
      </div>
      {visas.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="panel px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{s.label}</p>
                <p className="mt-0.5 font-serif text-xl font-bold text-navy tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          {/* One box per country (Schengen countries together), with every visa for it inside */}
          <div className="space-y-5">
            {byCountry(visas).map((g) => (
              <section key={g.key} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center gap-3 border-b border-line bg-paper/60 px-5 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flagSvg(g.flag)} alt="" className="h-7 w-10 rounded object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
                  <h3 className="font-serif text-lg font-bold text-navy">{g.title}</h3>
                  <span className="ml-auto rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-gold-soft">
                    {g.visas.length} visa{g.visas.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid items-start gap-5 p-4 sm:p-5 lg:grid-cols-2">
                  {g.visas.map((v) => (
                    <VisaCard key={v.id} visa={v} holder={holder} trips={trips} stays={stays} canViewDocument={canViewDocument} canDelete={canDelete} editPage={editPage} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="panel p-8 text-center text-ink-soft">{emptyHint}</div>
      )}
    </section>
  );
}
