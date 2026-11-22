"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid } from "./data";
import { isCountryCode, NATIONALITIES } from "./countries";
import { canAccessProfile, requireAdmin, requireAuth, requireProfileAccess } from "./session";
import type { VisaDetails } from "./visa-reader";

const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const text = (form: FormData, key: string, max = 200) => {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/** Days from Travel from to Travel to, both included (24 May → 22 Jul = 60). */
function stayFromDates(from: string | null, to: string | null): number | null {
  if (!from || !to || !isDate(from) || !isDate(to)) return null;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return days >= 1 && days <= 3650 ? days : null;
}

export type VisaReadState = { error: string } | { ok: true; details: VisaDetails; note?: string } | undefined;

/** "Read details" button: fills the visa form from an uploaded visa document. */
export async function readVisaDocument(profileId: string, form: FormData): Promise<VisaReadState> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const file = form.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the visa document first." };
  if (!DOC_TYPES.includes(file.type)) return { error: "Upload a PDF, PNG, JPG or WEBP file." };
  if (file.size > MAX_DOC_BYTES) return { error: "File is too large (max 8 MB)." };
  const bytes = Buffer.from(await file.arrayBuffer());

  const sql = await getDb();
  const [p] = await sql<{ nationality: string | null }[]>`select nationality from profiles where id = ${profileId}`;
  const holder = NATIONALITIES.find((n) => n.name.toLowerCase() === (p?.nationality ?? "").toLowerCase())?.code ?? null;

  if (file.type === "application/pdf") {
    try {
      const { readVisaPdf } = await import("./visa-reader");
      const details = await readVisaPdf(new Uint8Array(bytes), holder);
      if (details && Object.values(details).some((v) => v !== null)) {
        return { ok: true, details, note: "Details read from the PDF. Please check them before saving." };
      }
    } catch (error) {
      console.error("Visa PDF reading failed:", error);
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { extractVisa } = await import("./extract");
      const d = await extractVisa(bytes, file.type);
      return { ok: true, details: { ...d, countryCode: d.countryCode?.toUpperCase() ?? null }, note: "Details read from the document. Please check them before saving." };
    } catch (error) {
      console.error("Visa AI reading failed:", error);
    }
  }
  return {
    error:
      file.type === "application/pdf"
        ? "Couldn't find visa details in this PDF. The document is attached, so fill in the details below and save."
        : "Photos can't be read automatically on this server yet. The photo is attached, so fill in the details below and save.",
  };
}

export type VisaSaveState = { error?: string; ok?: string; id?: string } | undefined;

/** Checks an uploaded photo / PDF; returns an error message or null. */
function checkFile(file: FormDataEntryValue | null): file is File {
  return file instanceof File && file.size > 0 && DOC_TYPES.includes(file.type) && file.size <= MAX_DOC_BYTES;
}
const fileError = (file: FormDataEntryValue | null) =>
  !(file instanceof File) || file.size === 0
    ? "Choose a photo or PDF."
    : !DOC_TYPES.includes(file.type)
      ? "Use a JPEG, PNG, WEBP or PDF file."
      : "File is too large (max 8 MB).";

/** Adds one extra page / photo to a visa (visa page, entry stamp, …). Users: own record only. */
export async function addVisaPage(visaId: string, form: FormData): Promise<{ ok?: true; error?: string }> {
  if (!isUuid(visaId)) return { error: "Unknown visa." };
  const sql = await getDb();
  const [v] = await sql<{ profileId: string }[]>`select profile_id from visas where id = ${visaId}`;
  if (!v) return { error: "Unknown visa." };
  await requireProfileAccess(v.profileId);
  const file = form.get("page");
  if (!checkFile(file)) return { error: fileError(file) };
  await sql`insert into visa_pages ${sql({
    visaId,
    fileName: file.name.slice(0, 120) || "visa-page",
    mime: file.type,
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  })}`;
  await sql`update profiles set updated_at = now() where id = ${v.profileId}`;
  refresh();
  return { ok: true };
}

/**
 * Import from a multi-page PDF: reads every visa on one scanned page image with Claude AI.
 * Returns { ai: false } when AI reading isn't set up (no ANTHROPIC_API_KEY) so the browser uses free OCR.
 */
export async function readVisaPageImage(profileId: string, form: FormData): Promise<{ ai: false } | { ai: true; visas: VisaDetails[]; error?: string }> {
  if (!isUuid(profileId)) return { ai: false };
  await requireProfileAccess(profileId);
  if (!process.env.ANTHROPIC_API_KEY) return { ai: false };
  const file = form.get("page");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_DOC_BYTES || !file.type.startsWith("image/")) return { ai: true, visas: [], error: "Bad page image." };
  try {
    const { extractVisasOnPage } = await import("./extract");
    const visas = await extractVisasOnPage(Buffer.from(await file.arrayBuffer()), file.type);
    return {
      ai: true,
      visas: visas.map((v) => ({
        ...v,
        countryCode: v.countryCode && isCountryCode(v.countryCode.toUpperCase()) ? v.countryCode.toUpperCase() : null,
        visaNumber: v.visaNumber?.toUpperCase().replace(/\s+/g, "") ?? null,
        passportNumber: v.passportNumber?.toUpperCase().replace(/\s+/g, "") ?? null,
      })),
    };
  } catch (error) {
    console.error("Visa page AI reading failed:", error);
    return { ai: true, visas: [], error: "AI reading failed for this page." };
  }
}

/** Import from a multi-page PDF: reads the details on one visa page from its text (free, no AI). */
export async function readVisaPageText(profileId: string, text: string): Promise<VisaDetails | null> {
  if (!isUuid(profileId)) return null;
  await requireProfileAccess(profileId);
  const sql = await getDb();
  const [p] = await sql<{ nationality: string | null }[]>`select nationality from profiles where id = ${profileId}`;
  const holder = NATIONALITIES.find((n) => n.name.toLowerCase() === (p?.nationality ?? "").toLowerCase())?.code ?? null;
  const { parseVisaText } = await import("./visa-reader");
  return parseVisaText(String(text).slice(0, 20_000), holder);
}

/**
 * Import from a multi-page PDF: creates one visa from one page, with the details read from it and
 * the page image as its document. Skips a visa number that is already in the record.
 */
export async function addVisaFromPage(
  profileId: string,
  details: Partial<VisaDetails>,
  form: FormData,
): Promise<{ ok?: true; skipped?: string; error?: string }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const code = String(details.countryCode ?? "").toUpperCase();
  if (!isCountryCode(code)) return { error: "No country for this page." };
  const file = form.get("document");
  if (!checkFile(file)) return { error: fileError(file) };
  const d = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const values = {
    profileId,
    countryCode: code,
    visaType: s(details.visaType, 80) ?? "",
    visaFormat: s(details.visaFormat, 30),
    visaNumber: s(details.visaNumber, 40)?.toUpperCase() ?? null,
    issueDate: d(details.issueDate),
    expiryDate: d(details.expiryDate),
    travelFrom: d(details.travelFrom),
    travelTo: d(details.travelTo),
    purpose: s(details.purpose, 120),
    entries: s(details.entries, 20),
    stayDays:
      typeof details.stayDays === "number" && details.stayDays >= 0 && details.stayDays <= 3650
        ? Math.round(details.stayDays)
        : stayFromDates(d(details.travelFrom), d(details.travelTo)),
    issuedAt: s(details.issuedAt, 120),
    passportNumber: s(details.passportNumber, 30)?.toUpperCase() ?? null,
    notes: "Imported from a visa pages PDF. Please check the details.",
  };
  const sql = await getDb();
  // No duplicates: same visa number, or (without a number) same country with the same issue or expiry date.
  const dup = values.visaNumber
    ? ((await sameNumberExists(sql, profileId, values.visaNumber)) ? [1] : [])
    : values.issueDate || values.expiryDate
      ? await sql`select 1 from visas where profile_id = ${profileId} and trim(country_code) = ${code}
          and ((${values.issueDate}::date is not null and issue_date = ${values.issueDate}::date)
            or (${values.expiryDate}::date is not null and expiry_date = ${values.expiryDate}::date))`
      : [];
  if (dup.length) return { skipped: values.visaNumber ? `Visa ${values.visaNumber} is already in your record.` : "This visa is already in your record." };
  await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`insert into visas ${tx(values)} returning id`;
    await tx`insert into visa_documents ${tx({
      visaId: row.id,
      fileName: file.name.slice(0, 120) || "visa-page.jpg",
      mime: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    })}`;
    await tx`update profiles set updated_at = now() where id = ${profileId}`;
  });
  refresh();
  return { ok: true };
}

/** Removes one extra page (admins only, like other deletes; a restore point is saved first). */
export async function deleteVisaPage(pageId: string) {
  // The record's owner or an admin (a restore point is saved first).
  const session = await requireAuth();
  if (!isUuid(pageId)) return;
  const sql = await getDb();
  const [owner] = await sql<{ profileId: string }[]>`select v.profile_id from visa_pages p join visas v on v.id = p.visa_id where p.id = ${pageId}`;
  if (!owner || !canAccessProfile(session, owner.profileId)) return;
  await saveRestorePoint(sql, { visaPageId: pageId }, "Deleted a visa page photo", session.email);
  await sql`delete from visa_pages where id = ${pageId}`;
  await flash("Visa page removed successfully");
  refresh();
}

/** "Add several visa photos": makes one new visa for this country with the photo as its document. */
export async function addVisaFromPhoto(profileId: string, countryCode: string, visaType: string, form: FormData): Promise<{ ok?: true; error?: string }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const code = countryCode.toUpperCase();
  if (!isCountryCode(code)) return { error: "Unknown country." };
  const file = form.get("document");
  if (!checkFile(file)) return { error: fileError(file) };
  const sql = await getDb();
  await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into visas ${tx({ profileId, countryCode: code, visaType: visaType.slice(0, 80), notes: "Added from a photo, please fill in the details." })}
      returning id`;
    await tx`insert into visa_documents ${tx({
      visaId: row.id,
      fileName: file.name.slice(0, 120) || "visa",
      mime: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    })}`;
    await tx`update profiles set updated_at = now() where id = ${profileId}`;
  });
  refresh();
  return { ok: true };
}

/** Adds a visa (visaId = null) or updates one, with an optional document upload. Users: own record only. */
export async function saveVisa(profileId: string, visaId: string | null, _: VisaSaveState, form: FormData): Promise<VisaSaveState> {
  if (!isUuid(profileId) || (visaId && !isUuid(visaId))) return { error: "Unknown record." };
  await requireProfileAccess(profileId);

  const countryCode = text(form, "countryCode", 2)?.toUpperCase() ?? "";
  if (!isCountryCode(countryCode)) return { error: "Choose the country that issued the visa." };
  const issueDate = text(form, "issueDate", 10);
  const expiryDate = text(form, "expiryDate", 10);
  const travelFrom = text(form, "travelFrom", 10);
  const travelTo = text(form, "travelTo", 10);
  if (travelFrom && !isDate(travelFrom)) return { error: "Travel from date is not valid." };
  if (travelTo && !isDate(travelTo)) return { error: "Travel to date is not valid." };
  if (travelFrom && travelTo && travelTo < travelFrom) return { error: "Travel to can't be before travel from." };
  if (issueDate && !isDate(issueDate)) return { error: "Issue date is not valid." };
  if (expiryDate && !isDate(expiryDate)) return { error: "Expiry date is not valid." };
  if (issueDate && expiryDate && expiryDate < issueDate) return { error: "Expiry date can't be before the issue date." };
  const stayRaw = text(form, "stayDays", 4);
  // Empty stay: work it out from Travel from → Travel to (both days counted).
  const stayDays = stayRaw ? Number(stayRaw) : stayFromDates(travelFrom, travelTo);
  if (stayDays !== null && (!Number.isInteger(stayDays) || stayDays < 0 || stayDays > 3650)) return { error: "Stay must be a number of days." };

  const values = {
    countryCode,
    visaType: text(form, "visaType", 80) ?? "",
    visaFormat: text(form, "visaFormat", 30),
    visaNumber: text(form, "visaNumber", 40)?.toUpperCase() ?? null,
    issueDate,
    expiryDate,
    travelFrom,
    travelTo,
    purpose: text(form, "purpose", 120),
    entries: text(form, "entries", 20),
    stayDays,
    issuedAt: text(form, "issuedAt", 120),
    passportNumber: text(form, "passportNumber", 30)?.toUpperCase() ?? null,
    status: text(form, "status", 30),
    notes: text(form, "notes", 1000),    countriesTravelled: [
      ...new Set(
        form
          .getAll("countriesTravelled")
          .map((v) => String(v).trim().toUpperCase())
          .filter((v) => isCountryCode(v)),
      ),
    ].slice(0, 40),
  };

  const file = form.get("document");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!DOC_TYPES.includes(file.type)) return { error: "Document must be a PDF, PNG, JPG or WEBP file." };
    if (file.size > MAX_DOC_BYTES) return { error: "Document is too large (max 8 MB)." };
  }

  const sql = await getDb();
  // Same visa number for the same record = the same visa; don't add it twice.
  if (!visaId && values.visaNumber && (await sameNumberExists(sql, profileId, values.visaNumber))) {
    return { error: `Visa ${values.visaNumber} is already in this record.` };
  }

  let savedId = visaId;
  await sql.begin(async (tx) => {
    let id = visaId;
    if (id) {
      const rows = await tx`update visas set ${tx(values)}, updated_at = now() where id = ${id} and profile_id = ${profileId} returning id`;
      if (!rows.length) throw new Error("Visa not found.");
    } else {
      const [row] = await tx<{ id: string }[]>`insert into visas ${tx({ ...values, profileId })} returning id`;
      id = row.id;
    }
    savedId = id;
    if (hasFile) {
      const doc = {
        visaId: id,
        fileName: (file as File).name.slice(0, 120) || "visa",
        mime: (file as File).type,
        size: (file as File).size,
        data: Buffer.from(await (file as File).arrayBuffer()),
      };
      await tx`insert into visa_documents ${tx(doc)}
        on conflict (visa_id) do update set file_name = excluded.file_name, mime = excluded.mime,
          size = excluded.size, data = excluded.data, uploaded_at = now()`;
    } else if (form.get("removeDocument") === "on" && id) {
      await tx`delete from visa_documents where visa_id = ${id}`;
    }
    await tx`update profiles set updated_at = now() where id = ${profileId}`;
  });
  await flash(visaId ? "Visa saved successfully" : "Visa added successfully");
  refresh();
  return { ok: visaId ? "Visa updated." : "Visa added.", id: savedId ?? undefined };
}

/** A visa with this number (same digits, with or without a letter in front) is already in the record. */
async function sameNumberExists(sql: Awaited<ReturnType<typeof getDb>>, profileId: string, number: string) {
  const digits = number.replace(/[^0-9]/g, "").replace(/^0+/, "");
  const rows =
    digits.length >= 5
      ? await sql`select 1 from visas where profile_id = ${profileId}
          and ltrim(regexp_replace(coalesce(visa_number, ''), '[^0-9]', '', 'g'), '0') = ${digits}`
      : await sql`select 1 from visas where profile_id = ${profileId} and upper(visa_number) = ${number.toUpperCase()}`;
  return rows.length > 0;
}

/** Same visa? Same number (letters / leading zeros aside), or — without numbers — same country and dates. */
function visaKey(v: { countryCode: string; visaNumber: string | null; issueDate: string | null; expiryDate: string | null }) {
  const digits = (v.visaNumber ?? "").toUpperCase().replace(/[^0-9]/g, "").replace(/^0+/, "");
  if (digits.length >= 5) return `n:${digits}`;
  if (v.issueDate && v.expiryDate) return `d:${v.countryCode.trim()}|${v.issueDate}|${v.expiryDate}`;
  return null;
}

/**
 * Removes duplicate visas of a record automatically, keeping the most complete copy (with a document,
 * most details filled in, oldest). A restore point is saved before each removal.
 */
export async function removeDuplicateVisas(profileId: string): Promise<{ removed: number }> {
  if (!isUuid(profileId)) return { removed: 0 };
  const session = await requireProfileAccess(profileId);
  const sql = await getDb();
  const rows = await sql<
    { id: string; countryCode: string; visaNumber: string | null; issueDate: string | null; expiryDate: string | null; hasDoc: boolean; filled: number; createdAt: Date }[]
  >`
    select v.id, trim(v.country_code) as country_code, v.visa_number, v.issue_date, v.expiry_date,
      exists(select 1 from visa_documents d where d.visa_id = v.id) as has_doc,
      (case when v.visa_type <> '' then 1 else 0 end) + (v.visa_number is not null)::int + (v.issue_date is not null)::int
        + (v.expiry_date is not null)::int + (v.entries is not null)::int + (v.travel_from is not null)::int
        + (v.travel_to is not null)::int + (v.passport_number is not null)::int + (v.issued_at is not null)::int as filled,
      v.created_at
    from visas v where v.profile_id = ${profileId}`;
  type Row = (typeof rows)[number];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = visaKey(r);
    if (key) groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const [, ...extra] = [...list].sort(
      (a, b) => Number(b.hasDoc) - Number(a.hasDoc) || b.filled - a.filled || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const dup of extra) {
      await saveRestorePoint(sql, { visaId: dup.id }, "Removed a duplicate visa automatically", session.email);
      await sql`delete from visas where id = ${dup.id}`;
      removed++;
    }
  }
  if (removed) refresh();
  return { removed };
}

/** Deletes a visa with its document and pages: the record's owner or an admin (a restore point is saved first). */
export async function deleteVisa(visaId: string) {
  const session = await requireAuth();
  if (!isUuid(visaId)) return;
  const sql = await getDb();
  const [owner] = await sql<{ profileId: string }[]>`select profile_id from visas where id = ${visaId}`;
  if (!owner || !canAccessProfile(session, owner.profileId)) return;
  await saveRestorePoint(sql, { visaId }, "Deleted a visa (with its document)", session.email);
  await sql`delete from visas where id = ${visaId}`;
  await flash("Visa deleted successfully");
  refresh();
}
