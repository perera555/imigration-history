import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";
import { listProfiles } from "@/lib/data";
import { deleteProfile, logout } from "@/lib/actions";
import { ConfirmButton } from "@/components/SubmitButton";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Admin panel</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Manage records</h1>
          <p className="mt-1 text-ink-soft">Add travellers, update personal details and enter trips manually.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/admin/guide" className="btn btn-ghost">
            How to use
          </Link>
          <Link href="/admin/admins" className="btn btn-ghost">
            Admins & users
          </Link>
          <Link href="/admin/import" className="btn btn-primary">
            + New travel record
          </Link>
          <form action={logout}>
            <button className="btn btn-danger">Sign out</button>
          </form>
        </div>
      </div>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <ProfileTable />
      </Suspense>
    </div>
  );
}

async function ProfileTable() {
  await requireAdmin();
  const profiles = await listProfiles();
  if (!profiles.length) {
    return <div className="panel p-10 text-center text-ink-soft">No profiles yet — create one to get started.</div>;
  }
  return (
    <div className="panel divide-y divide-line">
      {profiles.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-paper-2">
            {p.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.fullName}</p>
            <p className="text-sm text-ink-soft">
              <span className="font-mono">{p.passportNumber ?? "No passport"}</span> · {p.tripCount} trips ·{" "}
              {p.countryCount} countries
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/profiles/${p.id}`} className="btn btn-ghost">
              View
            </Link>
            <a href={`/api/profiles/${p.id}/pdf?view=1`} target="_blank" rel="noopener" className="btn btn-ghost">
              View PDF
            </a>
            <Link href={`/admin/profiles/${p.id}`} className="btn btn-primary">
              Edit
            </Link>
            <form action={deleteProfile.bind(null, p.id)}>
              <ConfirmButton message={`Delete ${p.fullName} and all trips? This cannot be undone.`}>Delete</ConfirmButton>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
