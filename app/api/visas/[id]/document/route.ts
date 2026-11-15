import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/** Shows a visa's uploaded document. Only the record's owner and admins can open it. */
export async function GET(request: Request, ctx: RouteContext<"/api/visas/[id]/document">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to view visa documents.", { status: 401 });

  const sql = await getDb();
  const [doc] = await sql<{ profileId: string; fileName: string; mime: string; data: Buffer }[]>`
    select v.profile_id, d.file_name, d.mime, d.data
    from visa_documents d join visas v on v.id = d.visa_id
    where d.visa_id = ${id}`;
  if (!doc) return new Response("Not found", { status: 404 });
  if (!canAccessProfile(session, doc.profileId)) return new Response("Forbidden", { status: 403 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
