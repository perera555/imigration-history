import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { AccountMenu } from "./AccountMenu";

/** Signed-in account chip for the header (rendered inside <Suspense>, since it reads the session cookie). */
export async function HeaderAccount() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null; // database unavailable: show the signed-out state rather than breaking every page
  }

  if (!session) {
    return (
      <span className="flex items-center gap-1.5">
        <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
          Sign in
        </Link>
        <Link href="/register" className="rounded-full border border-gold-soft/60 px-3.5 py-1.5 text-sm font-semibold text-gold-soft hover:bg-white/10">
          Create account
        </Link>
      </span>
    );
  }

  let photo: string | null = null;
  if (session.profileId) {
    const sql = await getDb();
    const [row] = await sql<{ photo: string | null }[]>`select photo from profiles where id = ${session.profileId}`;
    photo = row?.photo ?? null;
  }
  const label = session.name || session.email.split("@")[0];

  return (
    <AccountMenu
      name={label}
      email={session.email}
      role={session.role}
      photo={photo}
      profileId={session.profileId}
    />
  );
}
