import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProfile, getTrips, getVisas } from "@/lib/data";
import { connection } from "next/server";
import { ProfileDetail, ProfileSkeleton } from "@/components/ProfileDetail";

export default function ProfilePage({ params }: PageProps<"/profiles/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileView params={params} />
    </Suspense>
  );
}

async function ProfileView({ params }: { params: PageProps<"/profiles/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const [profile, trips, visas] = await Promise.all([getProfile(id), getTrips(id), getVisas(id)]);
  if (!profile) notFound();
  return <ProfileDetail profile={profile} trips={trips} visas={visas} showBack />;
}
