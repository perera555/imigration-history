"use client";

import { useState } from "react";
import { useToastOn } from "./Toaster";

/** Picks an image, resizes it in the browser to ≤600px JPEG, and submits it as a data URL. */
export function PhotoInput({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string | null;
  onChange?: (dataUrl: string) => void;
}) {
  const [photo, setPhotoState] = useState(defaultValue ?? "");
  const setPhoto = (value: string) => {
    setPhotoState(value);
    onChange?.(value);
  };
  const [error, setError] = useState("");
  useToastOn(null, error);

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setError("Could not read that image. Try a JPG or PNG.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={name} value={photo} />
      <div className="h-32 w-26 shrink-0 overflow-hidden rounded-xl border border-line bg-paper-2">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Profile photo preview" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink-soft">No photo</div>
        )}
      </div>
      <div className="space-y-2">
        <label className="btn btn-ghost cursor-pointer">
          {photo ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {photo && (
          <button type="button" onClick={() => setPhoto("")} className="block text-xs text-danger underline">
            Remove photo
          </button>
        )}
        <p className="text-xs text-ink-soft">Passport-style photo works best.</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
