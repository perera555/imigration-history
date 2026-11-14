import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/session";
import { listProfiles } from "@/lib/data";
import { DocumentImport } from "@/components/DocumentImport";

export const metadata: Metadata = { title: "Import from document" };

export default function ImportPage({ searchParams }: PageProps<"/admin/import">) {
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
        ← Back
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Travel record form</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Add travel card & immigration record</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Fill in the travel card and add each country with its visits, or upload a document to fill everything
          automatically. Then save once.
        </p>
      </div>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <ImportLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ImportLoader({ searchParams }: { searchParams: PageProps<"/admin/import">["searchParams"] }) {
  const session = await requireAuth();
  const isAdmin = session.role === "admin";
  const [{ profile }, all] = await Promise.all([searchParams, listProfiles()]);
  const profiles = isAdmin ? all : all.filter((p) => p.id === session.profileId);
  const wanted = typeof profile === "string" ? profile : "";
  const defaultTarget = profiles.some((p) => p.id === wanted)
    ? wanted
    : isAdmin
      ? "new"
      : (session.profileId ?? "");
  return (
    <DocumentImport
      profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
      defaultTarget={defaultTarget}
      allowNew={isAdmin}
    />
  );
}
