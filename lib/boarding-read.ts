/**
 * Browser side: gets flight details from a boarding pass file, trying in order
 *  1) the barcode(s) on the pages or photo — every flight detail is in them, including each flight
 *     of a connecting journey (e.g. CMB → AUH and AUH → DUB on one boarding pass),
 *  2) the PDF's own text (airline e-boarding passes without a readable barcode),
 *  3) the printed text of a scan or photo (OCR).
 */
import { readBoardingPass, readBoardingText } from "./boarding-actions";
import type { BoardingDetails } from "./boarding-reader";
import { parseBcbpLegs } from "./bcbp";
import { airlineName } from "./airlines";
import { readBarcodeTexts } from "./barcode";
import { fileToImages, ocrImages } from "./ocr";

export type BoardingRead = {
  /** The first flight (filled into the form). */
  details: Partial<BoardingDetails>;
  /** Every flight found (2+ for a connecting journey). */
  legs: Partial<BoardingDetails>[];
  how: "from the PDF" | "from the barcode" | "from the scan";
} | null;

export async function readBoardingFile(profileId: string, file: File, onProgress?: (message: string) => void): Promise<BoardingRead> {
  onProgress?.("Looking for the boarding pass barcode…");
  const images = file.type === "application/pdf" ? await fileToImages(file, 4) : [file];
  const codes = await readBarcodeTexts(images).catch(() => [] as string[]);
  // Every flight in every barcode, once each (the same barcode can be printed twice).
  const seen = new Set<string>();
  const legs = codes
    .flatMap((c) => parseBcbpLegs(c))
    .filter((b) => {
      const key = `${b.flightNumber}|${b.fromAirport}|${b.toAirport}|${b.flightDate}`;
      return !seen.has(key) && !!seen.add(key);
    })
    .map((b) => ({ airline: airlineName(b.airlineCode), flightNumber: b.flightNumber, fromAirport: b.fromAirport, toAirport: b.toAirport, flightDate: b.flightDate, seat: b.seat, bookingRef: b.bookingRef }));
  if (legs.length) return { details: legs[0], legs, how: "from the barcode" };

  if (file.type === "application/pdf") {
    const fd = new FormData();
    fd.append("file", file);
    const r = await readBoardingPass(profileId, fd).catch(() => null);
    if (r && "ok" in r) return { details: r.details, legs: [r.details], how: "from the PDF" };
  }
  const texts = await ocrImages(images, onProgress);
  const d = await readBoardingText(profileId, texts.join("\n")).catch(() => null);
  return d ? { details: d, legs: [d], how: "from the scan" } : null;
}

/**
 * The visit a flight belongs to. On a day one visit ends and the next begins (Dublin until the 29th,
 * London from the 29th), the flight starts the next visit: its departure; otherwise a visit's return.
 */
export function visitForFlight<T extends { id: string; date: string }>(trips: T[], date: string | null): { trip: T; direction: "Departure" | "Return" } | null {
  if (!date) return null;
  const starts = trips.find((t) => t.date.split("|")[0] === date);
  if (starts) return { trip: starts, direction: "Departure" };
  const ends = trips.find((t) => t.date.split("|")[1] === date);
  return ends ? { trip: ends, direction: "Return" } : null;
}

/**
 * Dates for all flights of one boarding pass. A barcode has only the day of the year, so each flight's
 * year is taken from its partner flights: the flight that matches a visit sets the year, and the
 * others get the year that puts them next to it (EY66 2 Nov 2026 → EY390 3 Nov 2026, never 2015).
 */
export function journeyDates(dates: (string | null | undefined)[], visitDates: string[]): (string | null)[] {
  const resolved = dates.map((d) => dateFromVisits(d, visitDates));
  const anchorAt = resolved.findIndex((d) => !!d && visitDates.includes(d));
  const anchor = resolved[anchorAt >= 0 ? anchorAt : 0];
  if (!anchor) return resolved;
  const a = Date.parse(anchor);
  return dates.map((d, i) => {
    if (!d || i === anchorAt) return resolved[i];
    // Same month and day, in the year nearest to the anchor flight.
    const md = d.slice(5);
    const y = Number(anchor.slice(0, 4));
    return [y - 1, y, y + 1].map((yy) => `${yy}-${md}`).sort((p, q) => Math.abs(Date.parse(p) - a) - Math.abs(Date.parse(q) - a))[0];
  });
}

/** A barcode gives only the day of the year: use the year of a visit on that same day, when there is one. */
export function dateFromVisits(date: string | null | undefined, visitDates: string[]): string | null {
  if (!date) return null;
  if (visitDates.includes(date)) return date;
  const dayOfYear = (s: string) => Math.round((Date.parse(s) - Date.UTC(Number(s.slice(0, 4)), 0, 0)) / 86_400_000);
  const want = dayOfYear(date);
  return visitDates.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && dayOfYear(x) === want) ?? date;
}
