import { getDb } from "@/lib/db";
import { saveRestorePoint } from "@/lib/backup";

/** Daily automatic full restore point (Vercel Cron, see vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const sql = await getDb();
  await saveRestorePoint(sql, { all: true }, "Daily automatic restore point", "automatic");
  return Response.json({ ok: true });
}
