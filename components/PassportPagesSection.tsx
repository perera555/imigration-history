"use client";

import { useMemo, useRef, useState } from "react";
import { deletePassportPage, savePassportPage } from "@/lib/passport-actions";
import { prepareUpload } from "@/lib/upload-prep";
import type { PassportPage } from "@/lib/data";
import { toast } from "./Toaster";

const TOTAL = 64;

/**
 * "Passport pages": scan and save every page (up to 64) of the current and previous passports,
 * each saved under its passport number. Users and admins.
 */
export function PassportPagesSection({
  profileId,
  current,
  previous,
  pages,
  canDelete,
}: {
  profileId: string;
  current: string | null;
  previous: string[];
  pages: PassportPage[];
  canDelete: boolean;
}) {
  // Passports: current first, then previous, then any number that only has saved pages.
  const passports = useMemo(() => {
    const list = [current, ...previous, ...pages.map((p) => p.passportNumber)].filter((p): p is string => !!p);
    return [...new Set(list.map((p) => p.toUpperCase()))];
  }, [current, previous, pages]);
  const [active, setActive] = useState(passports[0] ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null); // page chosen for the next upload
  const pickRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const byPage = new Map(pages.filter((p) => p.passportNumber === active).map((p) => [p.pageNo, p]));
  const saved = byPage.size;

  async function upload(files: File[], startPage: number | null) {
    if (!active || !files.length) return;
    let done = 0;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setBusy(`Saving page ${i + 1} of ${files.length}…`);
      const fd = new FormData();
      fd.append("page", await prepareUpload(files[i]));
      try {
        // One chosen page: exactly that page. Several files: next empty pages in order.
        const r = await savePassportPage(profileId, active, files.length === 1 ? startPage : null, fd);
        if (r.error) {
          failed++;
          toast(r.error, "error");
          if (r.error.startsWith("All ")) break;
        } else done++;
      } catch {
        failed++;
      }
    }
    setBusy(null);
    setTarget(null);
    if (done) toast(`${done} page${done === 1 ? "" : "s"} of passport ${active} saved successfully`);
    if (failed && !done) toast("The pages could not be saved. Please try again.", "error");
  }

  const firstEmpty = Array.from({ length: TOTAL }, (_, i) => i + 1).find((n) => !byPage.has(n)) ?? null;

  return (
    <section id="passport-pages" className="panel scroll-mt-24 p-6 sm:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Passports</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">📘 Passport pages</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Scan and save every page of your current and previous passports. Each passport keeps its own pages under its number.
          </p>
        </div>
      </div>

      {passports.length === 0 ? (
        <p className="mt-5 rounded-xl bg-paper/60 px-4 py-3 text-sm text-ink-soft">
          Add your passport number in the travel card first (current and previous passports), then scan the pages here.
        </p>
      ) : (
        <>
          {/* One tab per passport */}
          <div className="mt-5 flex flex-wrap gap-2" role="tablist">
            {passports.map((p) => {
              const n = pages.filter((x) => x.passportNumber === p).length;
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={p === active}
                  onClick={() => setActive(p)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    p === active ? "border-navy bg-navy text-white shadow-md" : "border-line bg-white text-navy hover:border-gold"
                  }`}
                >
                  <span className="font-mono tracking-wider">{p}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${p === current?.toUpperCase() ? "bg-gold text-navy" : p === active ? "bg-white/15" : "bg-paper-2 text-ink-soft"}`}>
                    {p === current?.toUpperCase() ? "Current" : "Previous"}
                  </span>
                  <span className={`text-xs ${p === active ? "text-white/70" : "text-ink-soft"}`}>{n}/{TOTAL}</span>
                </button>
              );
            })}
          </div>

          {/* Actions + progress */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!!busy || firstEmpty === null}
              onClick={() => {
                setTarget(firstEmpty);
                cameraRef.current?.click();
              }}
              className="btn btn-primary"
            >
              📷 Scan next page{firstEmpty ? ` (page ${firstEmpty})` : ""}
            </button>
            <button type="button" disabled={!!busy} onClick={() => multiRef.current?.click()} className="btn btn-ghost">
              🖼 Add several pages
            </button>
            {saved > 0 && (
              <a href={`/api/profiles/${profileId}/passport-pdf?passport=${encodeURIComponent(active)}`} className="btn btn-gold" onClick={() => toast("Preparing the passport PDF…", "info")}>
                ⬇ Download pages as PDF
              </a>
            )}
            <div className="ml-auto min-w-48 flex-1 sm:max-w-xs">
              <div className="flex justify-between text-xs text-ink-soft">
                <span>{saved} of {TOTAL} pages saved</span>
                <span>{Math.round((saved / TOTAL) * 100)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-2">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-navy transition-all" style={{ width: `${(saved / TOTAL) * 100}%` }} />
              </div>
            </div>
          </div>
          {busy && <p className="mt-2 text-sm font-medium text-navy-2">{busy}</p>}

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload([...(e.target.files ?? [])], target); e.target.value = ""; }} />
          <input ref={pickRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { upload([...(e.target.files ?? [])], target); e.target.value = ""; }} />
          <input ref={multiRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { upload([...(e.target.files ?? [])], null); e.target.value = ""; }} />

          {/* 64 page slots: tap an empty one to scan / upload that page */}
          <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
              const p = byPage.get(n);
              return (
                <div key={n} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-paper/50">
                  {p ? (
                    <a href={`/api/passport-pages/${p.id}`} target="_blank" rel="noopener" title={`Page ${n}: open full size`} className="block size-full">
                      {p.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/passport-pages/${p.id}`} alt={`Passport ${active} page ${n}`} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-2xl">📄</span>
                      )}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        setTarget(n);
                        pickRef.current?.click();
                      }}
                      title={`Add page ${n}`}
                      className="grid size-full place-items-center text-ink-soft/60 transition hover:bg-gold/10 hover:text-navy"
                    >
                      <span className="text-center text-[11px] leading-tight">
                        <span className="block text-lg">+</span>
                        Page {n}
                      </span>
                    </button>
                  )}
                  <span className={`absolute left-1 top-1 rounded px-1.5 text-[10px] font-bold ${p ? "bg-navy/85 text-white" : "text-ink-soft/70"}`}>{n}</span>
                  {p && (
                    <div className="absolute right-1 top-1 flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                      <button
                        type="button"
                        title="Re-scan this page"
                        onClick={() => {
                          setTarget(n);
                          pickRef.current?.click();
                        }}
                        className="grid size-6 place-items-center rounded-full bg-white/90 text-xs shadow"
                      >
                        ↻
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          title="Delete this page"
                          onClick={async () => {
                            if (confirm(`Delete page ${n} of passport ${active}? (You can get it back from Backup & recovery.)`)) await deletePassportPage(p.id);
                          }}
                          className="grid size-6 place-items-center rounded-full bg-white/90 text-xs text-danger shadow"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
