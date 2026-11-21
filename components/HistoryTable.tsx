import { Flag } from "./Flag";
import { formatDate, formatShortDate, groupForDisplay, tripDuration, daysToYmd, type Trip } from "@/lib/data";
import { countryName } from "@/lib/countries";

export function HistoryTable({ trips }: { trips: Trip[] }) {
  const groups = groupForDisplay(trips);

  if (!groups.length) {
    return (
      <div className="panel p-10 text-center text-ink-soft">
        No trips recorded yet. Add trips from the admin panel.
      </div>
    );
  }

  return (
    <>
      {/* Desktop: table grouped by country, like the original document */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-navy text-left text-[11px] uppercase tracking-[0.14em] text-gold-soft">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Country</th>
              <th className="px-3 py-3.5 text-center font-semibold">Visits</th>
              <th className="px-3 py-3.5 font-semibold">Departure</th>
              <th className="px-3 py-3.5 font-semibold">Return</th>
              <th className="px-3 py-3.5 font-semibold">Duration</th>
              <th className="px-3 py-3.5 font-semibold">Purpose</th>
              <th className="px-5 py-3.5 font-semibold">Passport</th>
            </tr>
          </thead>
          {groups.map((group, gi) => (
            <tbody key={group.countryCode} className={gi % 2 ? "bg-paper/50" : ""}>
              {group.visits.map((trip, i) => (
                <tr key={trip.id} className={i === 0 ? "border-t border-line" : ""}>
                  {i === 0 && (
                    <>
                      <td rowSpan={group.visits.length} className="px-5 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <Flag code={group.countryCode} className="h-7 w-10" />
                          <div>
                            <span className="font-semibold text-ink">{group.countryName}</span>
                            {group.schengen && (
                              <span className="mt-0.5 block w-fit rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                                Schengen visa
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td rowSpan={group.visits.length} className="px-3 py-3 text-center align-top">
                        <span className="inline-grid size-7 place-items-center rounded-full bg-gold/15 font-semibold text-navy">
                          {group.visits.length}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(trip.departureDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(trip.returnDate)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{tripDuration(trip) ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {trip.purpose || "—"}
                    {trip.city && <span className="ml-1.5 text-xs text-ink-soft">· {trip.city}</span>}
                    {trip.countries && (
                      <p className="mt-0.5 text-xs font-medium text-sky-900">Countries: {trip.countries.map(countryName).join(", ")}</p>
                    )}
                    {trip.notes && <p className="mt-0.5 text-xs text-ink-soft">{trip.notes}</p>}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs tracking-wide text-ink-soft">
                    {trip.passportNumber ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Mobile: one card per country */}
      <div className="grid gap-4 md:hidden">
        {groups.map((group) => (
          <section key={group.countryCode} className="panel overflow-hidden">
            <header className="flex items-center gap-3 border-b border-line bg-paper/60 px-4 py-3">
              <Flag code={group.countryCode} className="h-7 w-10" />
              <h3 className="font-semibold">
                {group.countryName}
                {group.schengen && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">Schengen visa</span>}
              </h3>
              <span className="ml-auto rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-gold-soft">
                {group.visits.length} {group.visits.length === 1 ? "visit" : "visits"}
              </span>
            </header>
            <ul className="divide-y divide-line">
              {group.visits.map((trip) => (
                <li key={trip.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2 font-medium tabular-nums">
                    <span>
                      {formatShortDate(trip.departureDate)} → {formatShortDate(trip.returnDate)}
                    </span>
                    {tripDuration(trip) && <span className="text-xs text-ink-soft">{tripDuration(trip)}</span>}
                  </div>
                  <p className="mt-1 text-ink-soft">
                    {trip.purpose || "—"}
                    {trip.city && ` · ${trip.city}`}
                    {trip.passportNumber && <span className="font-mono text-xs"> · {trip.passportNumber}</span>}
                  </p>
                  {trip.countries && <p className="mt-1 text-xs font-medium text-sky-900">Countries: {trip.countries.map(countryName).join(", ")}</p>}
                  {trip.notes && <p className="mt-1 text-xs text-ink-soft">{trip.notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function StatsBar({ stats }: { stats: { trips: number; countries: number; daysAbroad: number; span: string } }) {
  const items = [
    { label: "Countries", value: stats.countries },
    { label: "Trips", value: stats.trips },
    { label: "Time abroad", value: daysToYmd(stats.daysAbroad) },
    { label: "Years", value: stats.span },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="panel px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{item.label}</p>
          <p className="mt-1 font-serif text-2xl font-bold text-navy tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
