/** Airline names by their 2-character code (as printed in flight numbers and boarding pass barcodes). */
export const AIRLINES: Record<string, string> = {
  UL: "SriLankan Airlines", EK: "Emirates", QR: "Qatar Airways", EY: "Etihad Airways", SQ: "Singapore Airlines",
  TG: "Thai Airways", MH: "Malaysia Airlines", AK: "AirAsia", FD: "Thai AirAsia", "6E": "IndiGo", AI: "Air India",
  QF: "Qantas", NZ: "Air New Zealand", BA: "British Airways", KL: "KLM", AF: "Air France", LH: "Lufthansa",
  TK: "Turkish Airlines", CX: "Cathay Pacific", CA: "Air China", MU: "China Eastern", CZ: "China Southern",
  FZ: "flydubai", WY: "Oman Air", GF: "Gulf Air", KU: "Kuwait Airways", SV: "Saudia", VN: "Vietnam Airlines",
  EI: "Aer Lingus", FR: "Ryanair", U2: "easyJet", VS: "Virgin Atlantic", G9: "Air Arabia", "3L": "Air Arabia Abu Dhabi",
  J9: "Jazeera Airways", PK: "PIA", "8M": "Myanmar Airways", MI: "SilkAir", TR: "Scoot", "3K": "Jetstar Asia",
  OD: "Batik Air Malaysia", ID: "Batik Air", GA: "Garuda Indonesia", PR: "Philippine Airlines", "5J": "Cebu Pacific",
  KE: "Korean Air", OZ: "Asiana Airlines", JL: "Japan Airlines", NH: "ANA", BR: "EVA Air", CI: "China Airlines",
  AA: "American Airlines", UA: "United Airlines", DL: "Delta Air Lines", AC: "Air Canada", ET: "Ethiopian Airlines",
  MS: "EgyptAir", KQ: "Kenya Airways", SK: "SAS", LX: "Swiss", OS: "Austrian Airlines", AZ: "ITA Airways", IB: "Iberia",
  TP: "TAP Air Portugal", WZ: "Red Wings", "9W": "Jet Airways", UK: "Vistara", SG: "SpiceJet", IX: "Air India Express",
  BG: "Biman Bangladesh", RA: "Nepal Airlines", Q2: "Maldivian", "4Y": "Discover Airlines",
};

/** "EY" → "Etihad Airways" (the code itself when unknown). */
export const airlineName = (code: string | null | undefined): string | null => (code ? (AIRLINES[code.toUpperCase()] ?? code.toUpperCase()) : null);
