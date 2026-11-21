import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfileAccess } from "@/lib/session";
import { getProfile, getTrips, getVisas, getBoardingPasses, boardingTrips } from "@/lib/data";
import { VisaList } from "@/components/VisaList";
import { BoardingPassSection } from "@/components/BoardingPassSection";
import { ProfileEditor } from "@/components/ProfileEditor";
import { PdfButtons } from "@/components/PdfButtons";
import { UpdateButton } from "@/components/UpdateButton";

export default function EditProfilePage({ params }: PageProps<"/admin/profiles/[id]">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <EditProfile params={params} />
    </Suspense>
  );
}

async function EditProfile({ params }: { params: PageProps<"/admin/profiles/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireProfileAccess(id);
  const [profile, trips, visas, passes] = await Promise.all([getProfile(id), getTrips(id), getVisas(id), getBoardingPasses(id)]);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={session.role === "admin" ? "/admin" : "/account"} className="text-sm text-ink-soft hover:text-ink">
          ← {session.role === "admin" ? "Admin panel" : "My account"}
        </Link>
        <Link href={`/profiles/${profile.id}`} className="btn btn-ghost ml-auto">
          View card & history
        </Link>
        <UpdateButton profileId={profile.id} />
        <PdfButtons profileId={profile.id} />
      </div>
      <h1 className="font-serif text-3xl font-bold text-navy">{profile.fullName}</h1>
      <ProfileEditor profile={profile} trips={trips} visas={visas} canDelete={session.role === "admin"} />
      <VisaList profileId={profile.id} holder={profile} visas={visas} trips={trips} canViewDocument />
      <BoardingPassSection profileId={profile.id} passes={passes} trips={boardingTrips(trips)} canDelete={session.role === "admin"} />
    </div>
  );
}
