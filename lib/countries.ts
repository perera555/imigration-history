import isoCountries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

isoCountries.registerLocale(en);

// Friendlier names for the handful of countries whose ISO names are long or formal.
const NAME_OVERRIDES: Record<string, string> = {
  US: "United States",
  CN: "China",
  GB: "United Kingdom",
  AE: "United Arab Emirates",
  KR: "South Korea",
  KP: "North Korea",
  RU: "Russia",
  TW: "Taiwan",
  VN: "Vietnam",
  LA: "Laos",
  IR: "Iran",
  SY: "Syria",
  BO: "Bolivia",
  VE: "Venezuela",
  TZ: "Tanzania",
  MD: "Moldova",
  CD: "DR Congo",
  CG: "Congo",
  BN: "Brunei",
  FM: "Micronesia",
  PS: "Palestine",
  VA: "Vatican City",
  MK: "North Macedonia",
  CZ: "Czechia",
  NL: "Netherlands",
};

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = Object.entries(
  isoCountries.getNames("en", { select: "official" }),
)
  .map(([code, name]) => ({ code, name: NAME_OVERRIDES[code] ?? name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string): string {
  return BY_CODE.get(code.toUpperCase()) ?? code.toUpperCase();
}

export function isCountryCode(code: string): boolean {
  return BY_CODE.has(code.toUpperCase());
}

/** SVG flag (sharp at any size) for the web UI. */
export function flagSvg(code: string): string {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

/** PNG flag for the PDF renderer (it cannot draw remote SVGs). */
export function flagPng(code: string, width: 40 | 80 | 160 = 80): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}
