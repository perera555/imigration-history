import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BACKUP_TABLES, backupHeader, encodeRow } from "@/lib/backup";

/**
 * Full backup of every record, admins only. Streamed as JSON lines:
 *   {"backup":"immigration-history","version":1,...}   (first line)
 *   {"table":"profiles","row":{...}}                    (one line per record)
 * Streaming keeps large backups (with documents) working on Vercel.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return new Response("Admins only.", { status: 403 });
  const sql = await getDb();
  const enc = new TextEncoder();
  const exportedAt = new Date().toISOString();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(enc.encode(backupHeader(exportedAt) + "\n"));
        for (const table of BACKUP_TABLES) {
          // Page through each table so memory stays small.
          let offset = 0;
          for (;;) {
            const rows = await sql`select * from ${sql(table)} order by 1 limit 20 offset ${offset}`;
            for (const r of rows) controller.enqueue(enc.encode(JSON.stringify({ table, row: encodeRow(r) }) + "\n"));
            if (rows.length < 20) break;
            offset += 20;
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="immigration-history-backup-${exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
