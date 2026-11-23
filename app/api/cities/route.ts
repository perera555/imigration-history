import { City, State } from "country-state-city";

/**
 * City suggestions for the "City (optional)" fields: /api/cities?country=TH&q=bang → up to 20 cities
 * of that country whose name starts with (then contains) the typed text. Public data, no login needed.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "").toUpperCase();
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!/^[A-Z]{2}$/.test(country)) return Response.json({ cities: [] });

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const query = fold(q);
  const names = new Set<string>();
  // Provinces / states too (e.g. "Bangkok" is a province in the data), then the cities.
  const states = State.getStatesOfCountry(country).map((s) => s.name.replace(/\s+(Province|Prefecture|Governorate|Region|District|State)$/i, ""));
  if (!query) return Response.json({ cities: states.sort((a, b) => a.localeCompare(b)).slice(0, 30) }, { headers: { "Cache-Control": "public, max-age=86400" } });
  for (const s of states) names.add(s);
  for (const c of City.getCitiesOfCountry(country) ?? []) names.add(c.name);

  const all = [...names];
  const starts = all.filter((n) => fold(n).startsWith(query));
  const contains = query ? all.filter((n) => !fold(n).startsWith(query) && fold(n).includes(query)) : [];
  // Main places (provinces / states, e.g. Bangkok) before small districts, then shorter names first.
  const main = new Set(states);
  const rank = (a: string, b: string) => Number(!main.has(a)) - Number(!main.has(b)) || a.length - b.length || a.localeCompare(b);
  const cities = [...starts.sort(rank), ...contains.sort(rank)].slice(0, 20);

  return Response.json({ cities }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
