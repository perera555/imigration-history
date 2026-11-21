import Link from "next/link";
import { PdfButtons } from "./PdfButtons";
import { UpdateButton } from "./UpdateButton";
import { travelStats, type Profile, type Stay, type Trip, type Visa } from "@/lib/data";
import { VisaList } from "./VisaList";
import { TravelCard } from "./TravelCard";
import { HistoryTable, StatsBar } from "./HistoryTable";

export function ProfileDetail({
  profile,
  trips,
  visas = [],
  stays = [],
  showBack,
}: {
  profile: Profile;
  trips: Trip[];
  visas?: Visa[];
  stays?: Stay[];
  showBack?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {showBack && (
          <Link href="/records" className="text-sm text-ink-soft hover:text-ink">
            ← All records
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <UpdateButton profileId={profile.id} className="btn btn-ghost" />
          <PdfButtons profileId={profile.id} />
        </div>
      </div>

      <TravelCard profile={profile} />
      <StatsBar stats={travelStats(trips)} />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Travel record</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Previous immigration history</h2>
        </div>
        <HistoryTable trips={trips} stays={stays} />
      </section>

      {/* Visas: shown below the immigration record */}
      <VisaList profileId={profile.id} holder={profile} visas={visas} trips={trips} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-96 animate-pulse rounded-[1.75rem] bg-navy/20" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-navy/10" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-navy/10" />
    </div>
  );
}
