"use client";

import { useRef, useState } from "react";
import { deleteBoardingPass, readBoardingPass, saveBoardingPass } from "@/lib/boarding-actions";
import { parseBcbp } from "@/lib/bcbp";
import { prepareUpload } from "@/lib/upload-prep";
import { CountrySearch } from "./CountrySearch";
import { useToastOn } from "./Toaster";
import type { BoardingPass } from "@/lib/data";
import { BoardingPassForm, type TripOption } from "./BoardingPassForm";
import { ConfirmButton } from "./SubmitButton";
import { downloadBoardingPassImage } from "@/lib/bp-image";

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** Reads flight details from a file: PDF text (server) or barcode in a photo (browser). */
async function detailsFrom(profileId: string, file: File): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    if (file.type === "application/pdf") {
      const fd = new FormData();
      fd.append("file", file);
      const r = await readBoardingPass(profileId, fd);
      if (r && "ok" in r) for (const [k, v] of Object.entries(r.details)) if (v) out[k] = String(v);
    } else {
      type Detector = { detect: (src: ImageBitmap) => Promise<{ rawValue: string }[]> };
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) {
        const codes = await new BD({ formats: ["pdf417", "aztec", "qr_code", "data_matrix"] }).detect(await createImageBitmap(file));
        const d = codes.map((c) => parseBcbp(c.rawValue)).find(Boolean);
        if (d) {
          for (const k of ["flightNumber", "fromAirport", "toAirport", "flightDate", "seat", "bookingRef"] as const) if (d[k]) out[k] = String(d[k]);
          if (d.airlineCode) out.airline = d.airlineCode;
        }
      }
    }
  } catch {
    /* details stay empty; the file is still saved */
  }
  return out;
}

/** "📷 Add several boarding passes": one boarding pass per chosen file, details read when possible, linked to trips by date. */
function BulkBoardingPasses({ profileId }: { profileId: string }) {
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
      const file = await prepareUpload(files[i]);
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(await detailsFrom(profileId, file))) fd.append(k, v);
      try {
        const r = await saveBoardingPass(profileId, null, undefined, fd);
        if (r?.error) problems.push(`${files[i].name}: ${r.error}`);
        else added++;
      } catch {
        problems.push(`${files[i].name}: no answer from the server`);
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
      {p.hasFile && (p.mime?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(p.fileName ?? "")) && (
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
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <BulkBoardingPasses profileId={profileId} />
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
          {current.length ? <div className="grid gap-4 lg:grid-cols-2">{current.map(card)}</div> : <p className="text-sm text-ink-soft">None yet.</p>}
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
                  <div className="grid gap-4 lg:grid-cols-2">{list.map(card)}</div>
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
