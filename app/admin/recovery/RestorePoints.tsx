"use client";

import { useState, useTransition } from "react";
import { createRestorePoint, deleteRestorePoint, restoreFromPoint, type RestorePointInfo } from "@/lib/backup-actions";
import { useToastOn } from "@/components/Toaster";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Saved restore points: get records back at any time with one click. */
export function RestorePoints({ points }: { points: RestorePointInfo[] }) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  useToastOn(null, msg.error);

  const run = (id: string | null, fn: () => Promise<{ ok?: string; error?: string } | undefined | void>) => {
    setBusyId(id);
    setMsg({});
    start(async () => {
      try {
        const r = await fn();
        if (r) setMsg(r);
      } catch {
        setMsg({ error: "No answer from the server. Please try again." });
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <section className="panel space-y-4 p-6 sm:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-navy">Restore points</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Saved automatically before every delete and every record save, and once a day. Choose one and press Restore to get the records back.
          </p>
        </div>
        <button type="button" disabled={pending} onClick={() => run("new", createRestorePoint)} className="btn btn-primary ml-auto">
          {busyId === "new" ? "Saving…" : "📌 Create restore point now"}
        </button>
      </div>
      {msg.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-ok">✓ {msg.ok}</p>}
      {msg.error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-danger">{msg.error}</p>}

      {points.length === 0 ? (
        <p className="text-sm text-ink-soft">No restore points yet. Press &ldquo;Create restore point now&rdquo; to make the first one.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {points.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">
                  {p.reason}
                  {p.kind === "full" && <span className="ml-2 rounded-full bg-navy px-2 py-0.5 text-[10px] text-gold-soft">Everything</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  {when(p.createdAt)} · {p.records} record{p.records === 1 ? "" : "s"} · {kb(p.size)}
                  {p.createdBy && ` · by ${p.createdBy}`}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Bring back what is missing from "${p.reason}"?\n\nRecords that exist now are not changed.`))
                    run(p.id, () => restoreFromPoint(p.id, "missing"));
                }}
                className="btn btn-gold !px-3 !py-1.5 text-xs"
              >
                {busyId === p.id ? "Restoring…" : "🛟 Restore missing"}
              </button>
              <button
                type="button"
                disabled={pending}
                title="Also undo later edits: records go back to exactly how they were at this time"
                onClick={() => {
                  if (
                    confirm(
                      `Put the records back exactly as they were at ${when(p.createdAt)}?\n\nLater edits to these records are undone. A restore point of the current state is saved first, so this can be undone too.`,
                    )
                  )
                    run(p.id, () => restoreFromPoint(p.id, "exact"));
                }}
                className="btn btn-ghost !px-3 !py-1.5 text-xs"
              >
                ↩ Put back exactly
              </button>
              <a href={`/api/admin/restore-points/${p.id}`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                ⬇ Download
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm("Delete this restore point?") && run(null, () => deleteRestorePoint(p.id))}
                className="btn btn-danger !px-3 !py-1.5 text-xs"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
