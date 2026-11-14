import "server-only";
import { getDb } from "./db";
import { countryName } from "./countries";

export type Profile = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  sex: string | null;
  nationality: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  passportNumber: string | null;
  previousPassports: string[];
  photo: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Trip = {
  id: string;
  profileId: string;
  countryCode: string;
  city: string | null;
  departureDate: string;
  returnDate: string | null;
  purpose: string;
  passportNumber: string | null;
  notes: string | null;
};

export type ProfileSummary = Pick<
  Profile,
  "id" | "fullName" | "photo" | "passportNumber" | "nationality"
> & { tripCount: number; countryCount: number; lastTrip: string | null };

export type CountryGroup = {
  countryCode: string;
  countryName: string;
  visits: Trip[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID.test(id);

export async function listProfiles(): Promise<ProfileSummary[]> {
  const sql = await getDb();
  return sql<ProfileSummary[]>`
    select p.id, p.full_name, p.photo, p.passport_number, p.nationality,
           count(t.id)::int as trip_count,
           count(distinct t.country_code)::int as country_count,
           max(t.departure_date)::text as last_trip
    from profiles p
    left join trips t on t.profile_id = p.id
    group by p.id
    order by p.full_name`;
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!isUuid(id)) return null;
  const sql = await getDb();
  const rows = await sql<Profile[]>`select * from profiles where id = ${id}`;
  return rows[0] ?? null;
}

export async function getTrips(profileId: string): Promise<Trip[]> {
  if (!isUuid(profileId)) return [];
  const sql = await getDb();
  return sql<Trip[]>`
    select id, profile_id, trim(country_code) as country_code, city, departure_date,
           return_date, purpose, passport_number, notes
    from trips where profile_id = ${profileId}
    order by departure_date, created_at`;
}

export async function getTrip(id: string): Promise<Trip | null> {
  if (!isUuid(id)) return null;
  const sql = await getDb();
  const rows = await sql<Trip[]>`
    select id, profile_id, trim(country_code) as country_code, city, departure_date,
           return_date, purpose, passport_number, notes
    from trips where id = ${id}`;
  return rows[0] ?? null;
}

// ---------- pure helpers (also used by the PDF) ----------

/** Groups trips by country, ordered by each country's first visit — like the original document. */
export function groupByCountry(trips: Trip[]): CountryGroup[] {
  const groups = new Map<string, CountryGroup>();
  for (const trip of [...trips].sort((a, b) => a.departureDate.localeCompare(b.departureDate))) {
    let group = groups.get(trip.countryCode);
    if (!group) {
      group = { countryCode: trip.countryCode, countryName: countryName(trip.countryCode), visits: [] };
      groups.set(trip.countryCode, group);
    }
    group.visits.push(trip);
  }
  return [...groups.values()];
}

export function tripDays(trip: Pick<Trip, "departureDate" | "returnDate">): number | null {
  if (!trip.returnDate) return null;
  const ms = Date.parse(trip.returnDate) - Date.parse(trip.departureDate);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 86_400_000) + 1 : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Calendar length of a trip, counting both the departure and return day: "1 year 2 months 5 days". */
export function tripDuration(trip: Pick<Trip, "departureDate" | "returnDate">): string | null {
  if (!trip.returnDate || trip.returnDate < trip.departureDate) return null;
  const [y1, m1, d1] = trip.departureDate.split("-").map(Number);
  const [y2, m2, d2] = trip.returnDate.split("-").map(Number);
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  end.setUTCDate(end.getUTCDate() + 1); // inclusive of the return day
  let years = end.getUTCFullYear() - y1;
  let months = end.getUTCMonth() + 1 - m1;
  let days = end.getUTCDate() - d1;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return formatYmd(years, months, days);
}

/** Total days → "2 years 3 months 4 days" (30-day months, 365-day years). */
export function daysToYmd(totalDays: number): string {
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = (totalDays % 365) % 30;
  return formatYmd(years, months, days);
}

function formatYmd(years: number, months: number, days: number): string {
  const parts = [];
  if (years) parts.push(plural(years, "year"));
  if (months) parts.push(plural(months, "month"));
  if (days || !parts.length) parts.push(plural(days, "day"));
  return parts.join(" ");
}

export function travelStats(trips: Trip[]) {
  const countries = new Set(trips.map((t) => t.countryCode));
  const days = trips.reduce((sum, t) => sum + (tripDays(t) ?? 0), 0);
  const years = trips.map((t) => t.departureDate.slice(0, 4)).sort();
  return {
    trips: trips.length,
    countries: countries.size,
    daysAbroad: days,
    span: years.length ? `${years[0]}–${years[years.length - 1]}` : "—",
  };
}

export function ageFrom(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
