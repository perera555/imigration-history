import Link from "next/link";
import type { Metadata } from "next";
import { createProfile } from "@/lib/actions";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "New profile" };

export default function NewProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
        ← Admin
      </Link>
      <h1 className="font-serif text-3xl font-bold text-navy">New traveller profile</h1>
      <div className="panel p-6 sm:p-8">
        <ProfileForm action={createProfile} submitLabel="Create profile" />
      </div>
    </div>
  );
}
