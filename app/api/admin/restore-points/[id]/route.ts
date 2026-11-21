import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { unpackRestorePoint } from "@/lib/backup";

/** Downloads one restore point as a backup file (same format as the full backup). Admins only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/restore-points/[id]">) {
  const session = await getSession();
  if (!session || session.role !== "admin") return new Response("Admins only.", { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const sql = await getDb();
  const [p] = await sql<{ data: Buffer; createdAt: Date }[]>`select data, created_at from restore_points where id = ${id}`;
  if (!p) return new Response("Not found", { status: 404 });
  const stamp = p.createdAt.toISOString().slice(0, 16).replace(":", "-");
  return new Response(unpackRestorePoint(p.data), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="restore-point-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
