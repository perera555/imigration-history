import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getDb } from "@/lib/db";
import { getProfile, isUuid } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";

/** All scanned pages of one passport as a PDF (one page per A4 sheet). ?passport=<passport number> */
export async function GET(request: Request, ctx: RouteContext<"/api/profiles/[id]/passport-pdf">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  if (!canAccessProfile(session, id)) return new Response("Forbidden", { status: 403 });
  const passport = (new URL(request.url).searchParams.get("passport") ?? "").trim().toUpperCase();
  if (!passport) return new Response("Choose a passport.", { status: 400 });

  const [profile, sql] = await Promise.all([getProfile(id), getDb()]);
  if (!profile) return new Response("Not found", { status: 404 });
  const pages = await sql<{ pageNo: number; mime: string; data: Buffer }[]>`
    select page_no, mime, data from passport_pages
    where profile_id = ${id} and passport_number = ${passport} order by page_no`;
  const images = pages.filter((p) => p.mime === "image/png" || p.mime === "image/jpeg");
  const other = pages.length - images.length;

  const buffer = await renderToBuffer(
    <Document title={`Passport ${passport} - ${profile.fullName}`} author={profile.fullName}>
      <Page size="A4" style={{ padding: 40, fontFamily: "Helvetica", fontSize: 11, color: "#0f1b2d" }}>
        <Text style={{ fontSize: 8, letterSpacing: 2, color: "#b08d3c" }}>PASSPORT PAGES</Text>
        <Text style={{ fontSize: 22, fontFamily: "Times-Bold", color: "#0b1f3a", marginTop: 4 }}>{passport}</Text>
        <Text style={{ marginTop: 6 }}>{profile.fullName}</Text>
        <Text style={{ marginTop: 14, color: "#5b6577" }}>
          {pages.length} page{pages.length === 1 ? "" : "s"} saved: {pages.map((p) => p.pageNo).join(", ") || "none"}
        </Text>
        {other > 0 && (
          <Text style={{ marginTop: 6, color: "#5b6577" }}>
            {other} page{other === 1 ? " is a PDF or WEBP file and is" : "s are PDF or WEBP files and are"} not shown here; open them in the app.
          </Text>
        )}
      </Page>
      {images.map((p) => (
        <Page key={p.pageNo} size="A4" style={{ padding: 30, fontFamily: "Helvetica" }}>
          <Text style={{ fontSize: 9, color: "#5b6577", marginBottom: 8 }}>
            {passport} · Page {p.pageNo}
          </Text>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={`data:${p.mime};base64,${Buffer.from(p.data).toString("base64")}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </View>
        </Page>
      ))}
    </Document>,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Passport-${passport}-pages.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
