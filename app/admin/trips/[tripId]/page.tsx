import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getProfile, getTrip } from "@/lib/data";
import { updateTrip } from "@/lib/actions";
import { TripForm } from "@/components/TripForm";

export default function EditTripPage({ params }: PageProps<"/admin/trips/[tripId]">) {
  return (
    <Suspense fallback={<div className="panel h-72 animate-pulse" />}>
      <EditTrip params={params} />
    </Suspense>
  );
}

async function EditTrip({ params }: { params: PageProps<"/admin/trips/[tripId]">["params"] }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  await requireAdmin();
  const profile = await getProfile(trip.profileId);
  const passports = profile
    ? [profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/admin/profiles/${trip.profileId}#trips`} className="text-sm text-ink-soft hover:text-ink">
        ← Back to {profile?.fullName ?? "profile"}
      </Link>
      <h1 className="font-serif text-3xl font-bold text-navy">Edit trip</h1>
      <div className="panel p-6 sm:p-8">
        <TripForm action={updateTrip.bind(null, trip.id)} trip={trip} passports={passports} submitLabel="Save trip" />
      </div>
    </div>
  );
}
