/**
 * Parses the IATA "Bar Coded Boarding Pass" (BCBP) text found in the PDF417 / Aztec / QR code
 * printed on boarding passes, e.g. "M1SAMPLE/TRAVELLER    EABC123 CMBBKKUL 0402 086Y023A0001 100".
 */
export type BcbpData = {
  passenger: string;
  bookingRef: string | null;
  fromAirport: string | null;
  toAirport: string | null;
  airlineCode: string | null;
  flightNumber: string | null;
  flightDate: string | null;
  seat: string | null;
};

/** Day of year (Julian date on the pass) -> the closest real date to today. */
function julianToDate(dayOfYear: number, today = new Date()): string | null {
  if (!dayOfYear || dayOfYear > 366) return null;
  let best: Date | null = null;
  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    const d = new Date(Date.UTC(year, 0, dayOfYear));
    if (!best || Math.abs(d.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime())) best = d;
  }
  return best ? best.toISOString().slice(0, 10) : null;
}

/**
 * Every flight on a boarding pass barcode. A connecting journey (e.g. CMB → AUH, then AUH → DUB) is
 * one barcode with several legs ("M2" = 2 legs); each leg after the first starts after the previous
 * leg's optional data, whose length is given as 2 hex digits.
 */
export function parseBcbpLegs(raw: string): BcbpData[] {
  const first = parseBcbp(raw);
  if (!first) return [];
  const s = raw.replace(/\r?\n/g, "");
  const legsCount = Number(s[1]) || 1;
  const legs = [first];
  let pos = 58;
  for (let n = 2; n <= legsCount; n++) {
    const size = parseInt(s.slice(pos, pos + 2), 16);
    if (Number.isNaN(size)) break;
    const start = pos + 2 + size; // after this leg's optional data
    const f = (from: number, len: number) => s.slice(start + from, start + from + len).trim();
    if (s.length < start + 35) break;
    const carrier = f(13, 3);
    const flight = f(16, 5).replace(/^0+/, "");
    const seat = f(25, 4).replace(/^0+/, "");
    legs.push({
      passenger: first.passenger,
      bookingRef: f(0, 7) || first.bookingRef,
      fromAirport: f(7, 3) || null,
      toAirport: f(10, 3) || null,
      airlineCode: carrier || null,
      flightNumber: carrier && flight ? `${carrier}${flight}` : null,
      flightDate: julianToDate(Number(f(21, 3))),
      seat: seat || null,
    });
    pos = start + 35;
  }
  return legs;
}

export function parseBcbp(raw: string): BcbpData | null {
  const s = raw.replace(/\r?\n/g, "");
  if (!/^M[1-4]/.test(s) || s.length < 58) return null;
  const f = (start: number, len: number) => s.slice(start, start + len).trim();
  const carrier = f(36, 3);
  const flight = f(39, 5).replace(/^0+/, "");
  const seat = f(48, 4).replace(/^0+/, "");
  const name = f(2, 20).replace("/", " ").replace(/\s+/g, " ");
  return {
    passenger: name,
    bookingRef: f(23, 7) || null,
    fromAirport: f(30, 3) || null,
    toAirport: f(33, 3) || null,
    airlineCode: carrier || null,
    flightNumber: carrier && flight ? `${carrier}${flight}` : null,
    flightDate: julianToDate(Number(f(44, 3))),
    seat: seat || null,
  };
}
