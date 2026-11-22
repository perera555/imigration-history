"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid, PASSPORT_PAGES } from "./data";
import { canAccessProfile, requireAdmin, requireAuth, requireProfileAccess } from "./session";

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

/** Keeps the original whole-passport PDF under the passport number (replaces an earlier one). */
export async function savePassportDocument(profileId: string, passportNumber: string, form: FormData): Promise<{ ok?: true; error?: string }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const number = cleanNumber(passportNumber);
  const file = form.get("document");
  if (!number || !(file instanceof File) || file.size === 0) return { error: "Choose the passport PDF." };
  if (file.type !== "application/pdf") return { error: "The whole passport must be a PDF file." };
  if (file.size > MAX_BYTES) return { error: "The PDF is too large to keep (max 8 MB); the pages are saved." };
  const sql = await getDb();
  const row = { profileId, passportNumber: number, fileName: file.name.slice(0, 120) || `passport-${number}.pdf`, mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) };
  await sql`
    insert into passport_documents ${sql(row)}
    on conflict (profile_id, passport_number) do update
      set file_name = excluded.file_name, mime = excluded.mime, size = excluded.size, data = excluded.data, created_at = now()`;
  refresh();
  return { ok: true };
}

const MAX_PDF = 60 * 1024 * 1024;
const MAX_CHUNK = 3_600_000;

/**
 * Saves a whole-passport PDF (all pages in one file) under the passport number, sent in parts so big
 * scans fit the hosting's upload limit. Part 0 starts (or replaces) the file; later parts are appended;
 * the file shows up once the last part arrives. Users: own record only.
 */
export async function uploadPassportPdfPart(
  profileId: string,
  passportNumber: string,
  meta: { fileName: string; size: number; pageCount: number | null },
  index: number,
  total: number,
  form: FormData,
): Promise<{ ok?: true; error?: string }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const number = cleanNumber(passportNumber);
  const part = form.get("part");
  if (!number) return { error: "Choose the passport first." };
  if (!(part instanceof Blob) || part.size === 0 || part.size > MAX_CHUNK) return { error: "Upload part is missing or too large." };
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || index >= total) return { error: "Bad upload part." };
  if (meta.size > MAX_PDF) return { error: "The PDF is too large (max 60 MB)." };
  const bytes = Buffer.from(await part.arrayBuffer());
  const last = index === total - 1;
  const sql = await getDb();
  if (index === 0) {
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return { error: "This file is not a PDF." };
    const row = {
      profileId,
      passportNumber: number,
      fileName: String(meta.fileName || `passport-${number}.pdf`).slice(0, 120),
      mime: "application/pdf",
      size: Math.max(0, Math.round(meta.size)),
      pageCount: meta.pageCount && meta.pageCount > 0 ? Math.min(Math.round(meta.pageCount), 500) : null,
      data: bytes,
      complete: last,
    };
    await sql`
      insert into passport_documents ${sql(row)}
      on conflict (profile_id, passport_number) do update
        set file_name = excluded.file_name, mime = excluded.mime, size = excluded.size, page_count = excluded.page_count,
            data = excluded.data, complete = excluded.complete, created_at = now()`;
  } else {
    const rows = await sql`
      update passport_documents set data = data || ${bytes}, complete = ${last}
      where profile_id = ${profileId} and passport_number = ${number} and not complete
        and octet_length(data) + ${bytes.length} <= ${MAX_PDF}
      returning id`;
    if (!rows.length) return { error: "Upload was interrupted. Please upload the PDF again." };
  }
  if (last) {
    await sql`update profiles set updated_at = now() where id = ${profileId}`;
    await flash(`Passport ${number} PDF saved successfully${meta.pageCount ? ` (${meta.pageCount} pages)` : ""}`);
    refresh();
  }
  return { ok: true };
}

/** Removes a passport PDF (the record's owner or an admin; a restore point is saved first). */
export async function deletePassportPdf(documentId: string) {
  const session = await requireAuth();
  if (!isUuid(documentId)) return;
  const sql = await getDb();
  const [d] = await sql<{ passportNumber: string; profileId: string }[]>`select passport_number, profile_id from passport_documents where id = ${documentId}`;
  if (!d || !canAccessProfile(session, d.profileId)) return;
  await saveRestorePoint(sql, { passportDocumentId: documentId }, `Deleted the PDF of passport ${d.passportNumber}`, session.email);
  await sql`delete from passport_documents where id = ${documentId}`;
  await flash(`Passport ${d.passportNumber} PDF deleted successfully`);
  refresh();
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
