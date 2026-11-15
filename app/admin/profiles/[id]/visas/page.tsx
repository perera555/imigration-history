import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireProfileAccess } from "@/lib/session";
import { getProfile, getTrips, getVisas } from "@/lib/data";
import { TravelCard } from "@/components/TravelCard";
import { VisaList } from "@/components/VisaList";
import { VisaManager } from "@/components/VisaManager";
import { JumpNav } from "@/components/JumpNav";
import { HashScroll } from "@/components/HashScroll";

export const metadata: Metadata = { title: "Visas" };

/** Separate Visas page (opened from the account menu and the admin panel list). Owner and admins. */
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={isAdmin ? "/admin" : "/account"} className="text-sm text-ink-soft hover:text-ink">
          ← {isAdmin ? "Admin panel" : "My account"}
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/api/profiles/${id}/pdf?only=visas&view=1`} target="_blank" rel="noopener" className="btn btn-ghost">
            👁 View visas PDF
          </a>
          <a href={`/api/profiles/${id}/pdf?only=visas`} className="btn btn-gold">
            ⬇ Download visas PDF
          </a>
          <a href={`/api/profiles/${id}/pdf?view=1`} target="_blank" rel="noopener" className="btn btn-ghost" title="Travel card, immigration history and visas">
            📄 Full PDF
          </a>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Visa page</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Visas · {profile.fullName}</h1>
        <JumpNav
          items={[
            { id: "holder", label: "🪪 Visa holder" },
            { id: "held", label: "🛂 Visas held" },
            { id: "visas", label: "✏️ Add / update visas", primary: true },
          ]}
        />
      </div>

      <div id="holder">
        <TravelCard profile={profile} title="Visa Holder" />
      </div>

      <div id="held">
        <VisaList
          profileId={id}
          holder={profile}
          visas={visas}
          trips={trips}
          canViewDocument
          editPage="visas"
          emptyHint="No visas yet. Add your first visa below."
        />
      </div>

      <section id="visas" className="panel p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Add / update visas</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Visa details</h2>
        <p className="mb-5 mt-1 text-sm text-ink-soft">
          Upload a visa (e-Visa PDF, or a photo of a paper visa) and press <b>Read details from document</b> to fill the
          form, or type the details in. Every saved visa is shown below filled in, ready to change.
        </p>
        <VisaManager
          profileId={id}
          visas={visas}
          passports={[profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p)}
          defaultPassport={profile.passportNumber}
          canDelete={isAdmin}
          expanded
        />
      </section>
      <HashScroll />
    </div>
  );
}
