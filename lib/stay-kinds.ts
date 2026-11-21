/** Shared (client + server) helpers for places stayed. */

export const STAY_KINDS = ["Hotel", "Airbnb home", "Apartment", "Guesthouse", "Hostel", "Resort", "Student housing", "Staff housing", "Family / friends", "Other"] as const;

export const STAY_ICON: Record<string, string> = {
  Hotel: "🏨",
  "Airbnb home": "🏠",
  Apartment: "🏢",
  Guesthouse: "🛏️",
  Hostel: "🛏️",
  Resort: "🏝️",
  "Student housing": "🎓",
  "Staff housing": "💼",
  "Family / friends": "👪",
  Other: "📍",
};

/** Nights between check-in and check-out. */
export function stayNights(s: { checkIn: string | null; checkOut: string | null }): number | null {
  if (!s.checkIn || !s.checkOut) return null;
  const n = Math.round((Date.parse(s.checkOut) - Date.parse(s.checkIn)) / 86_400_000);
  return n >= 0 ? n : null;
}

/** Free "find a place" links (no API key): Booking.com, Airbnb and Google Maps searched for the place and dates. */
export function findLinks(place: string, checkIn?: string | null, checkOut?: string | null) {
  const q = encodeURIComponent(place);
  const dates = checkIn && checkOut ? { checkin: checkIn, checkout: checkOut } : null;
  const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
  return [
    { label: "Booking.com", url: `https://www.booking.com/searchresults.html?${qs({ ss: place, ...(dates ?? {}) })}` },
    { label: "Airbnb", url: `https://www.airbnb.com/s/${q}/homes${dates ? `?${qs(dates)}` : ""}` },
    { label: "Google Maps", url: `https://www.google.com/maps/search/${encodeURIComponent(`hotels in ${place}`)}` },
  ];
}
