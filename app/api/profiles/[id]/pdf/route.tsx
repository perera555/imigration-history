import { renderToBuffer } from "@react-pdf/renderer";
import { getProfile, getTrips, getVisas, getBoardingPasses, boardingTrips } from "@/lib/data";
import { getDb } from "@/lib/db";
import { flagPng, isSchengen } from "@/lib/countries";
import { ImmigrationPdf, type PdfBoardingPass } from "@/lib/pdf/ImmigrationPdf";

async function loadFlag(code: string): Promise<string | null> {
  try {
    const res = await fetch(flagPng(code, 80), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null; // the PDF still renders, just without that flag
  }
}

export async function GET(request: Request, ctx: RouteContext<"/api/profiles/[id]/pdf">) {
  // ?view=1 opens the PDF in the browser; otherwise it downloads.
  const url = new URL(request.url);
  const inline = url.searchParams.get("view") === "1";
  // ?parts=card,record,visas chooses what to include (default: all). ?only=visas = card + visas.
  const requested = (url.searchParams.get("parts") ?? "").split(",").map((p) => p.trim());
  const parts =
    url.searchParams.get("only") === "visas"
      ? { card: true, record: false, visas: true }
      : requested.some((p) => ["card", "record", "visas", "boarding"].includes(p))
        ? { card: requested.includes("card"), record: requested.includes("record"), visas: requested.includes("visas"), boarding: requested.includes("boarding") }
        : { card: true, record: true, visas: true, boarding: false };
  const only = parts.record ? undefined : "visas";
  const { id } = await ctx.params;
  const [profile, trips, visas, passes] = await Promise.all([getProfile(id), getTrips(id), getVisas(id), getBoardingPasses(id)]);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const codes = [
    ...new Set([
      ...(only ? [] : trips.map((t) => t.countryCode)),
      ...(only || !trips.some((t) => isSchengen(t.countryCode)) ? [] : ["EU"]),
      ...visas.map((v) => v.countryCode),
    ]),
  ];
  const flags = Object.fromEntries(await Promise.all(codes.map(async (c) => [c, await loadFlag(c)] as const)));

  // Boarding passes: embed photo uploads (PNG/JPEG) as images in the PDF.
  let boarding: PdfBoardingPass[] = [];
  if (parts.boarding) {
    const labels = new Map(boardingTrips(trips).map((t) => [t.id, t.label]));
    const sql = await getDb();
    const images = await sql<{ id: string; mime: string; data: Buffer }[]>`select id, mime, data from boarding_passes
      where profile_id = ${profile.id} and mime in ('image/png', 'image/jpeg') and data is not null`;
    const byId = new Map(images.map((r) => [r.id, `data:${r.mime};base64,${Buffer.from(r.data).toString("base64")}`]));
    boarding = passes.map((p) => ({ ...p, image: byId.get(p.id) ?? null, tripLabel: p.tripId ? (labels.get(p.tripId) ?? null) : null }));
  }

  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const buffer = await renderToBuffer(
    <ImmigrationPdf profile={profile} trips={trips} visas={visas} parts={parts} boarding={boarding} flags={flags} generatedOn={generatedOn} />,
  );

  const fileName = `${only ? "Visas" : "Immigration-History"}-${profile.fullName.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
