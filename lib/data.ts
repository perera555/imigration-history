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
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  nationalId: string | null;
  previousPassports: string[];
  photo: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Issue date of the record (YYYY-MM-DD). */
  issuedOn: string;
  /** Latest change to the profile or any of its trips (YYYY-MM-DD). */
  lastUpdated: string;
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
> & {
  tripCount: number;
  countryCount: number;
  firstTrip: string | null;
  lastTrip: string | null;
  lastUpdated: string;
};

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
           min(t.departure_date)::text as first_trip,
           max(t.departure_date)::text as last_trip,
           greatest(p.updated_at, max(t.created_at))::date::text as last_updated
    from profiles p
    left join trips t on t.profile_id = p.id
    group by p.id
    order by p.full_name`;
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!isUuid(id)) return null;
  const sql = await getDb();
  const rows = await sql<Profile[]>`
    select p.*,
           p.created_at::date::text as issued_on,
           greatest(p.updated_at, (select max(t.created_at) from trips t where t.profile_id = p.id))::date::text
             as last_updated
    from profiles p where p.id = ${id}`;
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

// ---------- visas ----------

export type Visa = {
  id: string;
  profileId: string;
  countryCode: string;
  visaType: string;
  /** e-Visa, Paper visa, Visa on arrival, ETA */
  visaFormat: string | null;
  visaNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  travelFrom: string | null;
  travelTo: string | null;
  purpose: string | null;
  entries: string | null;
  stayDays: number | null;
  issuedAt: string | null;
  passportNumber: string | null;
  status: string | null;
  notes: string | null;
  hasDocument: boolean;
  documentName: string | null;
};

const VISA_COLUMNS = (sql: Awaited<ReturnType<typeof getDb>>) => sql`
  v.id, v.profile_id, trim(v.country_code) as country_code, v.visa_type, v.visa_format, v.visa_number, v.issue_date,
  v.expiry_date, v.travel_from, v.travel_to, v.purpose, v.entries, v.stay_days, v.issued_at, v.passport_number, v.status, v.notes,
  (d.visa_id is not null) as has_document, d.file_name as document_name`;

export async function getVisas(profileId: string): Promise<Visa[]> {
  if (!isUuid(profileId)) return [];
  const sql = await getDb();
  return sql<Visa[]>`
    select ${VISA_COLUMNS(sql)}
    from visas v left join visa_documents d on d.visa_id = v.id
    where v.profile_id = ${profileId}
    order by v.issue_date desc nulls last, v.created_at desc`;
}

export async function getVisa(id: string): Promise<Visa | null> {
  if (!isUuid(id)) return null;
  const sql = await getDb();
  const rows = await sql<Visa[]>`
    select ${VISA_COLUMNS(sql)}
    from visas v left join visa_documents d on d.visa_id = v.id
    where v.id = ${id}`;
  return rows[0] ?? null;
}

export type VisaState = { label: string; tone: "valid" | "expired" | "upcoming" | "closed"; detail: string | null };

/** Valid / Expired / Not yet valid, or a manual status like "Used" or "Cancelled". */
export function visaState(visa: Pick<Visa, "issueDate" | "expiryDate" | "status">, today = new Date()): VisaState {
  const t = today.toISOString().slice(0, 10);
  if (visa.status) return { label: visa.status, tone: "closed", detail: null };
  if (visa.expiryDate && visa.expiryDate < t) return { label: "Expired", tone: "expired", detail: null };
  if (visa.issueDate && visa.issueDate > t) return { label: "Not yet valid", tone: "upcoming", detail: null };
  if (visa.expiryDate) {
    const days = Math.round((Date.parse(visa.expiryDate) - Date.parse(t)) / 86_400_000);
    return { label: "Valid", tone: "valid", detail: `${days} day${days === 1 ? "" : "s"} left` };
  }
  return { label: "Valid", tone: "valid", detail: null };
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

/** Short, stable record number derived from the profile id, e.g. "IH-353DFA0D". */
export function recordNumber(id: string): string {
  return `IH-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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
