"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { isUuid } from "./data";
import { isCountryCode, NATIONALITIES } from "./countries";
import { requireAdmin, requireProfileAccess } from "./session";
import type { VisaDetails } from "./visa-reader";

const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const text = (form: FormData, key: string, max = 200) => {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

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

export type VisaSaveState = { error?: string; ok?: string } | undefined;

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
  const stayDays = stayRaw ? Number(stayRaw) : null;
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
    notes: text(form, "notes", 1000),
    countriesTravelled: [
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
  if (!visaId && values.visaNumber) {
    const dup = await sql`select 1 from visas where profile_id = ${profileId} and visa_number = ${values.visaNumber}`;
    if (dup.length) return { error: `Visa ${values.visaNumber} is already in this record.` };
  }

  await sql.begin(async (tx) => {
    let id = visaId;
    if (id) {
      const rows = await tx`update visas set ${tx(values)}, updated_at = now() where id = ${id} and profile_id = ${profileId} returning id`;
      if (!rows.length) throw new Error("Visa not found.");
    } else {
      const [row] = await tx<{ id: string }[]>`insert into visas ${tx({ ...values, profileId })} returning id`;
      id = row.id;
    }
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
  refresh();
  return { ok: visaId ? "Visa updated." : "Visa added." };
}

/** Deleting is admin-only, like trips. */
export async function deleteVisa(visaId: string) {
  await requireAdmin();
  if (!isUuid(visaId)) return;
  const sql = await getDb();
  await sql`delete from visas where id = ${visaId}`;
  refresh();
}
