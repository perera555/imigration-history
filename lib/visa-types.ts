import { isSchengen } from "./countries";

/**
 * Visa category codes printed on visa stickers ("T", "TR", "NON-B", "L", "B1/B2"…) and what they mean.
 * Country-specific first; the generic list is used for any other country.
 */
const BY_COUNTRY: Record<string, Record<string, string>> = {
  TH: {
    T: "Tourist", TR: "Tourist", TS: "Transit", METV: "Multiple-entry tourist", DTV: "Destination Thailand (long stay)",
    B: "Non-immigrant business", "NON-B": "Non-immigrant business", ED: "Education", "NON-ED": "Non-immigrant education",
    O: "Non-immigrant (family / other)", "NON-O": "Non-immigrant (family / other)", "O-A": "Retirement (long stay)",
    "O-X": "Retirement (10 years)", "NON-IMM": "Non-immigrant", "NON-IM": "Non-immigrant", IM: "Non-immigrant (investment)",
    F: "Official", D: "Diplomatic", SMART: "SMART visa",
  },
  IN: {
    T: "Tourist", "E-T": "e-Tourist", ETV: "e-Tourist", B: "Business", "E-B": "e-Business", E: "Employment", X: "Entry",
    S: "Student", MED: "Medical", "E-MED": "e-Medical", C: "Conference", J: "Journalist", R: "Research", TR: "Transit", P: "Project",
  },
  CN: {
    L: "Tourist", M: "Business", F: "Exchange / non-business visit", Q1: "Family reunion (long stay)", Q2: "Family visit",
    S1: "Private visit (long stay)", S2: "Private visit", X1: "Study (long term)", X2: "Study (short term)", Z: "Work",
    G: "Transit", C: "Crew", D: "Permanent residence", J1: "Journalist (resident)", J2: "Journalist (short trip)", R: "Talent",
  },
  VN: { DL: "Tourist", DN: "Business", DN1: "Business", DN2: "Business", EV: "e-Visa", TT: "Family visit", DH: "Study", HN: "Conference", LD: "Work" },
  US: {
    B1: "Business visitor", B2: "Tourist", "B1/B2": "Business / tourist visitor", "B-1/B-2": "Business / tourist visitor",
    F1: "Student", "F-1": "Student", J1: "Exchange visitor", "J-1": "Exchange visitor", H1B: "Specialty worker", "H-1B": "Specialty worker",
    L1: "Intracompany transfer", "C1/D": "Transit / crew", K1: "Fiancé(e)", O1: "Extraordinary ability", E2: "Treaty investor",
  },
  ID: { B211A: "Visit", C211: "Visit", C212: "Multiple-entry visit", VOA: "Visa on arrival", "E-VOA": "e-Visa on arrival" },
  LK: { T: "Tourist", B: "Business", TR: "Transit", ETA: "Electronic travel authorization" },
};

/** Schengen sticker "Type of visa" field. */
const SCHENGEN: Record<string, string> = { A: "Airport transit", C: "Short stay (Schengen)", D: "National long stay" };

const GENERIC: Record<string, string> = {
  T: "Tourist", TR: "Tourist", TS: "Transit", B: "Business", S: "Student", E: "Employment", W: "Work", V: "Visit",
  ED: "Education", VOA: "Visa on arrival", ETA: "Electronic travel authorization", TRANSIT: "Transit",
};

/** A "passport number" that is really the visa number (same digits, e.g. "A0012345" and "12345"). */
export function isVisaNumber(passport: string | null | undefined, visaNumber: string | null | undefined): boolean {
  const digits = (s: string | null | undefined) => (s ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");
  return digits(passport).length >= 5 && digits(passport) === digits(visaNumber);
}

const norm =(s: string) => s.trim().toUpperCase().replace(/\s+/g, "").replace(/–|—/g, "-");

/** What a visa category code means, e.g. ("TH", "T") → "Tourist"; null when it isn't a known code. */
export function visaTypeMeaning(countryCode: string | null | undefined, type: string | null | undefined): string | null {
  if (!type) return null;
  const code = norm(type);
  if (code.length > 6 || !/^[A-Z0-9\-/]+$/.test(code)) return null; // a written name ("Tourist"), not a code
  const cc = (countryCode ?? "").toUpperCase();
  return BY_COUNTRY[cc]?.[code] ?? (isSchengen(cc) ? SCHENGEN[code] : undefined) ?? GENERIC[code] ?? null;
}

/** The visa type to show: a code gets its meaning, e.g. "T" → "Tourist (T)"; a written name stays as it is. */
export function visaTypeName(countryCode: string | null | undefined, type: string | null | undefined): string {
  if (!type?.trim()) return "Visa";
  const meaning = visaTypeMeaning(countryCode, type);
  return meaning ? `${meaning} (${type.trim()})` : type.trim();
}
