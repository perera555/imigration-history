/**
 * Browser side: gets flight details from a boarding pass file, trying in order
 *  1) the PDF's own text (airline e-boarding passes),
 *  2) the barcode on the page or photo (every flight detail is in it),
 *  3) the printed text of a scan or photo (OCR).
 */
import { readBoardingPass, readBoardingText } from "./boarding-actions";
import type { BoardingDetails } from "./boarding-reader";
import { parseBcbp } from "./bcbp";
import { readBarcodeTexts } from "./barcode";
import { fileToImages, ocrImages } from "./ocr";

export type BoardingRead = { details: Partial<BoardingDetails>; how: "from the PDF" | "from the barcode" | "from the scan" } | null;

export async function readBoardingFile(profileId: string, file: File, onProgress?: (message: string) => void): Promise<BoardingRead> {
  if (file.type === "application/pdf") {
    const fd = new FormData();
    fd.append("file", file);
    const r = await readBoardingPass(profileId, fd).catch(() => null);
    if (r && "ok" in r) return { details: r.details, how: "from the PDF" };
  }
  onProgress?.("Looking for the boarding pass barcode…");
  const images = file.type === "application/pdf" ? await fileToImages(file, 3) : [file];
  const codes = await readBarcodeTexts(images).catch(() => [] as string[]);
  const b = codes.map((c) => parseBcbp(c)).find(Boolean);
  if (b) {
    return {
      details: { airline: b.airlineCode, flightNumber: b.flightNumber, fromAirport: b.fromAirport, toAirport: b.toAirport, flightDate: b.flightDate, seat: b.seat, bookingRef: b.bookingRef },
      how: "from the barcode",
    };
  }
  const texts = await ocrImages(images, onProgress);
  const d = await readBoardingText(profileId, texts.join("\n")).catch(() => null);
  return d ? { details: d, how: "from the scan" } : null;
}

/** A barcode gives only the day of the year: use the year of a visit on that same day, when there is one. */
export function dateFromVisits(date: string | null | undefined, visitDates: string[]): string | null {
  if (!date) return null;
  if (visitDates.includes(date)) return date;
  const dayOfYear = (s: string) => Math.round((Date.parse(s) - Date.UTC(Number(s.slice(0, 4)), 0, 0)) / 86_400_000);
  const want = dayOfYear(date);
  return visitDates.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && dayOfYear(x) === want) ?? date;
}
