import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { COUNTRIES, NATIONALITIES } from "./countries";
import { alpha3ToAlpha2 } from "i18n-iso-countries";

/** Details found in a visa document. Every field may be missing. */
export type VisaDetails = {
  countryCode: string | null;
  visaType: string | null;
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
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Parses one date written as "12 March 2024", "12-MAR-2024", "12/03/2024", "2024-03-12" or "March 12, 2024". */
function parseDate(s: string): string | null {
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  // Also run together, as printed on visa stickers: "01FEB2024".
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]*([A-Za-z]{3,9})\.?[\s\-/.,]*(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(+m[1])}`;
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${pad(+m[2])}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); // day first (most visas outside the US)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

const DATE = String.raw`(\d{1,2}(?:st|nd|rd|th)?[\s\-/.]*[A-Za-z]{3,9}\.?[\s\-/.,]*\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})`;

function dateAfter(text: string, labels: string): string | null {
  // Value right after the label, or (sticker layout) on the line below, after other values.
  const m =
    text.match(new RegExp(`(?:${labels})\\s*[:\\-]?\\s*${DATE}`, "i")) ??
    text.match(new RegExp(`(?:${labels})[^0-9]{0,60}?${DATE}`, "i"));
  return m ? parseDate(m[1]) : null;
}

/** Sticker layout: labels on one line, values on the next ("TYPE OF VISA … / Tourist …"). */
function valueBelow(text: string, label: RegExp): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => label.test(l));
  return i >= 0 && lines[i + 1] ? lines[i + 1].split(/\s+/) : [];
}

const KNOWN_TYPE = /\b(tourist|business|transit|student|education|non-immigrant|work|employment|visitor|diplomatic|official|medical|family|retirement)\b/i;

const LABEL_WORDS = /\b(category|entr(?:y|ies)|fee|issue|issued|date|passport|valid|until|remarks|place|surname|sex|birth|nationality)\b/i;

function guessCountry(text: string, exclude: string | null): string | null {
  const lower = text.toLowerCase();
  const counts = new Map<string, number>();
  const add = (code: string, name: string) => {
    if (code === exclude || name.length < 4) return;
    const re = new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const n = lower.match(re)?.length ?? 0;
    if (n) counts.set(code, (counts.get(code) ?? 0) + n * (name.length > 6 ? 2 : 1));
  };
  for (const c of COUNTRIES) add(c.code, c.name);
  for (const n of NATIONALITIES) add(n.code, n.name);
  for (const [alias, code] of [["uae", "AE"], ["dubai", "AE"], ["usa", "US"], ["u\\.s\\.", "US"], ["uk visas", "GB"]] as const) {
    // Whole words only (scanned text is full of random letters like "nie uae").
    if (new RegExp(`(?:^|[^a-z])${alias}(?:[^a-z]|$)`).test(lower) && code !== exclude) counts.set(code, (counts.get(code) ?? 0) + 3);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [code, n] of counts) if (n > bestN) [best, bestN] = [code, n];
  return best;
}

/** Reads a text-based visa PDF (e-visa, grant notice). Returns null when the PDF has no readable text. */
export async function readVisaPdf(bytes: Uint8Array, holderNationalityCode: string | null): Promise<VisaDetails | null> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return parseVisaText(String(text), holderNationalityCode);
}

/**
 * The machine-readable zone at the bottom of a visa sticker (ICAO 9303 MRV, 2 lines):
 *   V<THASURNAME<<GIVEN<NAMES<<<…            (V, issuing country, name)
 *   XX000000<0LKA0001011F3001010012345<<      passport no. (9) + check, nationality (3),
 *                                              birth date (6) + check, sex, VALID-UNTIL date (6) + check,
 *                                              then optional data — on Thai visas the visa number's digits.
 * Also works on OCR text, where "<" may come out as "«", "‹" or "K".
 */
function parseVisaMrz(
  text: string,
): { countryCode: string | null; visaNumberDigits: string | null; expiryDate: string | null; passportNumber: string | null } | null {
  // Scanned text: stray characters around the lines, letters read for digits (S→5, O→0, I→1, B→8…).
  const lines = text
    .split(/\n/)
    .map((l) => l.toUpperCase().replace(/[«‹(\[{£€]/g, "<").replace(/[^A-Z0-9<]/g, ""));
  const D = "[0-9OSIBZGQDL]"; // a digit, or a letter OCR confuses with one
  const toDigits = (s: string) => s.replace(/[OQD]/g, "0").replace(/S/g, "5").replace(/[IL]/g, "1").replace(/B/g, "8").replace(/Z/g, "2").replace(/G/g, "6");
  // Line 2 anywhere: passport (9) · check · nationality (3) · birth date (6) · check · sex · valid until (6) · check · optional data
  const line2 = new RegExp(`([A-Z0-9<]{9})${D}([A-Z<]{3})(${D}{6})${D}([MFX<K])(${D}{6})${D}?([A-Z0-9<]*)`);
  let i = -1;
  let m2: RegExpMatchArray | null = null;
  for (let k = 0; k < lines.length && !m2; k++) {
    const m = lines[k].length >= 26 ? lines[k].match(line2) : null;
    if (m && /\d/.test(m[1]) && /^[A-Z<]{3}$/.test(m[2])) [i, m2] = [k, m];
  }
  // Line 1 just above: "V" + one filler (read as <, K, S, C…) + issuing country (3 letters).
  let countryCode: string | null = null;
  for (let k = Math.max(0, (i < 0 ? lines.length : i) - 3); k < (i < 0 ? lines.length : i); k++) {
    const m = lines[k].match(/V[<KSCLE]?([A-Z]{3})[A-Z<]{3,}/);
    if (!m) continue;
    const special: Record<string, string> = { D: "DE", GBR: "GB", UTO: "" };
    const code = (special[m[1]] ?? alpha3ToAlpha2(m[1]) ?? null) || null;
    if (code) countryCode = code;
  }
  if (!m2 && !countryCode) return null;
  const ok = !!m2;
  const yymmdd = (raw: string, future: boolean) => {
    const s = toDigits(raw);
    if (!/^\d{6}$/.test(s)) return null;
    const yy = Number(s.slice(0, 2));
    const year = future ? 2000 + yy : yy > Number(String(new Date().getFullYear()).slice(2)) ? 1900 + yy : 2000 + yy;
    const iso = `${year}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  };
  const optional = ok ? (m2![6].replace(/</g, "").match(/\d{5,}/)?.[0] ?? null) : null;
  void i;
  return {
    countryCode,
    passportNumber: ok ? m2![1].replace(/</g, "") || null : null,
    expiryDate: ok ? yymmdd(m2![5], true) : null,
    visaNumberDigits: optional,
  };
}

/** Sticker without readable labels: the earliest date in the 2 years before the valid-until date. */
function issueFromDates(text: string, expiry: string | null): string | null {
  if (!expiry) return null;
  const dates = [...text.matchAll(new RegExp(DATE, "gi"))].map((m) => parseDate(m[1])).filter((d): d is string => !!d && !Number.isNaN(Date.parse(d)));
  const start = new Date(Date.parse(expiry) - 2 * 365 * 86_400_000).toISOString().slice(0, 10);
  return dates.filter((d) => d < expiry && d >= start).sort()[0] ?? null;
}

/** The printed visa number (a letter and 6–8 digits, e.g. "X 0012345"), ideally matching the digits in the MRZ. */
function printedVisaNumber(text: string, digits: string | null): string | null {
  if (!digits) return null;
  const up = text.toUpperCase();
  // Printed on the sticker: with a letter ("X 0012345") or, when OCR drops it, just the digits.
  const lettered = [...up.matchAll(/\b([A-Z])\s?(\d{6,8})\b/g)].map((m) => ({ full: `${m[1]}${m[2]}`, digits: m[2] }));
  const bare = [...up.matchAll(/(?<![A-Z0-9<])(\d{6,8})(?![0-9<])/g)].map((m) => ({ full: m[1], digits: m[1] }));
  const strip = (s: string) => s.replace(/^0+/, "");
  // The machine-read digits can carry an extra check digit at the end ("00123456" for "0012345").
  const matches = (c: { digits: string }) => {
    const a = strip(c.digits);
    const b = strip(digits);
    return a.length >= 5 && (a === b || b.startsWith(a) || b.endsWith(a) || a.endsWith(b));
  };
  const hit = lettered.find(matches) ?? bare.find(matches);
  return hit ? hit.full : digits;
}

/** Visa details from the text of one visa page (or a whole e-visa). Null when there's almost no text. */
/** Purpose wording on visas → the purposes in the visa form ("Recreation/Sight-Seeing" → "Tourism"). */
function purposeName(raw: string | null): string | null {
  if (!raw) return null;
  if (/recreation|sight[\s-]*seeing|touris|holiday|leisure/i.test(raw)) return "Tourism";
  if (/business|meeting/i.test(raw)) return "Business";
  if (/medical|treatment/i.test(raw)) return "Medical";
  if (/stud|education/i.test(raw)) return "Study";
  return raw;
}

export function parseVisaText(text: string, holderNationalityCode: string | null): VisaDetails | null {
  const t = String(text).replace(/[ \t]+/g, " ");
  if (t.replace(/\s/g, "").length < 40) return null;
  const mrz = parseVisaMrz(String(text));
  const details = parseVisaFields(t, holderNationalityCode);
  if (!mrz) return details;
  // The machine-readable lines are the most reliable source for country, passport, valid-until and number.
  const visaNumber = printedVisaNumber(t, mrz.visaNumberDigits) ?? details.visaNumber;
  return {
    ...details,
    countryCode: mrz.countryCode ?? details.countryCode,
    visaNumber: visaNumber && visaNumber !== mrz.passportNumber ? visaNumber : details.visaNumber,
    expiryDate: mrz.expiryDate ?? details.expiryDate,
    travelTo: mrz.expiryDate ?? details.travelTo,
    passportNumber: mrz.passportNumber ?? details.passportNumber,
    // A visa with the machine-readable lines is a sticker in the passport.
    visaFormat: mrz.passportNumber || mrz.expiryDate ? "Paper visa" : details.visaFormat,
    // No issue date printed (e.g. "Valid from" only): use the start of validity.
    issueDate: details.issueDate ?? details.travelFrom ?? issueFromDates(t, mrz.expiryDate),
  };
}

function parseVisaFields(t: string, holderNationalityCode: string | null): VisaDetails {

  const visaNumber =
    // Indian e-Visa: the visa number is the "ETA Number" (the Application ID is only the application).
    t.match(/\bETA\s*(?:no\.?|number)\s*[:\-]?\s*((?=[A-Z0-9]*\d)[A-Z0-9]{6,20})\b/i)?.[1] ??
    // e.g. "Visa No: …", "Grant reference number: …", "Application ref: …"; a visa number always has a digit.
    t.match(
      /(?:visa|e-?visa|grant|application|reference|transaction|control)(?:\s+reference)?\s*(?:no\.?|number|#|ref(?:erence)?\.?)(?:\s*(?:no\.?|number))?\s*[:\-]?\s*((?=[A-Z0-9\-/]*\d)[A-Z0-9][A-Z0-9\-/]{4,24})\b/i,
    )?.[1] ?? null;
  const visaTypeRaw =
    t.match(/(?:visa\s*(?:type|category|class|subclass)|type of visa|category|subclass)\s*[:\-]?\s*([A-Za-z0-9 ()&\-/]{2,50}?)(?:\s{2,}|\n|$|\s+(?:visa\s*no|number|date|valid|entr|duration|passport))/i)?.[1] ?? null;
  const entriesRaw =
    t.match(/\b(single|double|multiple)\s*[- ]?\s*entr(?:y|ies)\b/i)?.[1] ??
    t.match(/(?:no\.?\s*of\s*entries|entries|entry)\s*[:\-]?\s*(single|double|multiple|1|2|m|s|d)\b/i)?.[1] ??
    // Sticker: "NO OF ENTRY" label with "S" / "SINGLE" on the line below.
    valueBelow(t, /no\.?\s*of\s*entr/i).find((w) => /^(single|double|multiple|s|d|m)$/i.test(w)) ??
    t.match(/\b(single|multiple)\b/i)?.[1] ??
    // Scans: "SINGLE" can come out as "ASINGER", "S1NGLE"…
    (/S[I1l]NG(?:LE|ER|E)/i.test(t) ? "single" : /MU[L1]T[I1]P[L1]E/i.test(t) ? "multiple" : null);
  // Sticker: "TYPE OF VISA" label with "Tourist" below (also from category "TR").
  const typeBelow =
    valueBelow(t, /type of visa/i).find((w) => /^[A-Za-z][A-Za-z\-]{3,}$/.test(w) && !LABEL_WORDS.test(w) && KNOWN_TYPE.test(w)) ??
    // Noisy scan: a known visa type word anywhere ("Tourist", "TOURIST", "Non-Immigrant"…).
    t.match(KNOWN_TYPE)?.[0];
  const entriesMap: Record<string, string> = { s: "Single", "1": "Single", single: "Single", d: "Double", "2": "Double", double: "Double", m: "Multiple", multiple: "Multiple" };
  const stay = t.match(/(?:duration of stay|length of stay|period of stay|stay(?: of| up to| period)?|max(?:imum)? stay)\s*[:\-]?\s*(?:of\s*)?(\d{1,3})\s*days?/i)?.[1];

  // Full visa names first: "Student (subclass 500)", "granted you a Visitor (subclass 600) visa".
  const namedType =
    // Indian e-Visa: "ETA for e-Tourist Visa 1 year" → "e-Tourist"
    t.match(/\b(e-(?:tourist|business|medical|conference|student|ayush))\s+visa\b/i)?.[1]?.replace(/^e-(\w)/i, (_, c: string) => `e-${c.toUpperCase()}`) ??
    // The visa title only (1–4 capitalised words), e.g. "Temporary Skill Shortage (subclass 482)".
    t.match(/\b((?:[A-Z][a-z'&\-]+\s+){0,3}[A-Z][a-z'&\-]+\s*\(subclass\s*\d{3}\))/)?.[1] ??
    t.match(/granted you an?\s+([A-Za-z0-9'()&\- ]{3,60}?)\s+visa\b/i)?.[1] ??
    null;

  return {
    countryCode: guessCountry(t, holderNationalityCode),
    visaType: namedType
      ? namedType.trim().replace(/\s+/g, " ")
      : typeBelow
        ? typeBelow.charAt(0).toUpperCase() + typeBelow.slice(1).toLowerCase()
        : visaTypeRaw && !/^\d+\)?$/.test(visaTypeRaw.trim()) && !LABEL_WORDS.test(visaTypeRaw)
        ? visaTypeRaw.trim().replace(/\s+/g, " ")
      : /schengen/i.test(t) ? (/type\s*d\b|national visa/i.test(t) ? "Schengen visa (national, type D)" : "Schengen visa (short stay)") : null,
    // Only clear wording counts (scanned pages are full of random letters such as "eta").
    visaFormat: /electronic travel authori[sz](?:ation|ity)/i.test(t)
      ? "ETA"
      : /\b(e-visa|evisa|electronic visa|grant notice|visa grant number|we have granted you)\b/i.test(t)
        ? "e-Visa"
        : /visa on arrival/i.test(t)
          ? "Visa on arrival"
          : null,
    visaNumber: visaNumber ? visaNumber.toUpperCase() : null,
    issueDate: dateAfter(t, "date of issue|issue date|issued on|date issued|grant date|date of grant|granted on"),
    expiryDate:
      dateAfter(t, "date of expiry|expiry date|expiration date|expires on|expires|visa expiry|visa valid until|stay until|length of stay|period of stay until") ??
      dateAfter(t, "must not arrive after|last date of entry|enter before"),
    travelFrom: dateAfter(t, "valid from|travel from|from date|start date|first entry|enter from|period of validity from"),
    travelTo: dateAfter(t, "valid until|valid till|valid to|travel until|travel to|until|end date|must not arrive after|last date of entry|enter before"),
    purpose: purposeName(
      t.match(/(?:purpose of (?:visit|travel|entry)|purpose|activities permitted)\s*[:\-]?\s*([A-Za-z &\/-]{3,40}?)(?:\s{2,}|\n|$|\s+(?:visa|date|valid|entr|passport|duration|guidelines))/i)?.[1]?.trim() ?? null,
    ),
    entries: entriesRaw ? entriesMap[entriesRaw.toLowerCase()] ?? null : null,
    stayDays: stay
      ? Number(stay)
      : // e.g. Indian e-Visa: "Continuous stay in India on each entry should not exceed 90 days"
        Number(t.match(/(?:stay|each entry)[^.\n]{0,60}?(?:not exceed|maximum of|up to)\s*(\d{1,3})\s*days/i)?.[1]) || null,
    issuedAt: t.match(/(?:place of issue|issued at|issuing (?:post|office|authority)|issued by)\s*[:\-]?\s*([A-Za-z ,.'-]{3,50}?)(?:\s{2,}|\n|$|\s+(?:date|visa|valid|passport))/i)?.[1]?.trim() ?? null,
    passportNumber:
      t.match(/passport\s*(?:\((?:or )?other travel\s+document\)\s*)?(?:no\.?|number|#)\s*[:\-]?\s*([A-Z]{1,2}\d{6,9})/i)?.[1]?.toUpperCase() ?? null,
  };
}
