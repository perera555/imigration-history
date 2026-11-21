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
}: {
  profileId: string;
  passes: BoardingPass[];
  trips: TripOption[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [newKey, setNewKey] = useState(0);
  const tripLabel = (id: string | null) => trips.find((t) => t.id === id)?.label;
  const current = passes.filter((p) => !p.tripId);
  const previous = passes.filter((p) => p.tripId);

  const card = (p: BoardingPass) => (
    <article key={p.id} className="relative overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-stretch">
        <div className="flex-1 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
            ✈ Boarding pass{p.direction ? ` · ${p.direction}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-3 font-serif text-2xl font-bold text-navy">
            <span>{p.fromAirport || "—"}</span>
            <span className="text-base text-ink-soft">→</span>
            <span>{p.toAirport || "—"}</span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {p.airline || "Airline"} · <span className="font-mono">{p.flightNumber || "—"}</span> · {fmt(p.flightDate)}
            {p.seat && <> · Seat {p.seat}</>}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {p.tripId ? `Trip: ${tripLabel(p.tripId) ?? "recorded trip"}` : "🕒 Current / upcoming trip"}
            {p.bookingRef && <> · PNR <span className="font-mono">{p.bookingRef}</span></>}
          </p>
          {p.notes && <p className="mt-1 text-xs text-ink-soft">{p.notes}</p>}
        </div>
        <div className="flex w-32 shrink-0 flex-col items-stretch justify-center gap-2 border-l-2 border-dashed border-line bg-paper/50 p-3">
          {p.hasFile && (
            <a href={`/api/boarding/${p.id}/file`} target="_blank" rel="noopener" className="btn btn-ghost !px-2 !py-1.5 text-xs">
              View
            </a>
          )}
          <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="btn btn-primary !px-2 !py-1.5 text-xs">
            {editing === p.id ? "Close" : "✏️ Update"}
          </button>
          {canDelete && (
            <form action={deleteBoardingPass.bind(null, p.id)}>
              <ConfirmButton message="Delete this boarding pass?" className="btn btn-danger w-full !px-2 !py-1.5 text-xs">
                Delete
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
      {editing === p.id && (
        <div className="border-t border-line p-4">
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
