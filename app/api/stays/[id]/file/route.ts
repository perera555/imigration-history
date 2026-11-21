import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/** Shows a stay's booking confirmation (photo / PDF). Only the record's owner and admins can open it. */
export async function GET(request: Request, ctx: RouteContext<"/api/stays/[id]/file">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to view this file.", { status: 401 });

  const sql = await getDb();
  const [doc] = await sql<{ profileId: string; fileName: string | null; mime: string | null; data: Buffer | null }[]>`
    select profile_id, file_name, mime, data from stays where id = ${id}`;
  if (!doc?.data) return new Response("Not found", { status: 404 });
  if (!canAccessProfile(session, doc.profileId)) return new Response("Forbidden", { status: 403 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = (doc.fileName ?? "booking").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
