"use client";

import { useRef, useState } from "react";
import { deleteBoardingPass, saveBoardingPass } from "@/lib/boarding-actions";
import { dateFromVisits, readBoardingFile } from "@/lib/boarding-read";
import { cropScan } from "@/lib/crop-scan";
import { prepareUpload } from "@/lib/upload-prep";
import { CountrySearch } from "./CountrySearch";
import { useToastOn } from "./Toaster";
import type { BoardingPass } from "@/lib/data";
import { BoardingPassForm, type TripOption } from "./BoardingPassForm";
import { ConfirmButton } from "./SubmitButton";
import { downloadBoardingPassImage } from "@/lib/bp-image";

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/**
 * Flight details from a file (barcode, then PDF text, then OCR): one entry per flight, so a
 * connecting journey on one boarding pass (e.g. CMB → AUH → DUB) gives one boarding pass per flight.
 */
async function flightsFrom(profileId: string, file: File, visitDates: string[], onProgress: (m: string) => void): Promise<Record<string, string>[]> {
  try {
    const r = await readBoardingFile(profileId, file, onProgress);
    if (!r) return [{}];
    return r.legs.map((leg) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(leg)) if (v) out[k] = String(v);
      const date = dateFromVisits(leg.flightDate, visitDates);
      if (date) out.flightDate = date;
      return out;
    });
  } catch {
    return [{}]; // details stay empty; the file is still saved
  }
}

/** "📷 Add several boarding passes": one boarding pass per chosen file, details read when possible, linked to trips by date. */
function BulkBoardingPasses({ profileId, visitDates = [] }: { profileId: string; visitDates?: string[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ busy?: string; ok?: string; error?: string }>({});
  useToastOn(msg.ok, msg.error);
  async function go(list: FileList | null) {
    const files = [...(list ?? [])];
    if (!files.length) return;
    let added = 0;
    const problems: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setMsg({ busy: `Adding boarding pass ${i + 1} of ${files.length}…` });
      // A full-page printer scan is cut to the boarding pass size first.
      const file = await prepareUpload((await cropScan(files[i])) ?? files[i]);
      const flights = await flightsFrom(profileId, file, visitDates, (m) => setMsg({ busy: `Boarding pass ${i + 1} of ${files.length}: ${m}` }));
      for (const details of flights) {
        const fd = new FormData();
        fd.append("file", file);
        for (const [k, v] of Object.entries(details)) fd.append(k, v);
        try {
          const r = await saveBoardingPass(profileId, null, undefined, fd);
          if (r?.error) problems.push(`${files[i].name}: ${r.error}`);
          else added++;
        } catch {
          problems.push(`${files[i].name}: no answer from the server`);
        }
      }
    }
    setMsg(
      problems.length
        ? { error: `${added} added. Not added: ${problems.join("; ")}` }
        : { ok: `✓ ${added} boarding pass${added === 1 ? "" : "es"} added. Check each one and press ✏️ Update to fill in anything missing.` },
    );
  }
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={!!msg.busy} className="btn btn-ghost" title="Choose several photos or PDFs: one boarding pass is made for each">
        📷 Add several boarding passes
      </button>
      <input ref={ref} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { go(e.target.files); e.target.value = ""; }} />
      {(msg.busy || msg.ok || msg.error) && (
        <p className={`basis-full text-sm font-medium ${msg.error ? "text-danger" : msg.ok ? "text-ok" : "text-navy-2"}`}>{msg.busy ?? msg.ok ?? msg.error}</p>
      )}
    </>
  );
}

/** "Show ▾" / "Hide ▴" on a folded boarding pass row. */
function Toggle() {
  return (
    <span className="ml-auto rounded-full bg-navy px-3 py-1 text-xs font-semibold text-gold-soft">
      <span className="group-open:hidden">Show ▾</span>
      <span className="hidden group-open:inline">Hide ▴</span>
    </span>
  );
}

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
  // Trip labels start with the country ("Thailand · 10 Dec 2013 → …").
  const byCountry = (list: BoardingPass[]) => {
    const m = new Map<string, BoardingPass[]>();
    for (const p of list) {
      const c = tripLabel(p.tripId)?.split(" · ")[0] ?? "Other";
      m.set(c, [...(m.get(c) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  /**
   * Flights from the same boarding pass (same booking reference and document, within 2 days — e.g.
   * CMB → AUH and AUH → DUB) are shown together as one journey: the whole route, then each flight.
   */
  const journeys = (list: BoardingPass[]) => {
    const groups: BoardingPass[][] = [];
    const sorted = [...list].sort((a, b) => (a.flightDate ?? "").localeCompare(b.flightDate ?? ""));
    for (const p of sorted) {
      const g = p.bookingRef
        ? groups.find(
            (x) =>
              x[0].bookingRef === p.bookingRef &&
              (x[0].fileName ?? "") === (p.fileName ?? "") &&
              Math.abs(Date.parse(x[x.length - 1].flightDate ?? "") - Date.parse(p.flightDate ?? "")) <= 2 * 86_400_000,
          )
        : undefined;
      if (g) g.push(p);
      else groups.push([p]);
    }
    return groups.map((g) => {
      if (g.length === 1) return card(g[0]);
      // Flights in travel order: each one starts where the previous one landed.
      const ordered = [g.find((p) => !g.some((q) => q.toAirport && q.toAirport === p.fromAirport)) ?? g[0]];
      while (ordered.length < g.length) {
        const next = g.find((p) => !ordered.includes(p) && p.fromAirport === ordered[ordered.length - 1].toAirport) ?? g.find((p) => !ordered.includes(p))!;
        ordered.push(next);
      }
      const route = [ordered[0].fromAirport, ...ordered.map((p) => p.toAirport)].map((a) => a || "---").join(" → ");
      return (
        // Small by default: one line with the whole route; click to see every flight.
        <details key={`journey-${g[0].id}`} className="group rounded-2xl border-2 border-gold/50 bg-gold/5 open:p-3 open:lg:col-span-2">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3 group-open:p-1 [&::-webkit-details-marker]:hidden">
            <span className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-gold-soft">✈ {g.length} flights</span>
            <span className="font-serif text-lg font-bold text-navy">{route}</span>
            <span className="text-xs text-ink-soft">
              {fmt(ordered[0].flightDate)}
              {ordered[0].bookingRef && <span className="font-mono"> · PNR {ordered[0].bookingRef}</span>}
            </span>
            <Toggle />
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {ordered.map((p, i) => (
              <div key={p.id} className="space-y-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
                  Flight {i + 1} of {g.length}
                </p>
                {fullCard(p, false)}
              </div>
            ))}
          </div>
          {/* One paper for all the flights: its scan is shown once. */}
          {(() => {
            const withScan = ordered.find((p) => p.hasFile && (p.mime?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(p.fileName ?? "")));
            return withScan ? (
              <a href={`/api/boarding/${withScan.id}/file`} target="_blank" rel="noopener" title="Open the boarding pass full size" className="mt-4 block">
                <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Original boarding pass</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/boarding/${withScan.id}/file`} alt="Boarding pass" loading="lazy" className="max-h-72 w-full rounded-xl bg-paper object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
              </a>
            ) : null;
          })()}
        </details>
      );
    });
  };

  /** One boarding pass, small by default (route, flight, date, seat); click to see it in full. */
  const card = (p: BoardingPass) => (
    <details key={p.id} className="group rounded-2xl border border-line bg-white open:border-transparent open:bg-transparent open:lg:col-span-2" open={editing === p.id || undefined}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-3 group-open:mb-3 group-open:bg-white group-open:shadow-sm [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-gold-soft" aria-hidden>
          ✈
        </span>
        <span className="font-serif text-lg font-bold text-navy">
          {p.fromAirport || "---"} → {p.toAirport || "---"}
        </span>
        <span className="text-xs text-ink-soft">
          <span className="font-mono">{p.flightNumber || "—"}</span> · {fmt(p.flightDate)}
          {p.seat && ` · seat ${p.seat}`}
          {p.hasFile && " · 📎"}
        </span>
        <Toggle />
      </summary>
      {fullCard(p)}
    </details>
  );

  /** The full boarding pass; `withScan` false when the scan is shown once for a whole journey. */
  const fullCard = (p: BoardingPass, withScan = true) => (
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
      {withScan && p.hasFile && (p.mime?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(p.fileName ?? "")) && (
        <a href={`/api/boarding/${p.id}/file`} target="_blank" rel="noopener" title="Open the uploaded photo full size" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/boarding/${p.id}/file`} alt="Boarding pass photo" loading="lazy" className="max-h-48 w-full rounded-xl bg-paper object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        </a>
      )}
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
        <button type="button" onClick={() => downloadBoardingPassImage(p, holder, "png", tripLabel(p.tripId))} className="btn btn-ghost !px-3 !py-1.5 text-xs" title="Real size, 300 dpi">
          ⬇ PNG
        </button>
        <button type="button" onClick={() => downloadBoardingPassImage(p, holder, "jpeg", tripLabel(p.tripId))} className="btn btn-ghost !px-3 !py-1.5 text-xs" title="Real size, 300 dpi">
          ⬇ JPEG
        </button>
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
          <BoardingPassForm profileId={profileId} pass={p} trips={trips} canDelete={canDelete} onDone={() => setEditing(null)} />
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
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <BulkBoardingPasses profileId={profileId} visitDates={trips.flatMap((t) => t.date.split("|")).filter(Boolean)} />
            <button type="button" onClick={() => setEditing("new")} className="btn btn-gold">
              + Upload boarding pass
            </button>
          </div>
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
          {current.length ? <div className="grid gap-4 lg:grid-cols-2">{journeys(current)}</div> : <p className="text-sm text-ink-soft">None yet.</p>}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-ink-soft">🧾 Previous trips ({previous.length})</h3>
          {previous.length ? (
            <CountrySearch>
              {/* Grouped by country (from the linked trip), e.g. all Thailand boarding passes together */}
              {byCountry(previous).map(([country, list]) => (
                <div key={country} data-search={country} className="space-y-3">
                  <h4 className="font-serif text-lg font-bold text-navy">
                    {country} <span className="text-sm font-normal text-ink-soft">· {list.length} boarding pass{list.length === 1 ? "" : "es"}</span>
                  </h4>
                  <div className="grid gap-4 lg:grid-cols-2">{journeys(list)}</div>
                </div>
              ))}
            </CountrySearch>
          ) : (
            <p className="text-sm text-ink-soft">None yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
