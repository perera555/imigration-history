import Link from "next/link";
import { PdfButtons } from "./PdfButtons";
import { UpdateButton } from "./UpdateButton";
import { boardingTrips, travelStats, type Profile, type Stay, type Trip, type Visa } from "@/lib/data";
import { StaySection } from "./StaySection";
import { VisaList } from "./VisaList";
import { TravelCard } from "./TravelCard";
import { DocumentsPanel } from "./DocumentsPanel";
import { LiveRefresh } from "./LiveRefresh";
import { HistoryTable, StatsBar } from "./HistoryTable";

export function ProfileDetail({
  profile,
  trips,
  visas = [],
  stays = [],
  showBack,
  showDocuments = false,
}: {
  profile: Profile;
  trips: Trip[];
  visas?: Visa[];
  stays?: Stay[];
  showBack?: boolean;
  /** Owner or admin: list every saved PDF / document below the travel card. */
  showDocuments?: boolean;
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

      {/* Card and stats close together: no big gaps below the travel card */}
      <div className="space-y-3">
        <TravelCard profile={profile} />
        {showDocuments && <LiveRefresh profileId={profile.id} />}
        <StatsBar stats={travelStats(trips)} />
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Travel record</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Previous immigration history</h2>
        </div>
        <HistoryTable trips={trips} stays={stays} />
      </section>

      {/* Hotels & Airbnb: every hotel per visit with its booking document (owner and admins) */}
      {showDocuments && <StaySection profileId={profile.id} stays={stays} trips={boardingTrips(trips)} canDelete={false} />}

      {/* Visas: shown below the immigration record */}
      <VisaList profileId={profile.id} holder={profile} visas={visas} trips={trips} stays={stays} canViewDocument={showDocuments} canDelete={showDocuments} />

      {/* All PDFs & documents: at the bottom of the page */}
      {showDocuments && <DocumentsPanel profileId={profile.id} />}
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
