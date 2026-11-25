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

/** A barcode gives only the day of the year: use the year of a visit on that same day, when there is one. */
export function dateFromVisits(date: string | null | undefined, visitDates: string[]): string | null {
  if (!date) return null;
  if (visitDates.includes(date)) return date;
  const dayOfYear = (s: string) => Math.round((Date.parse(s) - Date.UTC(Number(s.slice(0, 4)), 0, 0)) / 86_400_000);
  const want = dayOfYear(date);
  return visitDates.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && dayOfYear(x) === want) ?? date;
}
