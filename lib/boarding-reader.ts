import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export type BoardingDetails = {
  airline: string | null;
  flightNumber: string | null;
  fromAirport: string | null;
  toAirport: string | null;
  flightDate: string | null;
  seat: string | null;
  bookingRef: string | null;
};

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

function findDate(t: string): string | null {
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})[\s\-]?([A-Za-z]{3})[a-z]*[\s\-,]*(\d{4}|\d{2})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(Number(m[1]))}`;
  }
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

const AIRLINES: Record<string, string> = {
  UL: "SriLankan Airlines", EK: "Emirates", QR: "Qatar Airways", EY: "Etihad Airways", SQ: "Singapore Airlines",
  TG: "Thai Airways", MH: "Malaysia Airlines", AK: "AirAsia", FD: "Thai AirAsia", "6E": "IndiGo", AI: "Air India",
  QF: "Qantas", NZ: "Air New Zealand", BA: "British Airways", KL: "KLM", AF: "Air France", LH: "Lufthansa",
  TK: "Turkish Airlines", CX: "Cathay Pacific", CA: "Air China", MU: "China Eastern", CZ: "China Southern",
  FZ: "flydubai", WY: "Oman Air", GF: "Gulf Air", KU: "Kuwait Airways", SV: "Saudia", VN: "Vietnam Airlines",
};

/** Reads an e-boarding pass PDF that contains text. Returns null when there's no readable text. */
export async function readBoardingPdf(bytes: Uint8Array): Promise<BoardingDetails | null> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const t = String(text).replace(/[ \t]+/g, " ");
  if (t.replace(/\s/g, "").length < 20) return null;

  const flight = t.match(/(?:flight|flt)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{2})\s?(\d{2,4})\b/i) ?? t.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{3,4})\b/);
  const route =
    t.match(/\b([A-Z]{3})\s*(?:→|->|–|-|to|\/)\s*([A-Z]{3})\b/) ??
    (() => {
      const from = t.match(/(?:from|origin|departure)\s*[:\-]?\s*.*?\(?\b([A-Z]{3})\b\)?/i);
      const to = t.match(/(?:to|destination|arrival)\s*[:\-]?\s*.*?\(?\b([A-Z]{3})\b\)?/i);
      return from && to ? ([null, from[1], to[1]] as unknown as RegExpMatchArray) : null;
    })();
  const code = flight?.[1]?.toUpperCase() ?? null;

  return {
    airline: (code && AIRLINES[code]) ?? t.match(/\b([A-Z][a-z]+ (?:Airlines|Airways|Air))\b/)?.[1] ?? null,
    flightNumber: flight ? `${flight[1].toUpperCase()}${flight[2]}` : null,
    fromAirport: route?.[1] ?? null,
    toAirport: route?.[2] ?? null,
    flightDate: findDate(t),
    seat: t.match(/seat\s*(?:no\.?)?\s*[:\-]?\s*(\d{1,2}[A-K])\b/i)?.[1]?.toUpperCase() ?? null,
    bookingRef: t.match(/(?:pnr|booking\s*(?:ref(?:erence)?|code)|confirmation|record locator)\s*[:\-#]?\s*([A-Z0-9]{5,8})\b/i)?.[1]?.toUpperCase() ?? null,
  };
}
