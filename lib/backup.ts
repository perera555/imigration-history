import "server-only";
import postgres from "postgres";
import { gzipSync, gunzipSync } from "node:zlib";

type Sql = postgres.Sql | postgres.TransactionSql;

/** Tables in a backup, in restore order (parents before children). */
export const BACKUP_TABLES = ["profiles", "trips", "visas", "visa_documents", "visa_pages", "boarding_passes", "admins"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Primary key used to find rows that already exist when restoring. */
export const PRIMARY_KEY: Record<BackupTable, string> = {
  profiles: "id",
  trips: "id",
  visas: "id",
  visa_documents: "visa_id",
  visa_pages: "id",
  boarding_passes: "id",
  admins: "id",
};

/** Links that a delete sets to null (e.g. a boarding pass loses its trip); restoring puts them back. */
const RELINK: Partial<Record<BackupTable, string>> = { boarding_passes: "trip_id", admins: "profile_id" };

/** Never rolled back by "put back exactly", so nobody gets locked out by an old password. */
const KEEP_CURRENT = new Set(["password_hash"]);

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

export const backupHeader = (exportedAt = new Date().toISOString(), extra: Record<string, unknown> = {}) =>
  JSON.stringify({ backup: "immigration-history", version: 1, exportedAt, tables: BACKUP_TABLES, ...extra });

export type RestoreMode = "missing" | "exact";
export type RestoreCount = { added: number; updated: number; skipped: number };

/**
 * Puts one backed-up row into the database.
 * - "missing": adds it only if it no longer exists (existing data is not changed).
 * - "exact":   also puts existing rows back to the backed-up values (undo edits).
 */
export async function restoreRow(sql: Sql, table: BackupTable, raw: Record<string, unknown>, mode: RestoreMode) {
  const row = decodeRow(raw);
  const pk = PRIMARY_KEY[table];
  const cols = Object.keys(row).map((c) => postgres.fromCamel(c));
  if (!cols.every((c) => /^[a-z_][a-z0-9_]*$/.test(c))) throw new Error("Bad column name in backup.");
  if (!cols.includes(pk)) throw new Error("Backup row has no id.");
  let set: string[];
  if (mode === "exact") set = cols.filter((c) => c !== pk && !KEEP_CURRENT.has(c)).map((c) => `"${c}" = excluded."${c}"`);
  else {
    const link = RELINK[table];
    set = link && cols.includes(link) ? [`"${link}" = coalesce(${table}."${link}", excluded."${link}")`] : [];
  }
  const conflict = set.length ? `do update set ${set.join(", ")}` : "do nothing";
  const res = await sql`
    insert into ${sql(table)} ${sql(row)}
    on conflict (${sql(pk)}) ${sql.unsafe(conflict)}
    returning (xmax = 0) as inserted`;
  if (!res.length) return "skipped" as const;
  return res[0].inserted ? ("added" as const) : mode === "exact" ? ("updated" as const) : ("skipped" as const);
}

/** Which records a restore point covers. */
export type Scope =
  | { all: true }
  | { profileId: string }
  | { profileRecord: string }
  | { tripIds: string[] }
  | { visaId: string }
  | { visaPageId: string }
  | { passId: string }
  | { adminId: string };

function scopeQueries(sql: Sql, s: Scope): [BackupTable, Promise<Record<string, unknown>[]>][] {
  const all = (t: BackupTable) => sql`select * from ${sql(t)}`;
  if ("all" in s) return BACKUP_TABLES.map((t) => [t, all(t)]);
  if ("profileId" in s) {
    const id = s.profileId;
    return [
      ["profiles", sql`select * from profiles where id = ${id}`],
      ["trips", sql`select * from trips where profile_id = ${id}`],
      ["visas", sql`select * from visas where profile_id = ${id}`],
      ["visa_documents", sql`select * from visa_documents where visa_id in (select id from visas where profile_id = ${id})`],
      ["visa_pages", sql`select * from visa_pages where visa_id in (select id from visas where profile_id = ${id})`],
      ["boarding_passes", sql`select * from boarding_passes where profile_id = ${id}`],
      ["admins", sql`select * from admins where profile_id = ${id}`], // to re-link the account
    ];
  }
  if ("profileRecord" in s)
    // Card details + visits only (small; saved before every record save).
    return [
      ["profiles", sql`select * from profiles where id = ${s.profileRecord}`],
      ["trips", sql`select * from trips where profile_id = ${s.profileRecord}`],
    ];
  if ("tripIds" in s) {
    if (!s.tripIds.length) return [];
    return [
      ["trips", sql`select * from trips where id in ${sql(s.tripIds)}`],
      ["boarding_passes", sql`select * from boarding_passes where trip_id in ${sql(s.tripIds)}`],
    ];
  }
  if ("visaId" in s)
    return [
      ["visas", sql`select * from visas where id = ${s.visaId}`],
      ["visa_documents", sql`select * from visa_documents where visa_id = ${s.visaId}`],
      ["visa_pages", sql`select * from visa_pages where visa_id = ${s.visaId}`],
    ];
  if ("visaPageId" in s) return [["visa_pages", sql`select * from visa_pages where id = ${s.visaPageId}`]];
  if ("passId" in s) return [["boarding_passes", sql`select * from boarding_passes where id = ${s.passId}`]];
  return [["admins", sql`select * from admins where id = ${s.adminId}`]];
}

/** Builds a backup (JSON lines) of the given records. */
export async function buildBackup(sql: Sql, scope: Scope, extra: Record<string, unknown> = {}) {
  const lines = [backupHeader(undefined, extra)];
  let records = 0;
  for (const [table, q] of scopeQueries(sql, scope)) {
    for (const r of await q) {
      lines.push(JSON.stringify({ table, row: encodeRow(r) }));
      records++;
    }
  }
  return { text: lines.join("\n") + "\n", records };
}

const KEEP_POINTS = 100;

/**
 * Saves a restore point inside the database (compressed). Called automatically before
 * every delete, daily, and when an admin presses "Create restore point now".
 */
export async function saveRestorePoint(sql: Sql, scope: Scope, reason: string, by = "") {
  const { text, records } = await buildBackup(sql, scope, { reason });
  if (!records) return;
  const data = gzipSync(Buffer.from(text, "utf8"));
  await sql`
    insert into restore_points (reason, kind, created_by, records, size, data)
    values (${reason}, ${"all" in scope ? "full" : "partial"}, ${by}, ${records}, ${data.length}, ${data})`;
  await sql`
    delete from restore_points where id not in (
      select id from restore_points order by created_at desc limit ${KEEP_POINTS})`;
}

export function unpackRestorePoint(data: Buffer) {
  return gunzipSync(data).toString("utf8");
}

/** Parses backup text (JSON lines) into rows, checking it is one of ours. */
export function parseBackup(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  const head = JSON.parse(lines[0] ?? "{}");
  if (head.backup !== "immigration-history") throw new Error("Not a backup from this app.");
  return lines.slice(1).map((l) => JSON.parse(l) as { table: BackupTable; row: Record<string, unknown> });
}
