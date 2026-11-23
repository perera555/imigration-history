"use client";

import { safeAction } from "@/lib/safe-action";
import { DateInput } from "./DateInput";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveBoardingPass, type BoardingSaveState } from "@/lib/boarding-actions";
import type { BoardingDetails } from "@/lib/boarding-reader";
import { dateFromVisits, readBoardingFile, visitForFlight } from "@/lib/boarding-read";
import type { BoardingPass } from "@/lib/data";
import { SubmitButton } from "./SubmitButton";
import { DocumentPicker, isImageName } from "./DocumentPicker";
import { useToastOn } from "./Toaster";
import { deleteAttachment } from "@/lib/attachment-actions";

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
  checkinUrl: string;
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
  checkinUrl: p?.checkinUrl ?? "",
});

/** Add or update a boarding pass: upload (PDF/photo), read details, link to a trip or mark as current. */
export function BoardingPassForm({
  profileId,
  pass,
  trips,
  onDone,
  canDelete = false,
}: {
  profileId: string;
  pass?: BoardingPass;
  trips: TripOption[];
  onDone?: () => void;
  /** Admins: "🗑 Delete photo" for the saved file. */
  canDelete?: boolean;
}) {
  const [state, action] = useActionState<BoardingSaveState, FormData>(safeAction(saveBoardingPass.bind(null, profileId, pass?.id ?? null)), undefined);
  const [f, setF] = useState<Fields>(() => fromPass(pass));
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  const [reading, startReading] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Every flight on the boarding pass when there are several (connecting journey, e.g. CMB → AUH → DUB). */
  const [legs, setLegs] = useState<Partial<BoardingDetails>[]>([]);
  const [savingAll, setSavingAll] = useState(false);

  /** Saves each flight of a connecting journey as its own boarding pass, with the same document. */
  async function saveAllFlights() {
    if (!formRef.current) return;
    setSavingAll(true);
    const visitDates = trips.flatMap((t) => t.date.split("|")).filter(Boolean);
    let saved = 0;
    const problems: string[] = [];
    for (const leg of legs) {
      const fd = new FormData(formRef.current); // the document, passenger and other fields as in the form
      const date = dateFromVisits(leg.flightDate, visitDates);
      const visit = visitForFlight(trips, date);
      const values: Record<string, string | null | undefined> = {
        airline: leg.airline,
        flightNumber: leg.flightNumber,
        fromAirport: leg.fromAirport,
        toAirport: leg.toAirport,
        flightDate: date,
        seat: leg.seat,
        bookingRef: leg.bookingRef,
        tripId: visit?.trip.id ?? fd.get("tripId")?.toString(),
        direction: visit?.direction ?? fd.get("direction")?.toString(),
      };
      for (const [k, v] of Object.entries(values)) fd.set(k, v ?? "");
      try {
        const r = await saveBoardingPass(profileId, null, undefined, fd);
        if (r?.error) problems.push(`${leg.fromAirport}→${leg.toAirport}: ${r.error}`);
        else saved++;
      } catch {
        problems.push(`${leg.fromAirport}→${leg.toAirport}: the server didn't answer`);
      }
    }
    setSavingAll(false);
    if (problems.length) setReadMsg({ error: `${saved} saved. Not saved: ${problems.join("; ")}` });
    else onDone?.();
  }
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  useToastOn(readMsg.ok, readMsg.error ?? state?.error);

  /** Puts read flight details into the form and links the visit whose dates match the flight. */
  function apply(d: Partial<BoardingDetails>, how: string) {
    // A barcode gives the day of the year only: use the year of the visit on that day and month.
    const date = dateFromVisits(d.flightDate, trips.flatMap((t) => t.date.split("|")).filter(Boolean));
    const visit = visitForFlight(trips, date);
    setF((x) => ({
      ...x,
      airline: d.airline ?? x.airline,
      flightNumber: d.flightNumber ?? x.flightNumber,
      fromAirport: d.fromAirport ?? x.fromAirport,
      toAirport: d.toAirport ?? x.toAirport,
      flightDate: date ?? x.flightDate,
      seat: d.seat ?? x.seat,
      bookingRef: d.bookingRef ?? x.bookingRef,
      tripId: x.tripId || visit?.trip.id || "",
      direction: x.direction || visit?.direction || "",
    }));
    const n = Object.values(d).filter((v) => v !== null && v !== undefined).length;
    setReadMsg({ ok: `✓ ${n} detail${n === 1 ? "" : "s"} read ${how}. Please check them, then save.` });
  }

  /**
   * Reads the boarding pass: 1) the PDF's text, 2) the barcode on the page (all flight details are in it),
   * 3) the printed text of a scan or photo (OCR). Runs by itself when a file is chosen.
   */
  function readDetails(picked?: File) {
    const file = picked ?? fileRef.current?.files?.[0];
    if (!file) return setReadMsg({ error: "Choose the boarding pass first." });
    setReadMsg({});
    startReading(async () => {
      try {
        const r = await readBoardingFile(profileId, file, (m) => setReadMsg({ ok: m }));
        setLegs(r && r.legs.length > 1 ? r.legs : []);
        if (r) return apply(r.details, r.how);
        setReadMsg({ error: "Couldn't find flight details in this boarding pass. It is attached, so fill in the details and save." });
      } catch {
        setReadMsg({ error: "Couldn't read this boarding pass. It is attached, so fill in the details and save." });
      }
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4">
        <DocumentPicker
          name="file"
          inputRef={fileRef}
          onPicked={(file) => readDetails(file)}
          cropScans
          label="Boarding pass photo, scan or PDF (PDF, PNG or JPEG)"
          saved={pass?.hasFile ? { url: `/api/boarding/${pass.id}/file`, name: pass.fileName, image: isImageName(pass.fileName, pass.mime) } : null}
          onDelete={pass ? () => deleteAttachment("boarding", pass.id) : undefined}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => readDetails()} disabled={reading} className="btn btn-gold">
            {reading ? "Reading…" : "↻ Read details again"}
          </button>
          <span className="text-xs text-ink-soft">
            Scanned on a printer? Choose the scan (PDF, PNG or JPEG): it is cut to the boarding pass size, the barcode is read and the form is filled.
          </span>
        </div>
        {readMsg.ok && <p className="mt-2 text-sm font-medium text-ok">{readMsg.ok}</p>}
        {readMsg.error && <p className="mt-2 text-sm font-medium text-danger">{readMsg.error}</p>}
        {!pass && legs.length > 1 && (
          // Connecting journey on one boarding pass: every flight can be saved at once.
          <div className="mt-3 rounded-xl border border-gold/60 bg-gold/10 p-3">
            <p className="text-sm font-semibold text-navy">✈ This boarding pass has {legs.length} flights:</p>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {legs.map((l, i) => (
                <li key={i} className="font-mono">
                  {l.flightNumber ?? "—"} · {l.fromAirport ?? "?"} → {l.toAirport ?? "?"}
                  {l.seat ? ` · seat ${l.seat}` : ""}
                </li>
              ))}
            </ol>
            <button type="button" onClick={saveAllFlights} disabled={savingAll} className="btn btn-primary mt-2 !py-1.5 text-sm">
              {savingAll ? "Saving…" : `Save all ${legs.length} flights (same boarding pass)`}
            </button>
            <p className="mt-1 text-xs text-ink-soft">The form below shows flight 1; press Save to keep only that one.</p>
          </div>
        )}
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
          <span className="field-label">Online check-in link (airline website)</span>
          <input name="checkinUrl" value={f.checkinUrl} onChange={set("checkinUrl")} className="field" placeholder="https://…" />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
          <input type="checkbox" name="checkedIn" defaultChecked={pass?.checkedIn} className="size-4 accent-navy" />
          Checked in online ✓
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
