import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireProfileAccess } from "@/lib/session";
import { getProfile, getTrips, getVisas } from "@/lib/data";
import { VisaManager } from "@/components/VisaManager";
import { VisaList } from "@/components/VisaList";
import { RecordForm } from "@/components/RecordForm";

export const metadata: Metadata = { title: "Update record" };

/** Update button target: one form pre-filled with everything from the database. */
export default function UpdateRecordPage({ params, searchParams }: PageProps<"/admin/profiles/[id]/update">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <UpdateRecord params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const SAVED_TEXT: Record<string, string> = {
  card: "Travel card saved to the database.",
  record: "Immigration record saved to the database.",
  all: "Travel card and immigration record saved to the database.",
};

async function UpdateRecord({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/profiles/[id]/update">["params"];
  searchParams: PageProps<"/admin/profiles/[id]/update">["searchParams"];
}) {
  const { id } = await params;
  const session = await requireProfileAccess(id);
  const [profile, trips, visas, query] = await Promise.all([getProfile(id), getTrips(id), getVisas(id), searchParams]);
  if (!profile) notFound();
  const back = session.role === "admin" ? `/admin/profiles/${id}` : "/account";
  const saved = typeof query.saved === "string" ? SAVED_TEXT[query.saved] : undefined;
  const merged = Number(query.merged) || 0;

  return (
    <div className="space-y-6">
      <Link href={back} className="text-sm text-ink-soft hover:text-ink">
        ← Back
      </Link>
      {saved && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900">
          ✓ {saved} The page now shows the latest data ({trips.length} visits).
          {merged > 0 && ` ${merged} duplicate row${merged === 1 ? " was" : "s were"} merged.`}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Update record</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">{profile.fullName}</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Everything saved for this record is filled in below. Change any detail, add or remove visits, then save the
          travel card, the immigration record, or both with <b>Save / Update record</b>.
        </p>
      </div>
      <RecordForm
        // Remount with fresh database data after every save.
        key={`${profile.updatedAt.toISOString()}-${trips.length}-${trips.map((t) => t.id).join(",").length}`}
        target={id}
        updateId={id}
        saveLabel="Save / Update record"
        initialProfile={{
          fullName: profile.fullName,
          dateOfBirth: profile.dateOfBirth,
          sex: profile.sex,
          nationality: profile.nationality,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          passportNumber: profile.passportNumber,
          nationalId: profile.nationalId,
          passportIssueDate: profile.passportIssueDate,
          passportExpiryDate: profile.passportExpiryDate,
          previousPassports: profile.previousPassports,
          photo: profile.photo,
        }}
        initialTrips={trips.map((t) => ({
          id: t.id,
          countryCode: t.countryCode,
          city: t.city,
          departureDate: t.departureDate,
          returnDate: t.returnDate,
          purpose: t.purpose,
          passportNumber: t.passportNumber,
          notes: t.notes,
        }))}
      />
      {/* Visas: added and edited here, under the immigration record */}
      <section id="visas" className="panel scroll-mt-24 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Visas</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Add / edit visas</h2>
        <p className="mb-5 mt-1 text-sm text-ink-soft">
          Upload a visa (e-Visa PDF, or a photo of a paper visa) and press <b>Read details from document</b> to fill the
          form, or type the details in. Every saved visa is shown below with all its details, ready to change; press <b>Save visa</b> on the one you changed.
        </p>
        <VisaManager
          profileId={id}
          visas={visas}
          passports={[profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p)}
          defaultPassport={profile.passportNumber}
          canDelete={session.role === "admin"}
          expanded
        />
      </section>

      <VisaList profileId={id} holder={profile} visas={visas} trips={trips} canViewDocument />
    </div>
  );
}
