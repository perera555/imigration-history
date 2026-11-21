"use server";

import { getDb } from "./db";
import { requireAdmin } from "./session";
import { BACKUP_TABLES, PRIMARY_KEY, decodeRow, type BackupTable } from "./backup";

/**
 * Restores one batch of rows from a backup. Rows that already exist (same id) are left
 * untouched, so restoring never overwrites or duplicates current data. Admins only.
 */
export async function restoreRows(table: string, rows: Record<string, unknown>[]): Promise<{ added: number; skipped: number; error?: string }> {
  await requireAdmin();
  if (!(BACKUP_TABLES as readonly string[]).includes(table)) return { added: 0, skipped: rows.length, error: `Unknown table ${table}` };
  const t = table as BackupTable;
  const sql = await getDb();
  let added = 0;
  let skipped = 0;
  for (const raw of rows.slice(0, 200)) {
    const row = decodeRow(raw);
    try {
      // `on conflict do nothing` covers both the primary key and unique emails (admins).
      const res = await sql`insert into ${sql(t)} ${sql(row)} on conflict do nothing returning ${sql(PRIMARY_KEY[t])}`;
      if (res.length) added++;
      else skipped++;
    } catch (error) {
      // e.g. a trip whose traveller no longer exists: skip it, keep going.
      console.error(`Restore ${t} row failed:`, error);
      skipped++;
    }
  }
  return { added, skipped };
}

/** Current number of records per table (shown on the recovery page). */
export async function recordCounts(): Promise<Record<string, number>> {
  await requireAdmin();
  const sql = await getDb();
  const out: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    const [{ count }] = await sql.unsafe(`select count(*)::int as count from ${t}`);
    out[t] = Number(count);
  }
  return out;
}
