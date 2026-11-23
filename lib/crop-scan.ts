/**
 * Scans from a printer/scanner are a whole A4 page with the boarding pass somewhere on it.
 * Finds the printed area on the (white) page and cuts the empty paper away, so only the
 * boarding pass is kept. Browser only.
 */
/**
 * A scanned page (photo or a PDF without text) cut down to the boarding pass, or null when the file
 * isn't a scan or is already just the boarding pass. PDFs made by the airline (with text) stay as they are.
 */
export async function cropScan(file: File): Promise<File | null> {
  try {
    if (file.type.startsWith("image/")) return await cropToContent(file, file.name);
    if (file.type !== "application/pdf") return null;
    const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    if (String(text).replace(/\s/g, "").length > 40) return null; // a real PDF with text: keep it
    const bytes = (await renderPageAsImage(pdf, 1, { width: 2480, format: "png" })) as Uint8Array; // A4 at 300 dpi
    return await cropToContent(new Blob([new Uint8Array(bytes)], { type: "image/png" }), file.name);
  } catch {
    return null; // can't tell: keep the file as it is
  }
}

export async function cropToContent(image: Blob, name = "boarding-pass"): Promise<File | null> {
  const bmp = await createImageBitmap(image);
  try {
    // Look at a small copy to find where the printing is.
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const small = new OffscreenCanvas(w, h);
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(bmp, 0, 0, w, h);
    const px = sctx.getImageData(0, 0, w, h).data;
    const ink = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 200; // not paper-white
    };
    // Scanners leave dark lines and shadows along the page edges: look only inside a thin border.
    const mx = Math.round(w * 0.03);
    const my = Math.round(h * 0.025);
    // Rows / columns with real printing on them (not dust specks, not a full-width scanner line).
    const rowHas = (y: number) => {
      let n = 0;
      for (let x = mx; x < w - mx; x++) if (ink(x, y)) n++;
      return n > (w - 2 * mx) * 0.01 && n < (w - 2 * mx) * 0.9;
    };
    const colHas = (x: number, top: number, bottom: number) => {
      let n = 0;
      for (let y = top; y <= bottom; y++) if (ink(x, y)) n++;
      return n > (bottom - top + 1) * 0.01 && n < (bottom - top + 1) * 0.9;
    };
    let top = my;
    while (top < h - my && !rowHas(top)) top++;
    let bottom = h - 1 - my;
    while (bottom > top && !rowHas(bottom)) bottom--;
    if (bottom - top < h * 0.05) return null; // nothing printed found
    let left = mx;
    while (left < w - mx && !colHas(left, top, bottom)) left++;
    let right = w - 1 - mx;
    while (right > left && !colHas(right, top, bottom)) right--;
    // Already just the boarding pass (no big empty paper around it): keep it as it is.
    if ((bottom - top) * (right - left) > w * h * 0.8) return null;

    // A little margin, then cut from the full-size image.
    const pad = Math.round(Math.max(w, h) * 0.015);
    const [x0, y0] = [Math.max(0, left - pad), Math.max(0, top - pad)];
    const [x1, y1] = [Math.min(w, right + pad), Math.min(h, bottom + pad)];
    const sx = Math.round(x0 / scale);
    const sy = Math.round(y0 / scale);
    const sw = Math.round((x1 - x0) / scale);
    const sh = Math.round((y1 - y0) / scale);
    const out = new OffscreenCanvas(sw, sh);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await out.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    return new File([blob], `${name.replace(/\.[a-z0-9]+$/i, "")}-boarding-pass.jpg`, { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
