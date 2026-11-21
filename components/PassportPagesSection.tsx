"use client";

import { useMemo, useRef, useState } from "react";
import { deletePassportPdf, uploadPassportPdfPart } from "@/lib/passport-actions";
import type { PassportDocument, PassportPage } from "@/lib/data";
import { toast } from "./Toaster";

/** Upload part size: stays under the hosting's ~4.5 MB request limit. */
const PART = 3_000_000;
const MAX_PDF = 60 * 1024 * 1024;

const sizeText = (n: number) => (n >= 1_000_000 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateText = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

async function countPages(file: File): Promise<number | null> {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    return pdf.numPages;
  } catch {
    return null;
  }
}

/**
 * "Passport PDFs": one PDF with all pages of each passport (current and previous),
 * saved under the passport number. Users and admins.
 */
export function PassportPagesSection({
  profileId,
  current,
  previous,
  documents = [],
  canDelete,
}: {
  profileId: string;
  current: string | null;
  previous: string[];
  /** Not shown any more (one PDF per passport instead); kept for compatibility. */
  pages?: PassportPage[];
  documents?: PassportDocument[];
  canDelete: boolean;
}) {
  const passports = useMemo(() => {
    const list = [current, ...previous, ...documents.map((d) => d.passportNumber)].filter((p): p is string => !!p);
    return [...new Set(list.map((p) => p.toUpperCase()))];
  }, [current, previous, documents]);
  const [busy, setBusy] = useState<{ number: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  async function upload(file: File | undefined, number: string | null) {
    if (!file || !number) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Choose a PDF file of the passport.", "error");
    if (file.size > MAX_PDF) return toast("The PDF is too large (max 60 MB).", "error");
    const existing = documents.find((d) => d.passportNumber === number);
    if (existing && !confirm(`Replace the saved PDF of passport ${number}?`)) return;
    try {
      setBusy({ number, text: "Reading the PDF…" });
      const pageCount = await countPages(file);
      const total = Math.max(1, Math.ceil(file.size / PART));
      for (let i = 0; i < total; i++) {
        setBusy({ number, text: total > 1 ? `Uploading… ${Math.round((i / total) * 100)}%` : "Uploading…" });
        const fd = new FormData();
        fd.append("part", file.slice(i * PART, (i + 1) * PART));
        const r = await uploadPassportPdfPart(profileId, number, { fileName: file.name, size: file.size, pageCount }, i, total, fd);
        if (r.error) {
          toast(r.error, "error");
          return;
        }
      }
    } catch {
      toast("Upload stopped (no answer from the server). Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="passport-pages" className="panel scroll-mt-24 p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Passports</p>
      <h2 className="mt-1 font-serif text-2xl font-bold text-navy">📘 Passport PDFs</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Save one PDF with all pages of each passport (up to 64 pages). It is kept under the passport number, for your current and previous passports.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files?.[0], target);
          e.target.value = "";
        }}
      />

      {passports.length === 0 ? (
        <p className="mt-5 rounded-xl bg-paper/60 px-4 py-3 text-sm text-ink-soft">
          Add your passport numbers in the travel card first (current and previous passports), then upload each passport&apos;s PDF here.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {passports.map((number) => {
            const doc = documents.find((d) => d.passportNumber === number);
            const isCurrent = number === current?.toUpperCase();
            const working = busy?.number === number;
            return (
              <li key={number} className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
                <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl ${doc ? "bg-navy" : "bg-paper-2"}`} aria-hidden>
                  {doc ? "📕" : "📘"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-wider text-navy">{number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isCurrent ? "bg-gold text-navy" : "bg-paper-2 text-ink-soft"}`}>
                      {isCurrent ? "Current passport" : "Previous passport"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {working
                      ? busy!.text
                      : doc
                        ? `${doc.pageCount ? `${doc.pageCount} pages · ` : ""}${sizeText(doc.size)} · saved ${dateText(doc.createdAt)}`
                        : "No PDF saved yet"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doc && (
                    <>
                      <a href={`/api/passport-documents/${doc.id}`} target="_blank" rel="noopener" className="btn btn-ghost !px-3 !py-1.5 text-xs">
                        👁 View
                      </a>
                      <a href={`/api/passport-documents/${doc.id}?download=1`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                        ⬇ Download
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      setTarget(number);
                      inputRef.current?.click();
                    }}
                    className={`btn !px-3 !py-1.5 text-xs ${doc ? "btn-ghost" : "btn-gold"}`}
                  >
                    {working ? "Uploading…" : doc ? "↻ Replace PDF" : "⬆ Upload passport PDF"}
                  </button>
                  {doc && canDelete && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={async () => {
                        if (confirm(`Delete the PDF of passport ${number}? (You can get it back from Backup & recovery.)`)) await deletePassportPdf(doc.id);
                      }}
                      className="btn btn-danger !px-3 !py-1.5 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
