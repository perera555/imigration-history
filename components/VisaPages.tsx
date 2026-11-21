"use client";

import { useRef, useState } from "react";
import { addVisaPage, deleteVisaPage } from "@/lib/visa-actions";
import { prepareUpload } from "@/lib/upload-prep";
import type { Visa } from "@/lib/data";
import { useToastOn } from "./Toaster";

/** Uploads files one by one as extra pages of a visa. Returns how many failed. */
export async function uploadVisaPages(visaId: string, files: File[], onProgress?: (done: number) => void) {
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const fd = new FormData();
    fd.append("page", await prepareUpload(files[i]));
    try {
      const r = await addVisaPage(visaId, fd);
      if (r.error) failed++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1);
  }
  return failed;
}

/**
 * "More visa pages": any number of photos / PDFs (visa page, entry and exit stamps, …).
 * With a visaId they upload straight away; for a new visa they are kept until the visa is saved.
 */
export function VisaPages({
  visaId,
  pages = [],
  canDelete = false,
  queued,
  onQueue,
}: {
  visaId?: string;
  pages?: Visa["pages"];
  canDelete?: boolean;
  /** New visa: files waiting for the first save. */
  queued?: File[];
  onQueue?: (files: File[]) => void;
}) {
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  useToastOn(msg.ok, msg.error);

  async function add(list: FileList | null) {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setMsg({});
    if (!visaId) {
      onQueue?.([...(queued ?? []), ...files]);
      return;
    }
    setBusy(`Uploading 0 of ${files.length}…`);
    const failed = await uploadVisaPages(visaId, files, (n) => setBusy(`Uploading ${n} of ${files.length}…`));
    setBusy(null);
    setMsg(failed ? { error: `${failed} file${failed === 1 ? "" : "s"} could not be added (JPEG, PNG or PDF, max 8 MB).` } : { ok: `✓ ${files.length} page${files.length === 1 ? "" : "s"} added.` });
  }

  const thumb = "relative h-24 w-20 overflow-hidden rounded-lg bg-paper shadow-[0_0_0_1px_rgba(0,0,0,0.08)]";

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="field-label !mb-0 mr-auto">More visa pages (visa page, entry / exit stamps…)</p>
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={!!busy} className="btn btn-primary !px-3 !py-1.5 text-xs">
          📷 Take photo
        </button>
        <button type="button" onClick={() => pickRef.current?.click()} disabled={!!busy} className="btn btn-ghost !px-3 !py-1.5 text-xs">
          🖼 Add pages (several at once)
        </button>
      </div>
      <input ref={pickRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      <div className="mt-3 flex flex-wrap gap-2">
        {pages.map((p, i) => (
          <div key={p.id} className={thumb}>
            <a href={`/api/visa-pages/${p.id}`} target="_blank" rel="noopener" title={`Page ${i + 1}: ${p.fileName}`}>
              {p.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/visa-pages/${p.id}`} alt={`Visa page ${i + 1}`} loading="lazy" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-2xl">📄</span>
              )}
            </a>
            <span className="absolute bottom-0 left-0 rounded-tr-md bg-navy/80 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
            {canDelete && (
              <button
                type="button"
                title="Remove this page"
                onClick={async () => {
                  if (confirm("Remove this visa page?")) await deleteVisaPage(p.id);
                }}
                className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-white/90 text-xs text-danger shadow"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {(queued ?? []).map((f, i) => (
          <div key={`q${i}`} className={`${thumb} grid place-items-center p-1 text-center text-[10px] text-ink-soft`}>
            <span>
              📎 {f.name.slice(0, 18)}
              <br />
              <b className="text-navy">saved with the visa</b>
            </span>
            <button type="button" title="Remove" onClick={() => onQueue?.((queued ?? []).filter((_, n) => n !== i))} className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-white/90 text-xs text-danger shadow">
              ✕
            </button>
          </div>
        ))}
        {!pages.length && !queued?.length && <p className="text-xs text-ink-soft">No extra pages yet. You can add as many as you need.</p>}
      </div>
      {busy && <p className="mt-2 text-sm font-medium text-navy-2">{busy}</p>}
      {msg.ok && <p className="mt-2 text-sm font-medium text-ok">{msg.ok}</p>}
      {msg.error && <p className="mt-2 text-sm font-medium text-danger">{msg.error}</p>}
    </div>
  );
}
