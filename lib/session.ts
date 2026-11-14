import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { SESSION_COOKIE, signSession, readSessionToken, type SessionPayload } from "./session-token";

const REMEMBER_AGE = 60 * 60 * 24 * 30; // "Remember me": 30 days
const SHORT_AGE = 60 * 60 * 12; // otherwise: 12 hours, cookie cleared when the browser closes

export type Account = SessionPayload & { role: "admin" | "user"; profileId: string | null; name: string };

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

/** Verifies the cookie AND loads the account (role, linked profile) from the database. */
export async function getSession(): Promise<Account | null> {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const sql = await getDb();
  const [row] = await sql<{ role: string; profileId: string | null; name: string; email: string }[]>`
    select role, profile_id, name, email from admins where id = ${session.adminId}`;
  if (!row) return null;
  return {
    adminId: session.adminId,
    email: row.email,
    name: row.name,
    role: row.role === "user" ? "user" : "admin",
    profileId: row.profileId,
  };
}

/** Any signed-in account (admin or user). */
export async function requireAuth(): Promise<Account> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Admins only; signed-out visitors go to the admin sign-in, users to their own account page. */
export async function requireAdmin(): Promise<Account> {
  const session = await getSession();
  if (!session) redirect("/login?as=admin");
  if (session.role !== "admin") redirect("/account");
  return session;
}

/** Admins can open any profile; users only their own. */
export async function requireProfileAccess(profileId: string): Promise<Account> {
  const session = await requireAuth();
  if (session.role !== "admin" && session.profileId !== profileId) redirect("/account");
  return session;
}

export function canAccessProfile(session: Account, profileId: string) {
  return session.role === "admin" || session.profileId === profileId;
}
