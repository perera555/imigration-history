import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireProfileAccess } from "@/lib/session";
import { getProfile, getTrips } from "@/lib/data";
import { RecordForm } from "@/components/RecordForm";

export const metadata: Metadata = { title: "Update record" };

/** Update button target: one form pre-filled with everything from the database. */
export default function UpdateRecordPage({ params }: PageProps<"/admin/profiles/[id]/update">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <UpdateRecord params={params} />
    </Suspense>
  );
}

async function UpdateRecord({ params }: { params: PageProps<"/admin/profiles/[id]/update">["params"] }) {
  const { id } = await params;
  const session = await requireProfileAccess(id);
  const [profile, trips] = await Promise.all([getProfile(id), getTrips(id)]);
  if (!profile) notFound();
  const back = session.role === "admin" ? `/admin/profiles/${id}` : "/account";

  return (
    <div className="space-y-6">
      <Link href={back} className="text-sm text-ink-soft hover:text-ink">
        ← Back
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Update record</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">{profile.fullName}</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Everything saved for this record is filled in below. Change any detail, add or remove visits, then press{" "}
          <b>Update record</b>.
        </p>
      </div>
      <RecordForm
        target={id}
        updateId={id}
        afterUpdateHref={session.role === "admin" ? `/admin/profiles/${id}?updated=1` : "/account?updated=1"}
        saveLabel="Update record"
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
    </div>
  );
}
