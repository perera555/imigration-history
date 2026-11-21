"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid, PASSPORT_PAGES } from "./data";
import { requireAdmin, requireProfileAccess } from "./session";

const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

const cleanNumber = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "").slice(0, 30);

/**
 * Saves one scanned passport page under the passport number. pageNo = null puts it on the next empty
 * page; scanning a page that already exists replaces it (re-scan). Users: own record only.
 */
export async function savePassportPage(
  profileId: string,
  passportNumber: string,
  pageNo: number | null,
  form: FormData,
): Promise<{ ok?: true; pageNo?: number; error?: string }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const number = cleanNumber(passportNumber);
  if (!number) return { error: "Choose the passport first." };
  const file = form.get("page");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo or PDF of the page." };
  if (!DOC_TYPES.includes(file.type)) return { error: "Use a JPEG, PNG, WEBP or PDF file." };
  if (file.size > MAX_BYTES) return { error: "File is too large (max 8 MB)." };

  const sql = await getDb();
  let page = pageNo;
  if (page === null) {
    const used = await sql<{ pageNo: number }[]>`
      select page_no from passport_pages where profile_id = ${profileId} and passport_number = ${number}`;
    const taken = new Set(used.map((u) => u.pageNo));
    page = Array.from({ length: PASSPORT_PAGES }, (_, i) => i + 1).find((n) => !taken.has(n)) ?? null;
    if (page === null) return { error: `All ${PASSPORT_PAGES} pages of ${number} are already saved.` };
  }
  if (!Number.isInteger(page) || page < 1 || page > PASSPORT_PAGES) return { error: "Page number must be 1 to 64." };

  const row = {
    profileId,
    passportNumber: number,
    pageNo: page,
    fileName: file.name.slice(0, 120) || `page-${page}`,
    mime: file.type,
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  };
  await sql`
    insert into passport_pages ${sql(row)}
    on conflict (profile_id, passport_number, page_no) do update
      set file_name = excluded.file_name, mime = excluded.mime, size = excluded.size, data = excluded.data, created_at = now()`;
  await sql`update profiles set updated_at = now() where id = ${profileId}`;
  refresh();
  return { ok: true, pageNo: page };
}

/** Removes one page (admins only, like other deletes; a restore point is saved first). */
export async function deletePassportPage(pageId: string) {
  const session = await requireAdmin();
  if (!isUuid(pageId)) return;
  const sql = await getDb();
  const [p] = await sql<{ passportNumber: string; pageNo: number }[]>`select passport_number, page_no from passport_pages where id = ${pageId}`;
  if (!p) return;
  await saveRestorePoint(sql, { passportPageId: pageId }, `Deleted page ${p.pageNo} of passport ${p.passportNumber}`, session.email);
  await sql`delete from passport_pages where id = ${pageId}`;
  await flash(`Page ${p.pageNo} of ${p.passportNumber} deleted successfully`);
  refresh();
}
