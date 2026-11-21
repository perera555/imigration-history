"use client";

import { DateInput } from "./DateInput";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { readBoardingPass, saveBoardingPass, type BoardingSaveState } from "@/lib/boarding-actions";
import type { BoardingPass } from "@/lib/data";
import { SubmitButton } from "./SubmitButton";

export type TripOption = { id: string; label: string; date: string };

type Fields = {
  tripId: string;
  direction: string;
  airline: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  flightDate: string;
  seat: string;
  bookingRef: string;
  notes: string;
};

const fromPass = (p?: BoardingPass): Fields => ({
  tripId: p?.tripId ?? "",
  direction: p?.direction ?? "",
  airline: p?.airline ?? "",
  flightNumber: p?.flightNumber ?? "",
  fromAirport: p?.fromAirport ?? "",
  toAirport: p?.toAirport ?? "",
  flightDate: p?.flightDate ?? "",
  seat: p?.seat ?? "",
  bookingRef: p?.bookingRef ?? "",
  notes: p?.notes ?? "",
});

/** Add or update a boarding pass: upload (PDF/photo), read details, link to a trip or mark as current. */
export function BoardingPassForm({
  profileId,
  pass,
  trips,
  onDone,
}: {
  profileId: string;
  pass?: BoardingPass;
  trips: TripOption[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState<BoardingSaveState, FormData>(saveBoardingPass.bind(null, profileId, pass?.id ?? null), undefined);
  const [f, setF] = useState<Fields>(() => fromPass(pass));
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  const [reading, startReading] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  function readDetails() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setReadMsg({ error: "Choose the boarding pass first." });
    setReadMsg({});
    startReading(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await readBoardingPass(profileId, fd);
      if (!r || "error" in r) return setReadMsg({ error: r?.error ?? "Could not read the boarding pass." });
      const d = r.details;
      // Link to the trip whose departure or return matches the flight date.
      const match = d.flightDate ? trips.find((t) => t.date.split("|").includes(d.flightDate!)) : undefined;
      setF((x) => ({
        ...x,
        airline: d.airline ?? x.airline,
        flightNumber: d.flightNumber ?? x.flightNumber,
        fromAirport: d.fromAirport ?? x.fromAirport,
        toAirport: d.toAirport ?? x.toAirport,
        flightDate: d.flightDate ?? x.flightDate,
        seat: d.seat ?? x.seat,
        bookingRef: d.bookingRef ?? x.bookingRef,
        tripId: x.tripId || match?.id || "",
        direction: x.direction || (match && d.flightDate === match.date.split("|")[0] ? "Departure" : match ? "Return" : ""),
      }));
      const n = Object.values(d).filter((v) => v !== null).length;
      setReadMsg({ ok: `✓ ${n} detail${n === 1 ? "" : "s"} read. Please check them, then save.` });
    });
  }

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4">
        <p className="field-label">Boarding pass (PDF or photo, max 8 MB)</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <button type="button" onClick={readDetails} disabled={reading} className="btn btn-gold">
            {reading ? "Reading…" : "Read details from boarding pass"}
          </button>
        </div>
        {pass?.hasFile && (
          <a href={`/api/boarding/${pass.id}/file`} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold text-navy-2 hover:underline">
            View saved boarding pass ({pass.fileName})
          </a>
        )}
        {readMsg.ok && <p className="mt-2 text-sm font-medium text-ok">{readMsg.ok}</p>}
        {readMsg.error && <p className="mt-2 text-sm font-medium text-danger">{readMsg.error}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="sm:col-span-2">
          <span className="field-label">Trip (from the immigration record)</span>
          <select name="tripId" value={f.tripId} onChange={set("tripId")} className="field">
            <option value="">🕒 Current / upcoming trip (not in the record yet)</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Flight</span>
          <select name="direction" value={f.direction} onChange={set("direction")} className="field">
            <option value="">—</option>
            <option>Departure</option>
            <option>Return</option>
            <option>Connection</option>
          </select>
        </label>
        <label>
          <span className="field-label">Flight number</span>
          <input name="flightNumber" value={f.flightNumber} onChange={set("flightNumber")} className="field font-mono uppercase" placeholder="UL402" />
        </label>
        <label>
          <span className="field-label">Airline</span>
          <input name="airline" value={f.airline} onChange={set("airline")} className="field" placeholder="SriLankan Airlines" />
        </label>
        <label>
          <span className="field-label">Flight date</span>
          <DateInput name="flightDate" value={f.flightDate} onChange={set("flightDate")} className="field" />
        </label>
        <label>
          <span className="field-label">From (airport)</span>
          <input name="fromAirport" value={f.fromAirport} onChange={set("fromAirport")} className="field uppercase" placeholder="CMB" />
        </label>
        <label>
          <span className="field-label">To (airport)</span>
          <input name="toAirport" value={f.toAirport} onChange={set("toAirport")} className="field uppercase" placeholder="BKK" />
        </label>
        <label>
          <span className="field-label">Seat</span>
          <input name="seat" value={f.seat} onChange={set("seat")} className="field uppercase" placeholder="23A" />
        </label>
        <label>
          <span className="field-label">Booking reference (PNR)</span>
          <input name="bookingRef" value={f.bookingRef} onChange={set("bookingRef")} className="field font-mono uppercase" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Notes</span>
          <input name="notes" value={f.notes} onChange={set("notes")} className="field" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…">{pass ? "Save boarding pass" : "Add boarding pass"}</SubmitButton>
        {onDone && (
          <button type="button" onClick={onDone} className="btn btn-ghost">
            Cancel
          </button>
        )}
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
      </div>
    </form>
  );
}
