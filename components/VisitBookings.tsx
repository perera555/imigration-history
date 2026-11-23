"use client";

import { useActionState, useEffect, useState } from "react";
import { saveStay, type StaySaveState } from "@/lib/stay-actions";
import { STAY_KINDS } from "@/lib/stay-kinds";
import { DateInput } from "./DateInput";
import { HotelInput } from "./HotelInput";
import { useToastOn } from "./Toaster";

/** A visit's hotel / Airbnb stays with their booking documents (from the "Hotels & Airbnb" section). */
export type VisitStay = {
  id: string;
  tripId: string | null;
  name: string;
  hasFile: boolean;
  fileName: string | null;
  address?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
};

/** Opens an existing stay in the "Hotels & Airbnb" section on this page. */
function openStay(detail: { tripId?: string; stayId?: string }) {
  window.dispatchEvent(new CustomEvent("open-stay", { detail }));
}

/** Add one hotel to a visit, right here: name (from the city's hotel list), address, dates, booking document. */
function AddHotel({
  profileId,
  tripId,
  countryCode,
  city,
  checkIn,
  checkOut,
  onDone,
}: {
  profileId: string;
  tripId: string;
  countryCode: string;
  city: string;
  checkIn: string;
  checkOut: string;
  onDone: () => void;
}) {
  const [state, action, saving] = useActionState<StaySaveState, FormData>(saveStay.bind(null, profileId, null), undefined);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  useToastOn(null, state?.error ?? null);
  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const lbl = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft";
  return (
    <form action={action} className="mt-2 grid gap-3 rounded-xl border border-gold/50 bg-gold/5 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="countryCode" value={countryCode} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="name" value={name} />
      <label>
        <span className={lbl}>🏨 Hotel / Airbnb *</span>
        <HotelInput
          countryCode={countryCode}
          city={city}
          value={name}
          saved={[]}
          onChange={(n, a) => {
            setName(n);
            if (a) setAddress(a);
          }}
          className="field !py-2"
        />
      </label>
      <label>
        <span className={lbl}>📍 Address</span>
        <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} className="field !py-2" placeholder="Street, city" />
      </label>
      <label>
        <span className={lbl}>Type</span>
        <select name="kind" defaultValue="Hotel" className="field !py-2">
          {STAY_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={lbl}>Check-in</span>
        <DateInput name="checkIn" defaultValue={checkIn} className="field !py-2" />
      </label>
      <label>
        <span className={lbl}>Check-out</span>
        <DateInput name="checkOut" defaultValue={checkOut} className="field !py-2" />
      </label>
      <label>
        <span className={lbl}>🧾 Booking document (PDF / photo)</span>
        <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="field !py-1.5 text-xs" />
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary !py-1.5 text-xs">
          {saving ? "Saving…" : "Save hotel"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost !py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Hotel bookings of one visit: each hotel with 👁 View / ⬇ Download of its reservation document,
 * and "+ Add hotel" to add another one right here (several hotels per visit).
 */
export function VisitBookings({
  tripId,
  stays,
  profileId,
  countryCode = "",
  city = "",
  checkIn = "",
  checkOut = "",
  documentsOnly = false,
}: {
  /** In the visit form the hotels are typed above, so only their booking documents are listed here. */
  documentsOnly?: boolean;
  tripId: string;
  stays: VisitStay[];
  profileId?: string | null;
  countryCode?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
}) {
  const mine = stays.filter((s) => s.tripId === tripId);
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.12em] text-ink-soft">{documentsOnly ? "🧾 Booking documents" : "🧾 Hotel bookings"}</span>
        {mine.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-3 pr-1">
            <button type="button" onClick={() => openStay({ stayId: s.id })} className="font-medium text-navy hover:underline" title="Open this stay">
              {mine.length > 1 ? `${i + 1}. ` : ""}🏨 {s.name}
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
        {documentsOnly && !mine.length && <span className="text-ink-soft">Save the hotels above first, then add their booking documents here.</span>}
        {!adding && !documentsOnly && (
          <button
            type="button"
            onClick={() => (profileId ? setAdding(true) : openStay({ tripId }))}
            className="rounded-full border border-dashed border-gold/70 bg-gold/5 px-3 py-0.5 font-semibold text-navy hover:bg-gold/10"
          >
            {mine.length ? "+ Add another hotel" : "+ Add hotel"}
          </button>
        )}
      </div>
      {adding && profileId && (
        <AddHotel profileId={profileId} tripId={tripId} countryCode={countryCode} city={city} checkIn={checkIn} checkOut={checkOut} onDone={() => setAdding(false)} />
      )}
    </div>
  );
}
