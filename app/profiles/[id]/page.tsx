import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProfile, getTrips, getVisas, getStays } from "@/lib/data";
import { canAccessProfile, getSession } from "@/lib/session";
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
  const [profile, trips, visas, session] = await Promise.all([getProfile(id), getTrips(id), getVisas(id), getSession()]);
  if (!profile) notFound();
  // Hotels / homes stayed are private: only the owner and admins see them.
  const stays = session && canAccessProfile(session, id) ? await getStays(id) : [];  return <ProfileDetail profile={profile} trips={trips} visas={visas} stays={stays} showBack />;
}
