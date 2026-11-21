import { renderToBuffer } from "@react-pdf/renderer";
import { boardingTrips, getBoardingPasses, getProfile, getTrips, isUuid } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canAccessProfile, getSession } from "@/lib/session";
import { SingleBoardingPassPdf } from "@/lib/pdf/BoardingPassPdf";

/** One boarding pass as a real-size PDF (203 x 83 mm). Owner and admins only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/boarding/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in to download boarding passes.", { status: 401 });

  const sql = await getDb();
  const [row] = await sql<{ profileId: string }[]>`select profile_id from boarding_passes where id = ${id}`;
  if (!row) return new Response("Not found", { status: 404 });
  if (!canAccessProfile(session, row.profileId)) return new Response("Forbidden", { status: 403 });

  const [profile, passes, trips] = await Promise.all([getProfile(row.profileId), getBoardingPasses(row.profileId), getTrips(row.profileId)]);
  const pass = passes.find((p) => p.id === id);
  if (!profile || !pass) return new Response("Not found", { status: 404 });
  const tripLabel = pass.tripId ? (boardingTrips(trips).find((t) => t.id === pass.tripId)?.label ?? null) : null;

  const buffer = await renderToBuffer(<SingleBoardingPassPdf pass={pass} passenger={profile.fullName} tripLabel={tripLabel} />);
  const name = `Boarding-pass-${pass.flightNumber ?? "flight"}-${pass.flightDate ?? ""}.pdf`.replace(/[^\w.\-]+/g, "-");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
