import "server-only";

/** Tables in a backup, in restore order (parents before children). */
export const BACKUP_TABLES = ["profiles", "trips", "visas", "visa_documents", "boarding_passes", "admins"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Primary key used to skip rows that already exist when restoring. */
export const PRIMARY_KEY: Record<BackupTable, string> = {
  profiles: "id",
  trips: "id",
  visas: "id",
  visa_documents: "visa_id",
  boarding_passes: "id",
  admins: "id",
};

/** Binary columns (documents) are written to the backup as { "$b64": "..." }. */
export function encodeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (Buffer.isBuffer(v)) out[k] = { $b64: v.toString("base64") };
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

export function decodeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "$b64" in (v as object)) {
      out[k] = Buffer.from(String((v as { $b64: string }).$b64), "base64");
    } else out[k] = v;
  }
  return out;
}
