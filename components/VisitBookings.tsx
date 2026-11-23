"use client";

/** A visit's hotel / Airbnb stays with their booking documents (from the "Hotels & Airbnb" section). */
export type VisitStay = { id: string; tripId: string | null; name: string; hasFile: boolean; fileName: string | null };

/** Opens the "Hotels & Airbnb" form on this page: a new stay for the visit, or an existing stay. */
function openStay(detail: { tripId?: string; stayId?: string }) {
  window.dispatchEvent(new CustomEvent("open-stay", { detail }));
}

/**
 * Hotel bookings of one visit: each hotel with 👁 View / ⬇ Download of its reservation document,
 * and "+ Add hotel booking" (several hotels per visit).
 */
export function VisitBookings({ tripId, stays }: { tripId: string; stays: VisitStay[] }) {
  const mine = stays.filter((s) => s.tripId === tripId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-[0.12em] text-ink-soft">🧾 Hotel bookings</span>
      {mine.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-3 pr-1">
          <button type="button" onClick={() => openStay({ stayId: s.id })} className="font-medium text-navy hover:underline" title="Open this stay">
            🏨 {s.name}
          </button>
          {s.hasFile ? (
            <>
              <a href={`/api/stays/${s.id}/file`} target="_blank" rel="noopener" className="rounded-full px-2 py-0.5 hover:bg-paper" title={s.fileName ?? "Booking"}>
                👁 View
              </a>
              <a href={`/api/stays/${s.id}/file?download=1`} className="rounded-full px-2 py-0.5 hover:bg-paper">
                ⬇ Download
              </a>
            </>
          ) : (
            <button type="button" onClick={() => openStay({ stayId: s.id })} className="rounded-full px-2 py-0.5 text-ink-soft hover:bg-paper">
              + document
            </button>
          )}
        </span>
      ))}
      <button type="button" onClick={() => openStay({ tripId })} className="rounded-full border border-dashed border-gold/70 bg-gold/5 px-3 py-0.5 font-semibold text-navy hover:bg-gold/10">
        + Add hotel booking
      </button>
    </div>
  );
}
