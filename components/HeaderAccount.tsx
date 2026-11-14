import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { OnlineDot } from "./OnlineDot";

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
  const href = session.role === "admin" ? "/admin" : "/account";

  return (
    <Link
      href={href}
      title={session.role === "admin" ? "Admin panel" : "My account"}
      className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 py-1 pl-1 pr-3 hover:bg-white/10"
    >
      <span className="relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-8 rounded-full border border-gold-soft/60 object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold font-semibold text-navy">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <OnlineDot />
      </span>
      <span className="hidden text-left leading-tight sm:block">
        <span className="block max-w-32 truncate text-sm font-semibold text-white">{label}</span>
        <span className="block text-[10px] uppercase tracking-[0.15em] text-gold-soft/80">
          {session.role === "admin" ? "Admin" : "My account"}
        </span>
      </span>
    </Link>
  );
}
