import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export type StayDetails = {
  kind: string | null;
  name: string | null;
  address: string | null;
  checkIn: string | null;
  checkOut: string | null;
  bookingRef: string | null;
};

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** First date in a piece of text: 2024-03-05, 5 March 2024, March 5, 2024, Tue 5 Mar 2024, 05/03/2024. */
export function findDate(t: string): string | null {
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(Number(m[1]))}`;
  m = t.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(Number(m[2]))}`;
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

/** Text right after a label, e.g. "Check-in  Tue 5 March 2024 (from 14:00)". */
const after = (t: string, label: RegExp, len = 80) => {
  const m = t.match(label);
  return m ? t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + len) : "";
};

/** Reads a hotel / Airbnb booking confirmation PDF (Booking.com, Airbnb, Agoda, hotel e-mails printed to PDF). */
export async function readStayPdf(bytes: Uint8Array): Promise<StayDetails | null> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const t = String(text).replace(/[ \t]+/g, " ");
  if (t.replace(/\s/g, "").length < 20) return null;
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const checkIn = findDate(after(t, /check[\s-]?in(?:\s*date)?\s*[:\-]?/i)) ?? findDate(after(t, /arrival(?:\s*date)?\s*[:\-]?/i));
  const checkOut = findDate(after(t, /check[\s-]?out(?:\s*date)?\s*[:\-]?/i)) ?? findDate(after(t, /departure(?:\s*date)?\s*[:\-]?/i));
  const ref =
    after(t, /(?:confirmation|booking|reservation)\s*(?:number|no\.?|code|id|#)\s*[:\-]?\s*/i, 40).match(/^[A-Z0-9][A-Z0-9.\-]{4,24}/i)?.[0] ?? null;

  const airbnb = /airbnb/i.test(t);
  const kind = airbnb ? "Airbnb home" : /hostel/i.test(t) ? "Hostel" : /apartment/i.test(t) ? "Apartment" : /resort/i.test(t) ? "Resort" : /guest\s?house/i.test(t) ? "Guesthouse" : /hotel|booking\.com|agoda|expedia/i.test(t) ? "Hotel" : null;

  // Name: a line containing Hotel/Resort/…, or the line after "Property"/"Hotel name"/"Your stay at".
  const labelled = after(t, /(?:property|hotel name|accommodation|your (?:stay|reservation|booking) (?:at|in))\s*[:\-]?\s*/i, 120).split(/\n/)[0]?.trim();
  const named = lines.find((l) => /\b(hotel|resort|inn|suites?|lodge|hostel|guest\s?house|residence|villa)\b/i.test(l) && l.length <= 80 && !/booking\.com|confirmation|check/i.test(l));
  const name = (labelled && labelled.length >= 3 && labelled.length <= 100 ? labelled : named) ?? null;

  const address = after(t, /address\s*[:\-]?\s*/i, 160).split(/\n/)[0]?.trim() || null;

  const details: StayDetails = { kind, name, address: address && address.length >= 6 ? address : null, checkIn, checkOut, bookingRef: ref };
  return Object.values(details).some((v) => v !== null) ? details : null;
}
