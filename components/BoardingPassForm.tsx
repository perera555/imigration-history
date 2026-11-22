"use client";

import { DateInput } from "./DateInput";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { readBoardingPass, saveBoardingPass, type BoardingSaveState } from "@/lib/boarding-actions";
import type { BoardingPass } from "@/lib/data";
import { SubmitButton } from "./SubmitButton";
import { parseBcbp } from "@/lib/bcbp";
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
  const [state, action] = useActionState<BoardingSaveState, FormData>(saveBoardingPass.bind(null, profileId, pass?.id ?? null), undefined);
  const [f, setF] = useState<Fields>(() => fromPass(pass));
  const [readMsg, setReadMsg] = useState<{ ok?: string; error?: string }>({});
  const [reading, startReading] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  useToastOn(readMsg.ok, readMsg.error ?? state?.error);

  const scanRef = useRef<HTMLInputElement>(null);

  /** 📷 Scan: camera photo (or picked image) -> attached as the document; barcode read when possible. */
  async function onScan(file: File | undefined) {
    if (!file) return;
    // Attach the photo as the boarding pass document.
    if (fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      fileRef.current.dispatchEvent(new Event("change", { bubbles: true })); // show the preview
    }
    setReadMsg({});
    type Detector = { detect: (src: ImageBitmap) => Promise<{ rawValue: string }[]> };
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) {
      setReadMsg({ ok: "📷 Photo attached. This browser can't read barcodes, so please fill in the flight details." });
      return;
    }
    try {
      const codes = await new BD({ formats: ["pdf417", "aztec", "qr_code", "data_matrix"] }).detect(await createImageBitmap(file));
      const d = codes.map((c) => parseBcbp(c.rawValue)).find(Boolean);
      if (!d) {
        setReadMsg({ ok: "📷 Photo attached. No boarding pass barcode found, so please fill in the flight details." });
        return;
      }
      const match = d.flightDate ? trips.find((t) => t.date.split("|").includes(d.flightDate!)) : undefined;
      setF((x) => ({
        ...x,
        flightNumber: d.flightNumber ?? x.flightNumber,
        fromAirport: d.fromAirport ?? x.fromAirport,
        toAirport: d.toAirport ?? x.toAirport,
        flightDate: d.flightDate ?? x.flightDate,
        seat: d.seat ?? x.seat,
        bookingRef: d.bookingRef ?? x.bookingRef,
        airline: x.airline || (d.airlineCode ?? ""),
        tripId: x.tripId || match?.id || "",
      }));
      setReadMsg({ ok: `✓ Barcode scanned: ${d.flightNumber ?? ""} ${d.fromAirport ?? ""}→${d.toAirport ?? ""} for ${d.passenger}. Check the details, then save.` });
    } catch {
      setReadMsg({ ok: "📷 Photo attached. The barcode couldn't be read, so please fill in the flight details." });
    }
  }

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
        <DocumentPicker
          name="file"
          inputRef={fileRef}
          label="Boarding pass photo or PDF"
          saved={pass?.hasFile ? { url: `/api/boarding/${pass.id}/file`, name: pass.fileName, image: isImageName(pass.fileName, pass.mime) } : null}
          onDelete={pass && canDelete ? () => deleteAttachment("boarding", pass.id) : undefined}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={readDetails} disabled={reading} className="btn btn-gold">
            {reading ? "Reading…" : "Read details from boarding pass"}
          </button>
          <button type="button" onClick={() => scanRef.current?.click()} className="btn btn-ghost">
            🔎 Scan barcode
          </button>
          <input
            ref={scanRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onScan(e.target.files?.[0])}
          />
        </div>
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
