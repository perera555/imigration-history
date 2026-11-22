"use client";

import { useEffect, useRef, useState } from "react";
import { addVisaFromPage, readVisaPageImage, readVisaPageText } from "@/lib/visa-actions";
import { prepareUpload } from "@/lib/upload-prep";
import { ocrImages } from "@/lib/ocr";
import { countryName } from "@/lib/countries";
import type { VisaDetails } from "@/lib/visa-reader";
import { CountrySelect } from "./CountrySelect";
import { DateInput } from "./DateInput";
import { toast } from "./Toaster";

/** One visa found in the PDF (a page can hold several). */
type Item = {
  id: string;
  page: number;
  image: File;
  /** File saved as the visa's document (default: the page image). */
  document?: File;
  preview: string;
  details: VisaDetails;
  /** How the details were found. */
  source: "text" | "ai" | "ocr" | "none";
  include: boolean;
  result?: { ok: boolean; text: string };
};

const EMPTY: VisaDetails = {
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

const hasVisaInfo = (d: VisaDetails | null) => !!d && !!(d.visaNumber || d.visaType || d.issueDate || d.expiryDate || d.countryCode);

const SOURCE_TEXT: Record<Item["source"], string> = {
  text: "Details read from the page",
  ai: "Details read by AI",
  ocr: "Details read from the scan",
  none: "No details could be read from this page — fill in the form",
};

/**
 * "Import visas from a PDF": one PDF with visa pages (any countries). Every visa is read — PDF text,
 * Claude AI for scans when set up, otherwise free text recognition — and shown as a filled form for
 * review. Ticked visas are added to the visa section, each under its country with its page as document.
 */
export function VisaPdfImport({ profileId }: { profileId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.preview)), [items]);

  const update = (id: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  /** Editing a field fills the form and ticks it, so it will be added. */
  const edit = (it: Item, patch: Partial<VisaDetails>) => update(it.id, { details: { ...it.details, ...patch }, include: true });

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Choose a PDF with the visa pages.", "error");
    setItems([]);
    const found: Item[] = [];
    let aiAvailable: boolean | null = null;
    try {
      setBusy("Opening the PDF…");
      const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = Math.min(pdf.numPages, 64);
      const pageTexts = (text as string[]).slice(0, pages).map((t) => String(t ?? ""));

      // An e-visa / grant notice over several pages (details on page 1, number on page 2, conditions…) is ONE visa:
      // read all pages together and keep the original PDF as its document.
      if (pages > 1 && pageTexts.every((t) => t.replace(/\s/g, "").length >= 40)) {
        setBusy("Reading the visa document…");
        const perPage = await Promise.all(pageTexts.map((t) => readVisaPageText(profileId, t)));
        const numbers = new Set(perPage.map((d) => d?.visaNumber).filter(Boolean));
        const countries = new Set(perPage.map((d) => d?.countryCode).filter(Boolean));
        if (numbers.size <= 1 && countries.size <= 1) {
          const merged = await readVisaPageText(profileId, pageTexts.join("\n"));
          if (hasVisaInfo(merged)) {
            const jpg = (await renderPageAsImage(pdf, 1, { width: 1600, format: "jpeg", quality: 0.88 })) as Uint8Array;
            const image = new File([new Uint8Array(jpg)], "visa-page-1.jpg", { type: "image/jpeg" });
            found.push({
              id: "doc",
              page: 1,
              image,
              document: file.size <= 4_000_000 ? file : undefined,
              preview: URL.createObjectURL(image),
              details: { ...EMPTY, ...merged! },
              source: "text",
              include: true,
            });
            setItems(found);
            toast(`Visa document read (${pages} pages, one visa). Check it, then press Add visas.`, "ok");
            return;
          }
        }
      }

      for (let n = 1; n <= pages; n++) {
        setBusy(`Page ${n} of ${pages}: reading…`);
        const jpg = (await renderPageAsImage(pdf, n, { width: 1600, format: "jpeg", quality: 0.88 })) as Uint8Array;
        const image = new File([new Uint8Array(jpg)], `visa-page-${n}.jpg`, { type: "image/jpeg" });
        const add = (details: VisaDetails | null, source: Item["source"], k = 0) =>
          found.push({
            id: `${n}-${k}`,
            page: n,
            image,
            preview: URL.createObjectURL(image),
            details: { ...EMPTY, ...(details ?? {}) },
            source,
            include: hasVisaInfo(details),
          });

        // 1. PDF with text (e-visa, grant notice).
        const pageText = String((text as string[])[n - 1] ?? "");
        if (pageText.replace(/\s/g, "").length >= 40) {
          const d = await readVisaPageText(profileId, pageText);
          if (hasVisaInfo(d)) {
            add(d, "text");
            continue;
          }
        }
        // 2. Scanned page: Claude AI reads every visa on it (when set up).
        if (aiAvailable !== false) {
          setBusy(`Page ${n} of ${pages}: reading the visas with AI…`);
          const fd = new FormData();
          fd.append("page", await prepareUpload(image));
          const r = await readVisaPageImage(profileId, fd).catch(() => ({ ai: false }) as const);
          aiAvailable = r.ai;
          if (r.ai && r.visas.length) {
            r.visas.forEach((v, k) => add(v, "ai", k));
            continue;
          }
          if (r.ai && !r.error) {
            // AI found no visa on this page (e.g. only entry/exit stamps): offer it unticked.
            add(null, "none");
            continue;
          }
        }
        // 3. Free text recognition on a sharper image.
        let details: VisaDetails | null = null;
        try {
          const png = (await renderPageAsImage(pdf, n, { width: 3000, format: "png" })) as Uint8Array;
          const [ocr] = await ocrImages([new Blob([new Uint8Array(png)], { type: "image/png" })], (m) => setBusy(`Page ${n} of ${pages}: ${m}`));
          if ((ocr ?? "").replace(/\s/g, "").length >= 40) details = await readVisaPageText(profileId, ocr);
        } catch {
          /* nothing read */
        }
        add(details, hasVisaInfo(details) ? "ocr" : "none");
      }
      setItems(found);
      const filled = found.filter((i) => i.include).length;
      toast(
        filled
          ? `${filled} visa${filled === 1 ? "" : "s"} found and filled in. Check them, then press Add visas.`
          : "No visa details could be read automatically. Fill in the forms below, then press Add visas.",
        filled ? "ok" : "info",
      );
    } catch {
      toast("This PDF could not be read. Try another copy.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    // Same visa twice in this PDF (same number, or same country + dates): keep the first one only.
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const it of items) {
      if (!it.include || it.result?.ok) continue;
      const d = it.details;
      const key = d.visaNumber ? `n:${d.visaNumber}` : d.issueDate || d.expiryDate ? `d:${d.countryCode}|${d.issueDate}|${d.expiryDate}` : null;
      if (key && seen.has(key)) {
        repeated.add(it.id);
        update(it.id, { include: false, result: { ok: false, text: "Same visa as an earlier one (not added twice)" } });
      }
      if (key) seen.add(key);
    }
    const chosen = items.filter((i) => i.include && !i.result?.ok && !repeated.has(i.id));
    const missing = chosen.filter((i) => !i.details.countryCode);
    if (missing.length) return toast(`Choose the country for ${missing.map((m) => `page ${m.page}`).join(", ")}.`, "error");
    let added = 0;
    for (const it of chosen) {
      setBusy(`Adding the visa from page ${it.page}…`);
      const fd = new FormData();
      fd.append("document", it.document ?? (await prepareUpload(it.image)));
      const r = await addVisaFromPage(profileId, it.details, fd).catch(() => ({ error: "No answer from the server." }) as { error: string });
      if ("ok" in r && r.ok) {
        added++;
        update(it.id, { result: { ok: true, text: `Added to the visa section under ${countryName(it.details.countryCode!)}` } });
      } else update(it.id, { result: { ok: false, text: ("skipped" in r && r.skipped) || ("error" in r && r.error) || "Not added" } });
    }
    setBusy(null);
    toast(added ? `${added} visa${added === 1 ? "" : "s"} added to the visa section` : "No visas were added.", added ? "ok" : "error");
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
            Upload one PDF with your visa pages. Every visa is read and filled into its own form below. Check it, then press <b>Add visas</b>: each
            visa is added to the visa section under its country, with its page saved as the document.
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
            const done = !!it.result?.ok;
            return (
              <div key={it.id} className={`flex flex-wrap items-start gap-3 rounded-xl border bg-white p-3 ${it.include ? "border-gold/60" : "border-dashed border-line"}`}>
                <a href={it.preview} target="_blank" rel="noopener" className="block h-36 w-28 shrink-0 overflow-hidden rounded-lg bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" title="Open this page full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.preview} alt={`Page ${it.page}`} className="size-full object-cover" />
                </a>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <input type="checkbox" checked={it.include} disabled={done} onChange={(e) => update(it.id, { include: e.target.checked })} className="size-4 accent-navy" />
                    Page {it.page}: add this visa to the visa section
                  </label>
                  <p className={`text-xs ${it.source === "none" ? "text-amber-700" : "text-ok"}`}>
                    {it.source === "none" ? "" : "✓ "}
                    {SOURCE_TEXT[it.source]}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <span className="field-label">Country *</span>
                      <CountrySelect key={`${it.id}-${d.countryCode ?? ""}`} name={`importCountry${it.id}`} defaultValue={d.countryCode ?? ""} onChange={(c) => edit(it, { countryCode: c || null })} />
                    </div>
                    <label>
                      <span className="field-label">Visa type</span>
                      <input value={d.visaType ?? ""} disabled={done} onChange={(e) => edit(it, { visaType: e.target.value || null })} className="field !py-1.5 text-sm" placeholder="Tourist" />
                    </label>
                    <label>
                      <span className="field-label">Visa number</span>
                      <input value={d.visaNumber ?? ""} disabled={done} onChange={(e) => edit(it, { visaNumber: e.target.value.toUpperCase() || null })} className="field !py-1.5 font-mono text-sm" />
                    </label>
                    <label>
                      <span className="field-label">Entries</span>
                      <select value={d.entries ?? ""} disabled={done} onChange={(e) => edit(it, { entries: e.target.value || null })} className="field !py-1.5 text-sm">
                        <option value="">—</option>
                        <option>Single</option>
                        <option>Double</option>
                        <option>Multiple</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Issue date</span>
                      <DateInput value={d.issueDate ?? ""} disabled={done} onChange={(e) => edit(it, { issueDate: e.target.value || null })} className="field !py-1.5 text-sm" />
                    </label>
                    <label>
                      <span className="field-label">Expiry date</span>
                      <DateInput value={d.expiryDate ?? ""} disabled={done} onChange={(e) => edit(it, { expiryDate: e.target.value || null })} className="field !py-1.5 text-sm" />
                    </label>
                  </div>
                  {it.result && <p className={`text-sm font-medium ${it.result.ok ? "text-ok" : "text-danger"}`}>{it.result.ok ? "✓ " : ""}{it.result.text}</p>}
                  {/* Several visas on one page (e.g. two Thailand visas): one more form for the same page */}
                  <button
                    type="button"
                    onClick={() =>
                      setItems((list) => {
                        const at = list.findIndex((x) => x.id === it.id);
                        const copy: Item = {
                          ...it,
                          id: `${it.page}-${Date.now()}`,
                          details: { ...EMPTY, countryCode: it.details.countryCode },
                          source: "none",
                          include: false,
                          result: undefined,
                        };
                        return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
                      })
                    }
                    className="text-xs font-semibold text-navy-2 hover:underline"
                  >
                    + Another visa on this page
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!!busy || toAdd === 0} onClick={save} className="btn btn-primary">
              ✓ Add {toAdd} visa{toAdd === 1 ? "" : "s"} to the visa section
            </button>
            <button type="button" disabled={!!busy} onClick={() => setItems([])} className="btn btn-ghost">
              Clear
            </button>
            {toAdd === 0 && <span className="text-sm text-ink-soft">Fill in a form (choose its country) to add that visa.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
