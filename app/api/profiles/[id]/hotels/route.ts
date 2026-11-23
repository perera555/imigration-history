import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/**
 * Hotels / Airbnbs this record already has in a country (from its visits and its stays), with their
 * addresses: /api/profiles/{id}/hotels?country=TH. Suggestions only — any hotel can be typed in.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/profiles/[id]/hotels">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session || !canAccessProfile(session, id)) return new Response("Forbidden", { status: 403 });
  const country = (new URL(req.url).searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return Response.json({ hotels: [] });
  const sql = await getDb();
  const rows = await sql<{ name: string; address: string | null }[]>`
    select distinct on (lower(name)) name, address from (
      select trim(stayed_at) as name, nullif(trim(stayed_address), '') as address from trips
        where profile_id = ${id} and trim(country_code) = ${country} and coalesce(trim(stayed_at), '') <> ''
      union all
      select trim(name), nullif(trim(concat_ws(', ', nullif(address, ''), nullif(city, ''))), '') from stays
        where profile_id = ${id} and trim(country_code) = ${country} and coalesce(trim(name), '') <> ''
    ) h order by lower(name), address nulls last limit 50`;
  return Response.json({ hotels: rows }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
