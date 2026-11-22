/**
 * Browser-only text recognition (OCR) for scanned visas: photos and scanned PDFs have no text inside,
 * so the pages are turned into images and "read". Free; the reader (~10 MB) downloads on first use.
 */

/** Pages of a PDF (or a photo) as images, max `maxPages`. */
export async function fileToImages(file: File, maxPages = 10): Promise<Blob[]> {
  if (file.type.startsWith("image/")) return [file];
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const out: Blob[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    // Sharp image: visa stickers are small on a scanned passport page.
    const bytes = (await renderPageAsImage(pdf, n, { width: 3000, format: "png" })) as Uint8Array;
    out.push(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
  }
  return out;
}

/** Reads the text in each image. */
export async function ocrImages(images: Blob[], onProgress?: (message: string) => void): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading the text reader (first time only)…");
  const worker = await createWorker("eng");
  try {
    const out: string[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress?.(images.length > 1 ? `Reading page ${i + 1} of ${images.length}…` : "Reading the visa…");
      const { data } = await worker.recognize(images[i]);
      out.push(data.text);
    }
    return out;
  } finally {
    await worker.terminate();
  }
}
