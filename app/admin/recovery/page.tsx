import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { listRestorePoints, recordCounts } from "@/lib/backup-actions";
import { RecoveryPanel } from "./RecoveryPanel";
import { RestorePoints } from "./RestorePoints";

export const metadata: Metadata = { title: "Backup & recovery" };

const LABELS: Record<string, string> = {
  profiles: "Travellers (travel cards)",
  trips: "Immigration record visits",
  stays: "Hotels & Airbnb stays",
  visas: "Visas",
  visa_documents: "Visa documents",
  visa_pages: "Extra visa pages (photos)",
  boarding_passes: "Boarding passes",
  passport_pages: "Passport pages (scans)",
  passport_documents: "Whole-passport PDFs",
  admins: "Accounts (admins & users)",
};

export default function RecoveryPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
        ← Admin panel
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Safety</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Backup &amp; recovery</h1>
        <p className="mt-1 text-ink-soft">
          Download a full copy of every record and document. If something is deleted or lost, restore it from that file.
        </p>
      </div>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <Counts />
      </Suspense>
      <Suspense fallback={<div className="panel h-48 animate-pulse" />}>
        <Points />
      </Suspense>
      <h2 className="pt-2 font-serif text-xl font-bold text-navy">Backup files (keep a copy outside the app)</h2>
      <RecoveryPanel />
      <section className="panel space-y-2 p-6 text-sm text-ink-soft sm:p-8">
        <h2 className="font-serif text-xl font-bold text-navy">If the whole database is lost</h2>
        <p>
          The live database (Neon) also keeps its own history. In the Neon dashboard, open the project, then <b>Branches → Restore</b> to
          bring the database back to an earlier time (the free plan keeps about 1 day; paid plans keep longer).
        </p>
        <p>Keep your downloaded backup files somewhere safe (for example Google Drive). They contain personal details and documents.</p>
      </section>
    </div>
  );
}

async function Points() {
  return <RestorePoints points={await listRestorePoints()} />;
}

async function Counts() {
  const counts = await recordCounts();
  return (
    <section className="panel p-6 sm:p-8">
      <h2 className="mb-4 font-serif text-xl font-bold text-navy">Records now</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(counts).map(([t, n]) => (
          <div key={t} className="rounded-xl bg-paper/60 px-4 py-3">
            <p className="text-2xl font-bold text-navy">{n}</p>
            <p className="text-sm text-ink-soft">{LABELS[t] ?? t}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
