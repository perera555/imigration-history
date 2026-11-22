"use client";

import { useRef, useState } from "react";
import { addVisaFromPage, readVisaPageText } from "@/lib/visa-actions";
import { prepareUpload } from "@/lib/upload-prep";
import { ocrImages } from "@/lib/ocr";
import { countryName } from "@/lib/countries";
import { CountrySelect } from "./CountrySelect";
import { toast } from "./Toaster";

type Line = { page: number; text: string; ok: boolean };

/**
 * "Import visas from a PDF": one PDF with several visa pages → one visa per page, with the details read
 * from each page (country, type, number, dates, entries…) and the page saved as that visa's document.
 */
export function VisaPdfImport({ profileId }: { profileId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<Line[]>([]);

  async function run(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Choose a PDF with the visa pages.", "error");
    setReport([]);
    const lines: Line[] = [];
    try {
      setBusy("Reading the PDF…");
      const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = Math.min(pdf.numPages, 64);
      for (let n = 1; n <= pages; n++) {
        setBusy(`Page ${n} of ${pages}: reading the visa…`);
        let pageText = String((text as string[])[n - 1] ?? "");
        // Scanned page (no text inside): read it with text recognition.
        if (pageText.replace(/\s/g, "").length < 40) {
          try {
            const img = (await renderPageAsImage(pdf, n, { width: 2000, format: "png" })) as Uint8Array;
            const [ocr] = await ocrImages([new Blob([new Uint8Array(img)], { type: "image/png" })], (m) => setBusy(`Page ${n} of ${pages}: ${m}`));
            pageText = ocr ?? "";
          } catch {
            /* keep empty */
          }
        }
        const details = pageText.replace(/\s/g, "").length >= 40 ? await readVisaPageText(profileId, pageText) : null;
        const found = !!details && !!(details.visaNumber || details.visaType || details.issueDate || details.expiryDate || details.countryCode);
        const country = details?.countryCode ?? (fallback || null);
        if (details && !found && !fallback) {
          lines.push({ page: n, ok: false, text: "No visa details on this page (skipped)." });
          continue;
        }
        if (!country) {
          lines.push({ page: n, ok: false, text: "Country not found. Choose “Country for unreadable pages” and import again." });
          continue;
        }
        setBusy(`Page ${n} of ${pages}: saving…`);
        const bytes = (await renderPageAsImage(pdf, n, { width: 1400, format: "jpeg", quality: 0.85 })) as Uint8Array;
        const image = await prepareUpload(new File([new Uint8Array(bytes)], `visa-page-${n}.jpg`, { type: "image/jpeg" }));
        const fd = new FormData();
        fd.append("document", image);
        const r = await addVisaFromPage(profileId, { ...(details ?? {}), countryCode: country }, fd).catch(() => ({ error: "No answer from the server." }) as { error: string });
        if ("ok" in r && r.ok) {
          const what = [countryName(country), details?.visaType, details?.visaNumber].filter(Boolean).join(" · ");
          lines.push({ page: n, ok: true, text: `${what}${found ? "" : " (scanned page: please fill in the details)"}` });
        } else lines.push({ page: n, ok: false, text: ("skipped" in r && r.skipped) || ("error" in r && r.error) || "Not added." });
      }
      const added = lines.filter((l) => l.ok).length;
      toast(added ? `${added} visa${added === 1 ? "" : "s"} added from the PDF` : "No visas were added from this PDF.", added ? "ok" : "error");
    } catch {
      toast("This PDF could not be read. Try another copy.", "error");
    } finally {
      setReport(lines);
      setBusy(null);
    }
  }

  return (
    <div className="mb-5 rounded-2xl border-2 border-dashed border-gold/50 bg-gold/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-2xl" aria-hidden>
          📑
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">Import visas from a PDF (several visa pages)</p>
          <p className="text-sm text-ink-soft">
            Upload one PDF with all your visa pages. Each page becomes its own visa: the country, type, number, dates and entries are read
            from the page, and the page is saved as that visa&apos;s document. Visas already in the record are skipped.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <span className="field-label">Country for unreadable (scanned) pages (optional)</span>
          <CountrySelect name="importFallbackCountry" defaultValue="" onChange={setFallback} />
        </div>
        <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="btn btn-gold">
          {busy ? "Importing…" : "📑 Choose visa pages PDF"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => { run(e.target.files?.[0]); e.target.value = ""; }} />
      {busy && <p className="mt-3 text-sm font-medium text-navy-2">{busy}</p>}
      {report.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-white p-3 text-sm">
          {report.map((l) => (
            <li key={l.page} className={l.ok ? "text-ok" : "text-ink-soft"}>
              {l.ok ? "✓" : "–"} Page {l.page}: {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
