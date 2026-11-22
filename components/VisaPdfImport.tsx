"use client";

import { useEffect, useRef, useState } from "react";
import { addVisaFromPage, readVisaPageText } from "@/lib/visa-actions";
import { prepareUpload } from "@/lib/upload-prep";
import { ocrImages } from "@/lib/ocr";
import { countryName } from "@/lib/countries";
import type { VisaDetails } from "@/lib/visa-reader";
import { CountrySelect } from "./CountrySelect";
import { toast } from "./Toaster";

type PageItem = {
  page: number;
  image: File;
  preview: string;
  details: VisaDetails | null;
  country: string;
  include: boolean;
  result?: { ok: boolean; text: string };
};

const EMPTY: Partial<VisaDetails> = {
  countryCode: null,
  visaType: null,
  visaFormat: null,
  visaNumber: null,
  issueDate: null,
  expiryDate: null,
  travelFrom: null,
  travelTo: null,
  purpose: null,
  entries: null,
  stayDays: null,
  issuedAt: null,
  passportNumber: null,
};

const shortDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

/**
 * "Import visas from a PDF": one PDF with several visa pages (any countries) → each page is read
 * (text, or text recognition for scans), shown for review with its country, then saved as its own visa
 * with the page as its document.
 */
export function VisaPdfImport({ profileId }: { profileId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);

  // Free the page previews when they are no longer shown.
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.preview)), [items]);

  const update = (page: number, patch: Partial<PageItem>) => setItems((list) => list.map((i) => (i.page === page ? { ...i, ...patch } : i)));

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Choose a PDF with the visa pages.", "error");
    setItems([]);
    const found: PageItem[] = [];
    try {
      setBusy("Opening the PDF…");
      const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = Math.min(pdf.numPages, 64);
      for (let n = 1; n <= pages; n++) {
        setBusy(`Page ${n} of ${pages}: reading…`);
        const png = (await renderPageAsImage(pdf, n, { width: 2000, format: "png" })) as Uint8Array;
        let pageText = String((text as string[])[n - 1] ?? "");
        if (pageText.replace(/\s/g, "").length < 40) {
          // Scanned page: text recognition.
          try {
            const [ocr] = await ocrImages([new Blob([new Uint8Array(png)], { type: "image/png" })], (m) => setBusy(`Page ${n} of ${pages}: ${m}`));
            pageText = ocr ?? "";
          } catch {
            /* keep empty */
          }
        }
        const details = pageText.replace(/\s/g, "").length >= 40 ? await readVisaPageText(profileId, pageText) : null;
        const jpg = (await renderPageAsImage(pdf, n, { width: 1400, format: "jpeg", quality: 0.85 })) as Uint8Array;
        const image = new File([new Uint8Array(jpg)], `visa-page-${n}.jpg`, { type: "image/jpeg" });
        const looksLikeVisa = !!details && !!(details.visaNumber || details.visaType || details.issueDate || details.expiryDate || details.countryCode);
        found.push({ page: n, image, preview: URL.createObjectURL(image), details, country: details?.countryCode ?? "", include: looksLikeVisa });
      }
      setItems(found);
      toast(`${found.length} page${found.length === 1 ? "" : "s"} read. Check the country for each visa, then press Add visas.`, "info");
    } catch {
      toast("This PDF could not be read. Try another copy.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    // Same visa twice in this PDF (same number, or same country + dates): keep the first one only.
    const seen = new Set<string>();
    const repeated = new Set<number>();
    for (const it of items) {
      if (!it.include || it.result?.ok) continue;
      const d = it.details;
      const key = d?.visaNumber ? `n:${d.visaNumber}` : d?.issueDate || d?.expiryDate ? `d:${it.country}|${d?.issueDate}|${d?.expiryDate}` : null;
      if (key && seen.has(key)) {
        repeated.add(it.page);
        update(it.page, { include: false, result: { ok: false, text: "Same visa as an earlier page (not added twice)" } });
      }
      if (key) seen.add(key);
    }
    const chosen = items.filter((i) => i.include && !i.result?.ok && !repeated.has(i.page));
    const missing = chosen.filter((i) => !i.country);
    if (missing.length) return toast(`Choose the country for page ${missing.map((m) => m.page).join(", ")}.`, "error");
    let added = 0;
    for (const it of chosen) {
      setBusy(`Saving page ${it.page}…`);
      const fd = new FormData();
      fd.append("document", await prepareUpload(it.image));
      const r = await addVisaFromPage(profileId, { ...(it.details ?? {}), countryCode: it.country }, fd).catch(() => ({ error: "No answer from the server." }) as { error: string });
      if ("ok" in r && r.ok) {
        added++;
        update(it.page, { result: { ok: true, text: `Added as a ${countryName(it.country)} visa` } });
      } else update(it.page, { result: { ok: false, text: ("skipped" in r && r.skipped) || ("error" in r && r.error) || "Not added" } });
    }
    setBusy(null);
    toast(added ? `${added} visa${added === 1 ? "" : "s"} added — see each country below` : "No visas were added.", added ? "ok" : "error");
  }

  const toAdd = items.filter((i) => i.include && !i.result?.ok).length;

  return (
    <div className="mb-5 rounded-2xl border-2 border-dashed border-gold/50 bg-gold/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-2xl" aria-hidden>
          📑
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">Import visas from a PDF (several visa pages, any countries)</p>
          <p className="text-sm text-ink-soft">
            Upload one PDF with all your visa pages. Every page is read (scans too), then shown below so you can check its country. Each page
            becomes its own visa under its country, with the page saved as the visa&apos;s document.
          </p>
        </div>
        <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="btn btn-gold">
          {busy ? "Working…" : "📑 Choose visa pages PDF"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
      {busy && <p className="mt-3 text-sm font-medium text-navy-2">{busy}</p>}

      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((it) => {
            const d = it.details;
            const facts = [d?.visaType, d?.visaNumber && `No. ${d.visaNumber}`, d?.entries && `${d.entries} entry`, shortDate(d?.issueDate ?? null) && `Issued ${shortDate(d?.issueDate ?? null)}`, shortDate(d?.expiryDate ?? null) && `Expires ${shortDate(d?.expiryDate ?? null)}`].filter(Boolean);
            return (
              <div key={it.page} className={`flex flex-wrap items-start gap-3 rounded-xl border bg-white p-3 ${it.include ? "border-line" : "border-dashed border-line opacity-60"}`}>
                <a href={it.preview} target="_blank" rel="noopener" className="block h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" title="Open this page">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.preview} alt={`Page ${it.page}`} className="size-full object-cover" />
                </a>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <input type="checkbox" checked={it.include} disabled={!!it.result?.ok} onChange={(e) => update(it.page, { include: e.target.checked })} className="size-4 accent-navy" />
                    Page {it.page}: add as a visa
                  </label>
                  <p className="text-xs text-ink-soft">{facts.length ? `Read from the page: ${facts.join(" · ")}` : "No details could be read from this page — type them below."}</p>
                  {/* The visa form for this page: filled from the page, change anything before adding */}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <span className="field-label">Country *</span>
                      <CountrySelect key={`${it.page}-${it.country}`} name={`importCountry${it.page}`} defaultValue={it.country} onChange={(c) => update(it.page, { country: c })} />
                      {!it.country && it.include && <p className="mt-1 text-xs font-medium text-amber-700">Choose the country of this visa.</p>}
                    </div>
                    {(
                      [
                        ["visaType", "Visa type", "text"],
                        ["visaNumber", "Visa number", "text"],
                        ["entries", "Entries", "text"],
                        ["issueDate", "Issue date", "date"],
                        ["expiryDate", "Expiry date", "date"],
                      ] as const
                    ).map(([key, label, type]) => (
                      <label key={key}>
                        <span className="field-label">{label}</span>
                        <input
                          type={type}
                          value={(d?.[key] as string | null) ?? ""}
                          disabled={!!it.result?.ok}
                          onChange={(e) => update(it.page, { details: { ...(EMPTY as VisaDetails), ...(d ?? {}), [key]: e.target.value || null } })}
                          className="field !py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  {it.result && <p className={`text-sm font-medium ${it.result.ok ? "text-ok" : "text-danger"}`}>{it.result.ok ? "✓ " : ""}{it.result.text}</p>}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!!busy || toAdd === 0} onClick={save} className="btn btn-primary">
              ✓ Add {toAdd} visa{toAdd === 1 ? "" : "s"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => setItems([])} className="btn btn-ghost">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
