import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/** Shows a boarding pass file. Only the record's owner and admins can open it. */
export async function GET(request: Request, ctx: RouteContext<"/api/boarding/[id]/file">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to view boarding passes.", { status: 401 });

  const sql = await getDb();
  const [row] = await sql<{ profileId: string; fileName: string | null; mime: string | null; data: Buffer | null }[]>`
    select profile_id, file_name, mime, data from boarding_passes where id = ${id}`;
  if (!row?.data || !row.mime) return new Response("Not found", { status: 404 });
  if (!canAccessProfile(session, row.profileId)) return new Response("Forbidden", { status: 403 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const name = (row.fileName ?? "boarding-pass").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
