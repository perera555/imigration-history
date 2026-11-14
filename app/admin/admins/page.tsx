import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { deleteAdmin, setAdminPassword } from "@/lib/actions";
import { ConfirmButton } from "@/components/SubmitButton";
import { AddAdminForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
        ← Admin panel
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Access</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Admins</h1>
        <p className="mt-1 text-ink-soft">Everyone listed here can sign in, view and edit all records.</p>
      </div>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <AdminList />
      </Suspense>
      <section className="panel p-6 sm:p-8">
        <h2 className="mb-5 font-serif text-xl font-bold text-navy">Add an admin</h2>
        <AddAdminForm />
      </section>
    </div>
  );
}

async function AdminList() {
  const session = await requireAuth();
  const sql = await getDb();
  const admins = await sql<{ id: string; email: string; name: string; createdAt: Date }[]>`
    select id, email, name, created_at from admins order by created_at`;

  return (
    <div className="panel divide-y divide-line">
      {admins.map((a) => {
        const isMe = a.id === session.adminId;
        return (
          <div key={a.id} className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-navy font-semibold text-gold-soft">
                {(a.name || a.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.name || "Admin"} {isMe && <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs text-navy">You</span>}
                </p>
                <p className="truncate text-sm text-ink-soft">{a.email}</p>
              </div>
              {!isMe && admins.length > 1 && (
                <form action={deleteAdmin.bind(null, a.id)}>
                  <ConfirmButton message={`Remove ${a.email} as an admin?`} className="btn btn-danger py-1.5!">
                    Remove
                  </ConfirmButton>
                </form>
              )}
            </div>
            <details className="group rounded-xl bg-paper/60 px-4 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-navy-2">
                {isMe ? "Change my password" : "Reset this admin's password"}
              </summary>
              <div className="pt-3">
                <PasswordForm action={setAdminPassword.bind(null, a.id)} />
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
