"use client";

import { useState } from "react";
import { deleteBoardingPass } from "@/lib/boarding-actions";
import type { BoardingPass } from "@/lib/data";
import { BoardingPassForm, type TripOption } from "./BoardingPassForm";
import { ConfirmButton } from "./SubmitButton";

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** Separate "Boarding passes" section: cards (previous trips and current travel) + add / update form. */
export function BoardingPassSection({
  profileId,
  passes,
  trips,
  canDelete,
  holder = "",
}: {
  profileId: string;
  passes: BoardingPass[];
  trips: TripOption[];
  canDelete: boolean;
  /** Passenger name shown on the boarding pass. */
  holder?: string;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [newKey, setNewKey] = useState(0);
  const tripLabel = (id: string | null) => trips.find((t) => t.id === id)?.label;
  const current = passes.filter((p) => !p.tripId);
  const previous = passes.filter((p) => p.tripId);

  const card = (p: BoardingPass) => (
    <article key={p.id} className="space-y-3">
      {/* Real boarding pass proportions (203 x 83 mm), 3D */}
      <div className="bp-scene">
        <div className="bp">
          <div className="relative z-10 flex flex-col p-[4%]">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[clamp(9px,1.6vw,12px)] font-bold uppercase tracking-[0.25em] text-gold-soft">
                ✈ {p.airline || "Boarding pass"}
              </p>
              <p className="text-[clamp(8px,1.3vw,11px)] font-semibold uppercase tracking-[0.2em] text-white/60">
                Boarding pass{p.direction ? ` · ${p.direction}` : ""}
              </p>
            </div>
            <p className="mt-[2%] truncate text-[clamp(8px,1.3vw,11px)] uppercase tracking-[0.15em] text-white/60">
              Passenger <span className="font-semibold text-white">{holder}</span>
            </p>
            <div className="mt-auto flex items-end gap-[4%]">
              <div>
                <p className="text-[clamp(8px,1.2vw,10px)] uppercase tracking-[0.2em] text-white/50">From</p>
                <p className="font-serif text-[clamp(20px,5vw,40px)] font-bold leading-none">{p.fromAirport || "---"}</p>
              </div>
              <p className="pb-[1%] text-[clamp(14px,3vw,24px)] text-gold-soft">✈</p>
              <div>
                <p className="text-[clamp(8px,1.2vw,10px)] uppercase tracking-[0.2em] text-white/50">To</p>
                <p className="font-serif text-[clamp(20px,5vw,40px)] font-bold leading-none">{p.toAirport || "---"}</p>
              </div>
            </div>
            <div className="mt-[3%] grid grid-cols-4 gap-2 text-[clamp(8px,1.3vw,11px)]">
              <div>
                <p className="uppercase tracking-[0.15em] text-white/50">Flight</p>
                <p className="font-mono font-semibold">{p.flightNumber || "—"}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.15em] text-white/50">Date</p>
                <p className="font-semibold">{fmt(p.flightDate)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.15em] text-white/50">Seat</p>
                <p className="font-semibold">{p.seat || "—"}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.15em] text-white/50">PNR</p>
                <p className="font-mono font-semibold">{p.bookingRef || "—"}</p>
              </div>
            </div>
          </div>
          <div className="bp-stub relative z-10 flex flex-col p-[6%]">
            <p className="text-[clamp(8px,1.2vw,10px)] font-bold uppercase tracking-[0.2em] text-gold">Stub</p>
            <p className="mt-1 font-serif text-[clamp(12px,2.6vw,20px)] font-bold leading-tight text-navy">
              {p.fromAirport || "---"} → {p.toAirport || "---"}
            </p>
            <p className="text-[clamp(8px,1.2vw,10px)] text-ink-soft">
              {p.flightNumber || "—"} · {fmt(p.flightDate)}
            </p>
            <p className="text-[clamp(8px,1.2vw,10px)] text-ink-soft">Seat {p.seat || "—"}</p>
            <div className="bp-barcode mt-auto h-[22%] w-full rounded-sm" aria-hidden />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-auto text-ink-soft">
          {p.tripId ? `Trip: ${tripLabel(p.tripId) ?? "recorded trip"}` : "🕒 Current / upcoming trip"}
          {p.notes && ` · ${p.notes}`}
        </span>
        {p.checkedIn && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">✓ Checked in</span>}
        {!p.tripId && !p.checkedIn && (
          <a
            href={p.checkinUrl || `https://www.google.com/search?q=${encodeURIComponent(`${p.airline || p.flightNumber || "airline"} online check-in`)}`}
            target="_blank"
            rel="noopener"
            className="btn btn-gold !px-3 !py-1.5 text-xs"
          >
            🌐 Online check-in
          </a>
        )}
        <a href={`/api/boarding/${p.id}/pdf`} className="btn btn-ghost !px-3 !py-1.5 text-xs" title="Single boarding pass, 203 x 83 mm">
          ⬇ Real-size PDF
        </a>
        {p.hasFile && (
          <>
            <a href={`/api/boarding/${p.id}/file`} target="_blank" rel="noopener" className="btn btn-ghost !px-3 !py-1.5 text-xs">
              📄 Original
            </a>
            <a href={`/api/boarding/${p.id}/file?download=1`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
              ⬇ Original file
            </a>
          </>
        )}
        <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="btn btn-primary !px-3 !py-1.5 text-xs">
          {editing === p.id ? "Close" : "✏️ Update"}
        </button>
        {canDelete && (
          <form action={deleteBoardingPass.bind(null, p.id)}>
            <ConfirmButton message="Delete this boarding pass?" className="btn btn-danger !px-3 !py-1.5 text-xs">
              Delete
            </ConfirmButton>
          </form>
        )}
      </div>
      {editing === p.id && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <BoardingPassForm profileId={profileId} pass={p} trips={trips} onDone={() => setEditing(null)} />
        </div>
      )}
    </article>
  );
  return (
    <section id="boarding" className="panel scroll-mt-24 p-6 sm:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Boarding passes</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Boarding passes</h2>
          <p className="mt-1 text-sm text-ink-soft">Upload boarding passes for previous trips and for your current travel.</p>
        </div>
        {editing !== "new" && (
          <button type="button" onClick={() => setEditing("new")} className="btn btn-gold ml-auto">
            + Upload boarding pass
          </button>
        )}
      </div>

      {editing === "new" && (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-gold/50 bg-white p-5">
          <h3 className="mb-4 font-serif text-lg font-bold text-navy">Upload a boarding pass</h3>
          <BoardingPassForm
            key={newKey}
            profileId={profileId}
            trips={trips}
            onDone={() => {
              setEditing(null);
              setNewKey((k) => k + 1);
            }}
          />
        </div>
      )}

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-ink-soft">🕒 Current / upcoming ({current.length})</h3>
          {current.length ? <div className="grid gap-4 lg:grid-cols-2">{current.map(card)}</div> : <p className="text-sm text-ink-soft">None yet.</p>}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-ink-soft">🧾 Previous trips ({previous.length})</h3>
          {previous.length ? <div className="grid gap-4 lg:grid-cols-2">{previous.map(card)}</div> : <p className="text-sm text-ink-soft">None yet.</p>}
        </div>
      </div>
    </section>
  );
}
