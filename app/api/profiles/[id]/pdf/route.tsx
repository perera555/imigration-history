import { renderToBuffer } from "@react-pdf/renderer";
import { getProfile, getTrips } from "@/lib/data";
import { flagPng } from "@/lib/countries";
import { ImmigrationPdf } from "@/lib/pdf/ImmigrationPdf";

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

export async function GET(_request: Request, ctx: RouteContext<"/api/profiles/[id]/pdf">) {
  const { id } = await ctx.params;
  const [profile, trips] = await Promise.all([getProfile(id), getTrips(id)]);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const codes = [...new Set(trips.map((t) => t.countryCode))];
  const flags = Object.fromEntries(await Promise.all(codes.map(async (c) => [c, await loadFlag(c)] as const)));

  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const buffer = await renderToBuffer(
    <ImmigrationPdf profile={profile} trips={trips} flags={flags} generatedOn={generatedOn} />,
  );

  const fileName = `Immigration-History-${profile.fullName.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
