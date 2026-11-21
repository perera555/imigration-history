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
