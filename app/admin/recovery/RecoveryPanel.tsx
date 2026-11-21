"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreRows } from "@/lib/backup-actions";

type Line = { table: string; row: Record<string, unknown> };
type Result = Record<string, { added: number; skipped: number }>;

/** Download a backup / restore missing records from one. */
export function RecoveryPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function restore() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a backup file first.");
    setError("");
    setResult(null);
    let lines: string[];
    try {
      lines = (await file.text()).split("\n").filter((l) => l.trim());
      const head = JSON.parse(lines[0]);
      if (head.backup !== "immigration-history") throw new Error();
    } catch {
      return setError("This is not a backup file from this app.");
    }
    const rows: Line[] = lines.slice(1).map((l) => JSON.parse(l));
    if (!confirm(`Restore from this backup (${rows.length} records)? Records that already exist are kept as they are; only missing ones are added back.`)) return;

    setBusy(true);
    const out: Result = {};
    try {
      // Keep the backup's table order (parents first). Small batches keep each request under the upload limit.
      const tables = [...new Set(rows.map((r) => r.table))];
      let done = 0;
      for (const table of tables) {
        const list = rows.filter((r) => r.table === table).map((r) => r.row);
        out[table] = { added: 0, skipped: 0 };
        let batch: Record<string, unknown>[] = [];
        let size = 0;
        const send = async () => {
          if (!batch.length) return;
          const r = await restoreRows(table, batch);
          if (r.error) throw new Error(r.error);
          out[table].added += r.added;
          out[table].skipped += r.skipped;
          done += batch.length;
          setProgress(`Restoring… ${done} of ${rows.length}`);
          batch = [];
          size = 0;
        };
        for (const row of list) {
          const s = JSON.stringify(row).length;
          if (batch.length && (size + s > 3_000_000 || batch.length >= 100)) await send();
          batch.push(row);
          size += s;
        }
        await send();
      }
      setResult(out);
      router.refresh();
    } catch (e) {
      setError(`Restore stopped: ${e instanceof Error ? e.message : "no answer from the server"}. Records restored so far are kept; you can run it again.`);
      setResult(out);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <>
      <section className="panel space-y-3 p-6 sm:p-8">
        <h2 className="font-serif text-xl font-bold text-navy">1. Download a full backup</h2>
        <p className="text-sm text-ink-soft">
          Every travel card, immigration record, visa, boarding pass, uploaded document and account, in one file. Do this regularly, for example once a month.
        </p>
        <a href="/api/admin/backup" className="btn btn-primary inline-flex">
          ⬇ Download full backup
        </a>
      </section>

      <section className="panel space-y-3 p-6 sm:p-8">
        <h2 className="font-serif text-xl font-bold text-navy">2. Restore from a backup</h2>
        <p className="text-sm text-ink-soft">
          Choose a backup file. Anything missing (deleted travellers, visits, visas, boarding passes, documents, accounts) is added back.
          Nothing that exists now is changed or duplicated.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,application/x-ndjson"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <button type="button" onClick={restore} disabled={busy} className="btn btn-gold">
            {busy ? "Restoring…" : "🛟 Restore missing records"}
          </button>
        </div>
        {progress && <p className="text-sm font-medium text-navy-2">{progress}</p>}
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        {result && (
          <ul className="space-y-1 text-sm">
            {Object.entries(result).map(([t, r]) => (
              <li key={t}>
                <b>{t.replace("_", " ")}</b>: {r.added} restored, {r.skipped} already there
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
