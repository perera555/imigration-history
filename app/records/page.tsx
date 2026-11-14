import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Records" };

export default function RecordsPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Records</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-navy sm:text-4xl">Travellers</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Choose a traveller to view their travel identity card and full immigration history, or download it as a PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Link href="/register" className="btn btn-gold">
            + Add travel data
          </Link>
        </div>
      </section>
      <Suspense fallback={<GridSkeleton />}>
        <ProfileGrid />
      </Suspense>
    </div>
  );
}

async function ProfileGrid() {
  await connection();
  const profiles = await listProfiles();

  if (!profiles.length) {
    return (
      <div className="panel p-10 text-center">
        <p className="font-serif text-xl font-semibold text-navy">No records yet</p>
        <p className="mt-2 text-ink-soft">An admin can add travellers from the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((p) => (
        <Link
          key={p.id}
          href={`/profiles/${p.id}`}
          className="id-card group block rounded-3xl p-5 transition-transform hover:-translate-y-1"
        >
          <div className="relative z-10 flex items-center gap-4">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-gold-soft/60 bg-white/10">
              {p.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-semibold text-white">{p.fullName}</p>
              <p className="font-mono text-xs tracking-widest text-gold-soft/80">{p.passportNumber ?? "—"}</p>
              <p className="mt-2 text-xs text-white/70">
                {p.countryCount} countries · {p.tripCount} trips
              </p>
            </div>
          </div>
          <p className="relative z-10 mt-4 text-right text-xs font-semibold text-gold-soft group-hover:underline">
            View history →
          </p>
        </Link>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-3xl bg-navy/15" />
      ))}
    </div>
  );
}
