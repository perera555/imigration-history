import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireProfileAccess } from "@/lib/session";
import { getProfile, getTrips, getVisas, travelStats } from "@/lib/data";
import { HistoryTable, StatsBar } from "@/components/HistoryTable";
import { PdfButtons } from "@/components/PdfButtons";
import { VisaList } from "@/components/VisaList";
import { VisaManager } from "@/components/VisaManager";
import { UpdateButton } from "@/components/UpdateButton";
import { TravelCard } from "@/components/TravelCard";

export const metadata: Metadata = { title: "Visas" };

/** Separate Visas page for a record (owner and admins). */
export default function VisasPage({ params }: PageProps<"/admin/profiles/[id]/visas">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <Visas params={params} />
    </Suspense>
  );
}

async function Visas({ params }: { params: PageProps<"/admin/profiles/[id]/visas">["params"] }) {
  const { id } = await params;
  const session = await requireProfileAccess(id);
  const [profile, trips, visas] = await Promise.all([getProfile(id), getTrips(id), getVisas(id)]);
  if (!profile) notFound();
  const isAdmin = session.role === "admin";
  const passports = [profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={isAdmin ? `/admin/profiles/${id}` : "/account"} className="text-sm text-ink-soft hover:text-ink">
          ← {isAdmin ? "Back to record" : "My account"}
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <UpdateButton profileId={id} className="btn btn-ghost" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Visa section</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Visas · {profile.fullName}</h1>
      </div>

      {/* Holder details, taken from the travel card */}
      <TravelCard profile={profile} title="Visa Holder" />

      <VisaList profileId={id} holder={profile} visas={visas} trips={trips} canViewDocument emptyHint="No visas yet. Add your first visa below." />

      {/* The same person's immigration record, handy when applying for a visa */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Immigration record</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Previous immigration history</h2>
            <p className="mt-1 text-sm text-ink-soft">Travel history of the visa holder, as asked for in most visa applications.</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <PdfButtons profileId={id} />
          </div>
        </div>
        <StatsBar stats={travelStats(trips)} />
        <HistoryTable trips={trips} />
      </section>

      <section id="visas" className="panel p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Add / update visas</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Visa details</h2>
        <p className="mb-5 mt-1 text-sm text-ink-soft">
          Upload a visa (e-Visa PDF, or a photo of a paper visa) and press <b>Read details from document</b> to fill the
          form, or type the details in. The document is saved with the visa.
        </p>
        <VisaManager
          profileId={id}
          visas={visas}
          passports={passports}
          defaultPassport={profile.passportNumber}
          canDelete={isAdmin}
        />
      </section>
    </div>
  );
}
