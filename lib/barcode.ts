/**
 * Reads boarding pass barcodes (PDF417 / Aztec / QR / Data Matrix) from images in the browser.
 * Works in every browser (the built-in BarcodeDetector is missing on Windows), using zxing-wasm.
 * The reader file is served by this app (/zxing/zxing_reader.wasm), not a third-party site.
 */
let ready: Promise<typeof import("zxing-wasm/reader")> | null = null;

function reader() {
  ready ??= import("zxing-wasm/reader").then((z) => {
    z.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
    });
    return z;
  });
  return ready;
}

/** Every barcode text found in these images (pages or photos). */
export async function readBarcodeTexts(images: Blob[]): Promise<string[]> {
  const z = await reader();
  const out: string[] = [];
  for (const image of images) {
    try {
      const results = await z.readBarcodes(image, { tryHarder: true, formats: ["PDF417", "Aztec", "QRCode", "DataMatrix"], maxNumberOfSymbols: 4 });
      for (const r of results) if (r.isValid && r.text) out.push(r.text);
    } catch {
      /* not readable: try the next image */
    }
  }
  return out;
}
