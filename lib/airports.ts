import "server-only";
import { airports } from "@nwpr/airport-codes";

/** Current city names where the airport list has old names or odd spelling, and new airports it lacks. */
const CITY_FIX: Record<string, string> = {
  MAA: "Chennai",
  CCU: "Kolkata",
  PNH: "Phnom Penh",
  REP: "Siem Reap",
  SAI: "Siem Reap", // Siem Reap Angkor International (opened 2023)
  DPS: "Bali (Denpasar)",
  SGN: "Ho Chi Minh City",
};

let byCode: Map<string, string> | null = null;
let countryByCode: Map<string, string> | null = null;

/** The country of an airport code, e.g. "CMB" → "Sri Lanka"; null when the code isn't known. */
export function airportCountry(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  if (c === "SAI") return "Cambodia";
  countryByCode ??= new Map(airports.filter((a) => a.iata && a.iata.length === 3 && a.country).map((a) => [a.iata!, a.country!]));
  return countryByCode.get(c) ?? null;
}

/** The city of an airport code, e.g. "CMB" → "Colombo"; null when the code isn't known. */
export function airportCity(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  if (CITY_FIX[c]) return CITY_FIX[c];
  byCode ??= new Map(
    airports
      .filter((a) => a.iata && a.iata.length === 3 && a.city)
      .map((a) => [a.iata!, a.city!.replace(/-/g, " ").replace(/\b\p{L}/gu, (l) => l.toUpperCase())]),
  );
  return byCode.get(c) ?? null;
}
