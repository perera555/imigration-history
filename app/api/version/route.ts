/** Version of the live app; compared by the browser to offer "Update now". */
export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
