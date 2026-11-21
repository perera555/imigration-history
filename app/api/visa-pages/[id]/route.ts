import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/** Shows one extra visa page / photo. Only the record's owner and admins can open it. */
export async function GET(request: Request, ctx: RouteContext<"/api/visa-pages/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to view visa pages.", { status: 401 });

  const sql = await getDb();
  const [doc] = await sql<{ profileId: string; fileName: string; mime: string; data: Buffer }[]>`
    select v.profile_id, p.file_name, p.mime, p.data
    from visa_pages p join visas v on v.id = p.visa_id
    where p.id = ${id}`;
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
