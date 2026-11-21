import "server-only";
import { cookies } from "next/headers";

export const FLASH_COOKIE = "flash";

/**
 * Pop-up message shown once on the next screen (also after a redirect), e.g.
 * "Signed in as …", "Record saved", "Record deleted successfully".
 */
export async function flash(message: string, tone: "ok" | "info" | "error" = "ok") {
  try {
    (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ message, tone })), {
      path: "/",
      maxAge: 60,
      sameSite: "lax",
      httpOnly: false, // read (and removed) by the Toaster in the browser
    });
  } catch {
    /* outside a request that can set cookies: no pop-up */
  }
}
