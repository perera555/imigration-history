import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { logoutToRegister } from "@/lib/actions";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}

async function Register() {
  // Already signed in: say so, instead of jumping away (e.g. an admin wanting to make a user account).
  const session = await getSession().catch(() => null);
  if (session) {
    const home = session.role === "admin" ? "/admin" : "/account";
    return (
      <div className="mx-auto max-w-lg space-y-5 py-6">
        <div className="panel space-y-4 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Create account</p>
          <h1 className="font-serif text-2xl font-bold text-navy">You are already signed in</h1>
          <p className="text-ink-soft">
            Signed in as <b>{session.name || session.email}</b> ({session.role === "admin" ? "admin" : "user"}). To create a new account, sign out first.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={logoutToRegister}>
              <button className="btn btn-gold">Sign out and create a new account</button>
            </form>
            <Link href={home} className="btn btn-ghost">
              {session.role === "admin" ? "Back to admin panel" : "Back to my account"}
            </Link>
          </div>
          {session.role === "admin" && (
            <p className="rounded-xl bg-paper/60 px-4 py-3 text-sm text-ink-soft">
              Admins can also create a user account for someone else without signing out:{" "}
              <Link href="/admin/admins" className="font-semibold text-navy-2 hover:underline">
                Admins &amp; users → Create account
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    );
  }
  return <RegisterForm />;
}
