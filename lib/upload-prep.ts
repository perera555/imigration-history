/**
 * Browser only. Very large phone photos are made smaller (max 2400 px, JPEG) so uploads stay
 * under the hosting limit (~4.5 MB per request). PDFs and normal-size photos are left as they are.
 */
export async function prepareUpload(file: File, limit = 3_500_000): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= limit) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let quality = 0.88; quality >= 0.5; quality -= 0.12) {
      const c = document.createElement("canvas");
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= limit) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      scale *= 0.8;
    }
  } catch {
    /* fall through: send the original */
  }
  return file;
}
