"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { requireAdmin } from "./session";
import { flash } from "./flash";
import {
  BACKUP_TABLES,
  parseBackup,
  restoreRow,
  saveRestorePoint,
  unpackRestorePoint,
  type BackupTable,
  type RestoreCount,
  type RestoreMode,
} from "./backup";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const mode = (m: string): RestoreMode => (m === "exact" ? "exact" : "missing");

/** Restores one batch of rows from an uploaded backup file. Admins only. */
export async function restoreRows(
  table: string,
  rows: Record<string, unknown>[],
  how: string = "missing",
): Promise<RestoreCount & { error?: string }> {
  await requireAdmin();
  const out: RestoreCount = { added: 0, updated: 0, skipped: 0 };
  if (!(BACKUP_TABLES as readonly string[]).includes(table)) return { ...out, skipped: rows.length, error: `Unknown table ${table}` };
  const sql = await getDb();
  for (const raw of rows.slice(0, 200)) {
    try {
      out[await restoreRow(sql, table as BackupTable, raw, mode(how))]++;
    } catch (error) {
      // e.g. a trip whose traveller no longer exists: skip it, keep going.
      console.error(`Restore ${table} row failed:`, error);
      out.skipped++;
    }
  }
  return out;
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

export type RestorePointInfo = { id: string; createdAt: string; reason: string; kind: string; createdBy: string; records: number; size: number };

export async function listRestorePoints(): Promise<RestorePointInfo[]> {
  await requireAdmin();
  const sql = await getDb();
  const rows = await sql<(Omit<RestorePointInfo, "createdAt"> & { createdAt: Date })[]>`
    select id, created_at, reason, kind, created_by, records, size from restore_points order by created_at desc`;
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export type PointState = { ok?: string; error?: string } | undefined;

/** "Create restore point now": a full copy of every record. */
export async function createRestorePoint(): Promise<PointState> {
  const session = await requireAdmin();
  const sql = await getDb();
  try {
    await saveRestorePoint(sql, { all: true }, "Created on request", session.email);
  } catch (error) {
    console.error("Restore point failed:", error);
    return { error: "Couldn't create the restore point. Please try again." };
  }
  await flash("Restore point created successfully");
  refresh();
  return { ok: "Restore point created." };
}

/** Restores everything in a restore point. */
export async function restoreFromPoint(id: string, how: string): Promise<PointState> {
  await requireAdmin();
  if (!isUuid(id)) return { error: "Unknown restore point." };
  const sql = await getDb();
  const [p] = await sql<{ data: Buffer; reason: string }[]>`select data, reason from restore_points where id = ${id}`;
  if (!p) return { error: "That restore point no longer exists." };
  const m = mode(how);
  // Save the current state first, so this restore can itself be undone.
  if (m === "exact") await saveRestorePoint(sql, { all: true }, `Before restoring "${p.reason}"`);
  const count: RestoreCount = { added: 0, updated: 0, skipped: 0 };
  for (const { table, row } of parseBackup(unpackRestorePoint(p.data))) {
    if (!(BACKUP_TABLES as readonly string[]).includes(table)) continue;
    try {
      count[await restoreRow(sql, table, row, m)]++;
    } catch (error) {
      console.error(`Restore ${table} row failed:`, error);
      count.skipped++;
    }
  }
  await flash(`Records restored successfully (${count.added} brought back)`);
  refresh();
  return {
    ok: `Restored: ${count.added} brought back${m === "exact" ? `, ${count.updated} put back to the saved version` : ""}, ${count.skipped} already there.`,
  };
}

export async function deleteRestorePoint(id: string) {
  await requireAdmin();
  if (!isUuid(id)) return;
  const sql = await getDb();
  await sql`delete from restore_points where id = ${id}`;
  await flash("Restore point deleted successfully");
  refresh();
}
