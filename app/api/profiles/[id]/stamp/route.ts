import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/**
 * A short fingerprint of a record: changes whenever anything in it is added, edited or deleted
 * (by the user or by an admin). The page compares it and refreshes itself when it changes.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[id]/stamp">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session || !canAccessProfile(session, id)) return new Response("Forbidden", { status: 403 });
  const sql = await getDb();
  const [row] = await sql<{ stamp: string }[]>`
    select concat_ws('|',
      (select updated_at from profiles where id = ${id}),
      (select count(*) || ':' || coalesce(max(created_at)::text, '') from trips where profile_id = ${id}),
      (select count(*) || ':' || coalesce(max(updated_at)::text, '') from visas where profile_id = ${id}),
      (select count(*) || ':' || coalesce(max(updated_at)::text, '') from boarding_passes where profile_id = ${id}),
      (select count(*) || ':' || coalesce(max(updated_at)::text, '') from stays where profile_id = ${id}),
      (select count(*) || ':' || coalesce(max(created_at)::text, '') from passport_documents where profile_id = ${id} and complete),
      (select count(*) from visa_documents d join visas v on v.id = d.visa_id where v.profile_id = ${id}),
      (select count(*) from visa_pages p join visas v on v.id = p.visa_id where v.profile_id = ${id})
    ) as stamp`;
  return Response.json({ stamp: row?.stamp ?? "" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
