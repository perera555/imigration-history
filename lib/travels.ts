/**
 * Groups boarding passes into travels and the parts of each travel, e.g.
 *   Travel: Colombo → Dublin → London → Colombo
 *     1. Colombo → Abu Dhabi → Dublin   (connecting flights: one part)
 *     2. Dublin → London
 *     3. London → Abu Dhabi → Colombo
 * A travel starts when leaving the home country (the country of the first flight) and ends on
 * arriving back there. Flights connect (same part) when one leaves where the previous one landed
 * within 2 days; a longer stay starts a new part.
 */
export type TravelFlight = {
  id: string;
  flightDate: string | null;
  fromAirport: string | null;
  toAirport: string | null;
  fromCity?: string | null;
  toCity?: string | null;
  fromCountry?: string | null;
  toCountry?: string | null;
  bookingRef: string | null;
};

export type TravelPart<T> = { label: "Outbound" | "Return" | "Onward"; route: string; flights: T[] };
export type Travel<T> = { title: string; from: string | null; to: string | null; parts: TravelPart<T>[] };

const DAY = 86_400_000;
const place = (city: string | null | undefined, code: string | null | undefined) => city || code || "---";

/** By date; flights of one journey on the same day in travel order (each leaves where the previous landed). */
export function inTravelOrder<T extends TravelFlight>(list: T[]): T[] {
  const byDate = [...list].sort((a, b) => (a.flightDate ?? "9999").localeCompare(b.flightDate ?? "9999"));
  const out: T[] = [];
  for (const p of byDate) {
    if (out.includes(p)) continue;
    const same = byDate.filter((q) => !out.includes(q) && q.flightDate === p.flightDate);
    if (same.length < 2) {
      out.push(p);
      continue;
    }
    let cur: T | undefined = same.find((q) => !same.some((r) => r.toAirport && r.toAirport === q.fromAirport)) ?? same[0];
    while (cur) {
      out.push(cur);
      const at: string | null = cur.toAirport;
      cur = same.find((q) => !out.includes(q) && q.fromAirport === at) ?? same.find((q) => !out.includes(q));
    }
  }
  return out;
}

const connects = (a: TravelFlight, b: TravelFlight) =>
  !!a.toAirport &&
  a.toAirport === b.fromAirport &&
  !!a.flightDate &&
  !!b.flightDate &&
  Date.parse(b.flightDate) - Date.parse(a.flightDate) <= 2 * DAY;

export function groupTravels<T extends TravelFlight>(passes: T[]): { travels: Travel<T>[]; undated: T[] } {
  const ordered = inTravelOrder(passes);
  const dated = ordered.filter((p) => p.flightDate);
  const undated = ordered.filter((p) => !p.flightDate);
  if (!dated.length) return { travels: [], undated };
  const home = dated[0].fromCountry ?? null;
  const atHome = (country: string | null | undefined) => !!home && country === home;

  // Travels: from leaving home to arriving back home.
  const groups: T[][] = [];
  let cur: T[] = [];
  for (const f of dated) {
    if (cur.length && atHome(f.fromCountry) && !connects(cur[cur.length - 1], f)) {
      groups.push(cur); // left home again without a flight back recorded
      cur = [];
    }
    cur.push(f);
    if (atHome(f.toCountry)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  const travels = groups.map((flights) => {
    // Parts: connecting flights together; a stay of more than 2 days starts a new part.
    const parts: T[][] = [];
    for (const f of flights) {
      const last = parts[parts.length - 1];
      if (last && connects(last[last.length - 1], f)) last.push(f);
      else parts.push([f]);
    }
    const route = (fs: T[]) => [place(fs[0].fromCity, fs[0].fromAirport), ...fs.map((f) => place(f.toCity, f.toAirport))].join(" → ");
    const labelled: TravelPart<T>[] = parts.map((fs, i) => ({
      label: i === 0 && atHome(fs[0].fromCountry) ? "Outbound" : i === parts.length - 1 && atHome(fs[fs.length - 1].toCountry) ? "Return" : "Onward",
      route: route(fs),
      flights: fs,
    }));
    // Title: home → every place stayed → home (e.g. Colombo → Dublin → London → Colombo).
    const stops = [place(flights[0].fromCity, flights[0].fromAirport), ...parts.map((fs) => place(fs[fs.length - 1].toCity, fs[fs.length - 1].toAirport))];
    return {
      title: stops.join(" → "),
      from: flights[0].flightDate,
      to: flights[flights.length - 1].flightDate,
      parts: labelled,
    };
  });
  return { travels, undated };
}
