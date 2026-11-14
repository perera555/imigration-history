import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/session";
import { getProfile, getTrips, formatShortDate, tripDuration } from "@/lib/data";
import { countryName } from "@/lib/countries";
import { addTrip, deleteTrip, updateProfile } from "@/lib/actions";
import { ProfileForm } from "@/components/ProfileForm";
import { TripForm } from "@/components/TripForm";
import { Flag } from "@/components/Flag";
import { ConfirmButton } from "@/components/SubmitButton";

export default function EditProfilePage({ params }: PageProps<"/admin/profiles/[id]">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <EditProfile params={params} />
    </Suspense>
  );
}

async function EditProfile({ params }: { params: PageProps<"/admin/profiles/[id]">["params"] }) {
  await requireAuth();
  const { id } = await params;
  const [profile, trips] = await Promise.all([getProfile(id), getTrips(id)]);
  if (!profile) notFound();

  const passports = [profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p);
  const newestFirst = [...trips].reverse();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
          ← Admin
        </Link>
        <Link href={`/profiles/${profile.id}`} className="btn btn-ghost ml-auto">
          View card & history
        </Link>
        <a href={`/api/profiles/${profile.id}/pdf`} className="btn btn-gold">
          Download PDF
        </a>
      </div>

      <section className="panel p-6 sm:p-8">
        <h1 className="mb-6 font-serif text-2xl font-bold text-navy">Personal details</h1>
        <ProfileForm action={updateProfile.bind(null, profile.id)} profile={profile} submitLabel="Save details" />
      </section>

      <section id="trips" className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-navy">Add a trip</h2>
            <p className="mb-6 mt-1 text-sm text-ink-soft">
              Enter each journey separately. Visit counts per country are calculated automatically.
            </p>
          </div>
          <Link href={`/admin/import?profile=${profile.id}`} className="btn btn-gold ml-auto">
            ⬆ Import trips from a document
          </Link>
        </div>
        <TripForm action={addTrip.bind(null, profile.id)} passports={passports} submitLabel="Add trip" />
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line px-6 py-4 font-serif text-xl font-bold text-navy">
          Recorded trips <span className="text-base font-normal text-ink-soft">({trips.length})</span>
        </h2>
        {!trips.length && <p className="px-6 py-8 text-center text-ink-soft">No trips yet.</p>}
        <ul className="divide-y divide-line">
          {newestFirst.map((trip) => (
            <li key={trip.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <Flag code={trip.countryCode} className="h-6 w-9" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {countryName(trip.countryCode)}
                  {trip.city && <span className="font-normal text-ink-soft"> · {trip.city}</span>}
                </p>
                <p className="text-sm text-ink-soft tabular-nums">
                  {formatShortDate(trip.departureDate)} → {formatShortDate(trip.returnDate)}
                  {tripDuration(trip) && ` · ${tripDuration(trip)}`} · {trip.purpose || "—"}
                  {trip.passportNumber && <span className="font-mono"> · {trip.passportNumber}</span>}
                </p>
              </div>
              <Link href={`/admin/trips/${trip.id}`} className="btn btn-ghost !py-1.5">
                Edit
              </Link>
              <form action={deleteTrip.bind(null, trip.id)}>
                <ConfirmButton message="Delete this trip?" className="btn btn-danger !py-1.5">
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
