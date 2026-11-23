import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { countryName } from "@/lib/countries";
import { City, State } from "country-state-city";

/**
 * Hotels of a city with their addresses, for the Hotel / Airbnb field:
 * /api/hotels?country=TH&city=Bangkok&q=hilton → up to 30 hotels.
 * Data: OpenStreetMap (© OpenStreetMap contributors). Only the city and country are sent there.
 * A city's list is fetched once and kept for 30 days in the database.
 */
type Hotel = { name: string; address: string | null; kind: string };

// Public OpenStreetMap servers, fastest first (the main one is often busy).
const OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
/** The first look-up of a big city can take ~30–60 s; later ones come from the database. */
export const maxDuration = 120;
const KEEP_DAYS = 30;

function addressOf(tags: Record<string, string>, city: string): string | null {
  // English address parts when the map has them (e.g. Thai addresses), otherwise the local ones.
  const t: Record<string, string> = { ...tags };
  for (const k of Object.keys(tags)) if (k.startsWith("addr:") && k.endsWith(":en")) t[k.slice(0, -3)] = tags[k];
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [
    street || t["addr:place"],
    t["addr:subdistrict"],
    t["addr:district"],
    t["addr:city"] || city,
    t["addr:postcode"],
  ].filter((p, i, a): p is string => !!p && a.indexOf(p) === i);
  return street || t["addr:place"] || t["addr:district"] || t["addr:subdistrict"] ? parts.join(", ") : t["addr:full"] || null;
}

/** The city's centre from the city list (city first, then province / state of that name). */
function cityCentre(country: string, city: string): { lat: number; lon: number } | null {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const want = fold(city);
  const hit =
    (City.getCitiesOfCountry(country) ?? []).find((c) => fold(c.name) === want) ??
    State.getStatesOfCountry(country).find((s) => fold(s.name).replace(/\s+(province|prefecture|governorate|region|district|state)$/, "") === want);
  const lat = Number(hit?.latitude);
  const lon = Number(hit?.longitude);
  return hit && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

async function fetchCity(country: string, city: string): Promise<Hotel[]> {
  const at = cityCentre(country, city);
  if (!at) return []; // a city typed by hand that isn't in the list: no hotel list, type the hotel in
  // Places to stay within about 6 km of the city centre.
  const query = `[out:json][timeout:50];
nwr["tourism"~"^(hotel|hostel|guest_house|apartment|motel|resort)$"]["name"](around:6000,${at.lat},${at.lon});
out tags 3000;`;
  const reasons: string[] = [];
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "travel-record-app/1.0" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(55_000),
        cache: "no-store",
      });
      if (!res.ok) {
        reasons.push(`${new URL(url).host}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: { tags?: Record<string, string> }[] };
      const seen = new Set<string>();
      const hotels: Hotel[] = [];
      for (const e of data.elements ?? []) {
        const t = e.tags ?? {};
        const name = (t["name:en"] || t.name || "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        hotels.push({ name, address: addressOf(t, city), kind: (t.tourism ?? "hotel").replace("_", " ") });
      }
      return hotels;
    } catch (e) {
      reasons.push(`${new URL(url).host}: ${e instanceof Error ? e.name + " " + e.message : String(e)}`);
    }
  }
  throw new Error(`Hotel list is not available right now (${reasons.join("; ")}).`);
}

export async function GET(req: Request) {
  if (!(await getSession())) return new Response("Forbidden", { status: 403 });
  const params = new URL(req.url).searchParams;
  const country = (params.get("country") ?? "").toUpperCase();
  const city = (params.get("city") ?? "").trim().slice(0, 80);
  const q = (params.get("q") ?? "").trim().toLowerCase();
  if (!/^[A-Z]{2}$/.test(country) || city.length < 2) return Response.json({ hotels: [] });

  const sql = await getDb();
  const cityKey = city.toLowerCase();
  const [cached] = await sql<{ hotels: Hotel[]; fresh: boolean }[]>`
    select hotels, fetched_at > now() - make_interval(days => ${KEEP_DAYS}) as fresh
    from hotel_cache where country = ${country} and city = ${cityKey}`;
  let hotels = cached?.hotels ?? [];
  if (!cached?.fresh) {
    try {
      // One look-up per city at a time, even if several people ask together.
      const key = `${country}|${cityKey}`;
      let job = inFlight.get(key);
      if (!job) {
        job = fetchCity(country, city).finally(() => inFlight.delete(key));
        inFlight.set(key, job);
      }
      hotels = await job;
      // Keep it for next time (if saving fails, the list is still shown now).
      await sql`insert into hotel_cache ${sql({ country, city: cityKey, hotels: sql.json(hotels) as unknown as Hotel[] })}
        on conflict (country, city) do update set hotels = excluded.hotels, fetched_at = now()`.catch((e: unknown) =>
        console.error("hotels: couldn't keep the list", e instanceof Error ? e.message : e),
      );
    } catch (e) {
      console.error("hotels:", country, city, e instanceof Error ? e.message : e);
      if (!cached) return Response.json({ hotels: [], error: `Couldn't load hotels in ${city}, ${countryName(country)} right now. Type the hotel in.`, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // Without q: the whole list (the browser searches it). Hotels with an address first, then by name.
  const order = (a: Hotel, b: Hotel) => Number(!a.address) - Number(!b.address) || a.name.localeCompare(b.name);
  const list = q ? hotels.filter((h) => h.name.toLowerCase().includes(q)) : hotels;
  return Response.json({ hotels: [...list].sort(order), total: hotels.length });
}

const inFlight = new Map<string, Promise<Hotel[]>>();
