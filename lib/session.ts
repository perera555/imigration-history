import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { SESSION_COOKIE, signSession, readSessionToken, type SessionPayload } from "./session-token";

const REMEMBER_AGE = 60 * 60 * 24 * 30; // "Remember me": 30 days
const SHORT_AGE = 60 * 60 * 12; // otherwise: 12 hours, cookie cleared when the browser closes

export async function createSession(session: SessionPayload, remember = false) {
  const token = await signSession(session, remember ? REMEMBER_AGE : SHORT_AGE);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_AGE } : {}),
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Verifies the cookie AND that the admin still exists (removed admins lose access immediately). */
export async function getSession(): Promise<SessionPayload | null> {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const sql = await getDb();
  const rows = await sql`select 1 from admins where id = ${session.adminId}`;
  return rows.length ? session : null;
}

/** Call at the top of every Server Action / Route Handler that touches data. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
