"use client";

import { useEffect, useRef, useState } from "react";
import { prepareUpload } from "@/lib/upload-prep";

export const isImageName = (name?: string | null, mime?: string | null) =>
  !!(mime?.startsWith("image/") || (name && /\.(png|jpe?g|webp)$/i.test(name)));

/**
 * Photo / document field: "📷 Take photo" (camera on phones), "🖼 Choose photo or PDF", and a preview.
 * The chosen file is sent with the form under `name`. `inputRef` gives the parent access to the file
 * (e.g. for "Read details").
 */
export function DocumentPicker({
  name,
  inputRef,
  label,
  saved,
  onPicked,
}: {
  name: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  /** Already saved file, shown until a new one is picked. */
  saved?: { url: string; name: string | null; image: boolean } | null;
  onPicked?: (file: File) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; url: string | null; size: number } | null>(null);

  useEffect(() => () => {
    if (picked?.url) URL.revokeObjectURL(picked.url);
  }, [picked]);

  async function use(original: File | undefined, fromCamera = false) {
    if (!original) return;
    const file = await prepareUpload(original);
    // A camera photo (or a photo made smaller) goes into the real (named) input so it is saved with the form.
    if ((fromCamera || file !== original) && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
    setPicked({ name: file.name, size: file.size, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
    onPicked?.(file);
  }

  const shown = picked ?? (saved ? { name: saved.name ?? "Saved document", url: saved.image ? saved.url : null, size: 0 } : null);

  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => cameraRef.current?.click()} className="btn btn-primary">
          📷 Take photo
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-ghost">
          🖼 Choose photo or PDF
        </button>
        <span className="text-xs text-ink-soft">JPEG, PNG or PDF · max 8 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => use(e.target.files?.[0])}
      />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => use(e.target.files?.[0], true)} />

      {shown && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-white p-2 pr-4">
          {shown.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.url} alt="" className="h-20 w-28 rounded-lg object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
          ) : (
            <div className="grid h-20 w-28 place-items-center rounded-lg bg-red-50 text-2xl" aria-hidden>
              📄
            </div>
          )}
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-navy">{shown.name}</p>
            <p className="text-xs text-ink-soft">
              {picked ? `New · ${Math.max(1, Math.round(picked.size / 1024))} KB · saved when you press Save` : "Saved"}
            </p>
            {!picked && saved && (
              <a href={saved.url} target="_blank" rel="noopener" className="text-xs font-semibold text-navy-2 hover:underline">
                Open full size
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
