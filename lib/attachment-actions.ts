"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid } from "./data";
import { requireAdmin } from "./session";

export type AttachmentKind = "visa" | "boarding" | "stay";

/**
 * "🗑 Delete photo": removes only the uploaded photo / document and keeps the visa, boarding pass or
 * hotel stay itself. Admins only (like other deletes); a restore point is saved first.
 */
export async function deleteAttachment(kind: AttachmentKind, id: string): Promise<{ ok?: true; error?: string }> {
  const session = await requireAdmin();
  if (!isUuid(id)) return { error: "Unknown item." };
  const sql = await getDb();
  if (kind === "visa") {
    await saveRestorePoint(sql, { visaId: id }, "Deleted a visa photo / document", session.email);
    await sql`delete from visa_documents where visa_id = ${id}`;
  } else if (kind === "boarding") {
    await saveRestorePoint(sql, { passId: id }, "Deleted a boarding pass photo / file", session.email);
    await sql`update boarding_passes set data = null, file_name = null, mime = null, size = null, updated_at = now() where id = ${id}`;
  } else if (kind === "stay") {
    await saveRestorePoint(sql, { stayId: id }, "Deleted a hotel booking photo / file", session.email);
    await sql`update stays set data = null, file_name = null, mime = null, size = null, updated_at = now() where id = ${id}`;
  } else return { error: "Unknown item." };
  await flash("Photo deleted successfully");
  refresh();
  return { ok: true };
}
