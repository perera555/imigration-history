import { renderToBuffer } from "@react-pdf/renderer";
import { getProfile, getTrips, getVisas } from "@/lib/data";
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

export async function GET(request: Request, ctx: RouteContext<"/api/profiles/[id]/pdf">) {
  // ?view=1 opens the PDF in the browser; otherwise it downloads.
  const url = new URL(request.url);
  const inline = url.searchParams.get("view") === "1";
  // ?only=visas = travel card + visas only.
  const only = url.searchParams.get("only") === "visas" ? ("visas" as const) : undefined;
  const { id } = await ctx.params;
  const [profile, trips, visas] = await Promise.all([getProfile(id), getTrips(id), getVisas(id)]);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const codes = [...new Set([...(only ? [] : trips.map((t) => t.countryCode)), ...visas.map((v) => v.countryCode)])];
  const flags = Object.fromEntries(await Promise.all(codes.map(async (c) => [c, await loadFlag(c)] as const)));

  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const buffer = await renderToBuffer(
    <ImmigrationPdf profile={profile} trips={trips} visas={visas} only={only} flags={flags} generatedOn={generatedOn} />,
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
