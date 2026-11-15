import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { COUNTRIES, NATIONALITIES } from "./countries";

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
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(+m[1])}`;
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${pad(+m[2])}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); // day first (most visas outside the US)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

const DATE = String.raw`(\d{1,2}(?:st|nd|rd|th)?[\s\-/.]+[A-Za-z]{3,9}\.?[\s\-/.,]+\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})`;

function dateAfter(text: string, labels: string): string | null {
  const m = text.match(new RegExp(`(?:${labels})\\s*[:\\-]?\\s*${DATE}`, "i"));
  return m ? parseDate(m[1]) : null;
}

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
  for (const [alias, code] of [["uae", "AE"], ["dubai", "AE"], ["usa", "US"], ["u.s.", "US"], ["uk visas", "GB"]] as const) {
    if (lower.includes(alias) && code !== exclude) counts.set(code, (counts.get(code) ?? 0) + 3);
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
  const t = String(text).replace(/[ \t]+/g, " ");
  if (t.replace(/\s/g, "").length < 40) return null;

  const visaNumber =
    t.match(/(?:visa|e-?visa|grant|application|reference|transaction|control)\s*(?:no\.?|number|#|ref\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{4,24})/i)?.[1] ?? null;
  const visaTypeRaw =
    t.match(/(?:visa\s*(?:type|category|class|subclass)|type of visa|category|subclass)\s*[:\-]?\s*([A-Za-z0-9 ()&\-/]{2,50}?)(?:\s{2,}|\n|$|\s+(?:visa\s*no|number|date|valid|entr|duration|passport))/i)?.[1] ?? null;
  const entriesRaw =
    t.match(/\b(single|double|multiple)\s*[- ]?\s*entr(?:y|ies)\b/i)?.[1] ??
    t.match(/(?:no\.?\s*of\s*entries|entries|entry)\s*[:\-]?\s*(single|double|multiple|1|2|m|s|d)\b/i)?.[1] ??
    null;
  const entriesMap: Record<string, string> = { s: "Single", "1": "Single", single: "Single", d: "Double", "2": "Double", double: "Double", m: "Multiple", multiple: "Multiple" };
  const stay = t.match(/(?:duration of stay|length of stay|period of stay|stay(?: of| up to| period)?|max(?:imum)? stay)\s*[:\-]?\s*(?:of\s*)?(\d{1,3})\s*days?/i)?.[1];

  return {
    countryCode: guessCountry(t, holderNationalityCode),
    visaType: visaTypeRaw
      ? visaTypeRaw.trim().replace(/\s+/g, " ")
      : /schengen/i.test(t) ? (/type\s*d\b|national visa/i.test(t) ? "Schengen visa (national, type D)" : "Schengen visa (short stay)") : null,
    visaFormat: /\b(e-?visa|electronic visa|evisa|grant notice|visa grant|electronic travel authori[sz]ation|eta\b)/i.test(t)
      ? /electronic travel authori[sz]ation|\beta\b/i.test(t) ? "ETA" : "e-Visa"
      : /visa on arrival/i.test(t) ? "Visa on arrival" : null,
    visaNumber: visaNumber ? visaNumber.toUpperCase() : null,
    issueDate: dateAfter(t, "date of issue|issue date|issued on|date issued|grant date|date of grant|granted on"),
    expiryDate: dateAfter(t, "date of expiry|expiry date|expiration date|expires on|expires|visa expiry|visa valid until"),
    travelFrom: dateAfter(t, "valid from|travel from|from date|start date|first entry|enter from|period of validity from"),
    travelTo: dateAfter(t, "valid until|valid till|valid to|travel until|travel to|until|end date|must not arrive after|last date of entry|enter before"),
    purpose: t.match(/(?:purpose of (?:visit|travel|entry)|purpose)\s*[:\-]?\s*([A-Za-z &\/-]{3,40}?)(?:\s{2,}|\n|$|\s+(?:visa|date|valid|entr|passport|duration))/i)?.[1]?.trim() ?? null,
    entries: entriesRaw ? entriesMap[entriesRaw.toLowerCase()] ?? null : null,
    stayDays: stay ? Number(stay) : null,
    issuedAt: t.match(/(?:place of issue|issued at|issuing (?:post|office|authority)|issued by)\s*[:\-]?\s*([A-Za-z ,.'-]{3,50}?)(?:\s{2,}|\n|$|\s+(?:date|visa|valid|passport))/i)?.[1]?.trim() ?? null,
    passportNumber: t.match(/passport\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z]{1,2}\d{6,9})/i)?.[1]?.toUpperCase() ?? null,
  };
}
