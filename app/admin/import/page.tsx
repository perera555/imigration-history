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
        ← Admin panel
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Automatic entry</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Import from a document</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Upload a PDF or photo. Personal details and every trip are read automatically into the form below, so you
          can check and correct them before saving.
        </p>
      </div>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <ImportLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ImportLoader({ searchParams }: { searchParams: PageProps<"/admin/import">["searchParams"] }) {
  await requireAuth();
  const [{ profile }, profiles] = await Promise.all([searchParams, listProfiles()]);
  const wanted = typeof profile === "string" ? profile : "";
  const defaultTarget = profiles.some((p) => p.id === wanted) ? wanted : "new";
  return (
    <DocumentImport profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))} defaultTarget={defaultTarget} />
  );
}
