import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/session";
import { getProfile, getTrips, travelStats } from "@/lib/data";
import { TravelCard } from "@/components/TravelCard";
import { HistoryTable, StatsBar } from "@/components/HistoryTable";
import { logout } from "@/lib/actions";
import { ProfileEditor } from "@/components/ProfileEditor";
import { PdfButtons } from "@/components/PdfButtons";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <Account searchParams={searchParams} />
    </Suspense>
  );
}

async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const session = await requireAuth();
  if (session.role === "admin") redirect("/admin");
  const { welcome } = await searchParams;
  const [profile, trips] = session.profileId
    ? await Promise.all([getProfile(session.profileId), getTrips(session.profileId)])
    : [null, []];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">My account</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Hello, {session.name || session.email}</h1>
          <p className="mt-1 text-ink-soft">Fill in your travel card and immigration record, then download your PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {profile && (
            <>
              <Link href={`/profiles/${profile.id}`} className="btn btn-ghost">
                View my card
              </Link>
              <PdfButtons profileId={profile.id} />
            </>
          )}
          <form action={logout}>
            <button className="btn btn-danger">Sign out</button>
          </form>
        </div>
      </div>

      {welcome && (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          Welcome! Your account is ready. Add your details and trips below, or fill them automatically from a document.
        </p>
      )}

      {profile ? (
        <>
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">My record</p>
            <TravelCard profile={profile} />
            <StatsBar stats={travelStats(trips)} />
          </section>
          <ProfileEditor profile={profile} trips={trips} isAdmin={false} />
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">My immigration record</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Previous immigration history</h2>
            </div>
            <HistoryTable trips={trips} />
          </section>
        </>
      ) : (
        <div className="panel p-10 text-center text-ink-soft">
          Your account isn&apos;t linked to a travel record yet. Please contact an admin.
        </div>
      )}

      <section className="panel p-6 sm:p-8">
        <h2 className="mb-4 font-serif text-xl font-bold text-navy">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
