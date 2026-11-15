import Link from "next/link";
import { formatShortDate, tripDuration, type Profile, type Trip, type Visa } from "@/lib/data";
import { VisaManager } from "./VisaManager";
import { JumpNav } from "./JumpNav";
import { countryName } from "@/lib/countries";
import { deleteTrip, updateProfile } from "@/lib/actions";
import { ProfileForm } from "./ProfileForm";
import { RecordForm } from "./RecordForm";
import { EMPTY_PROFILE } from "@/lib/record";
import { Flag } from "./Flag";
import { ConfirmButton } from "./SubmitButton";

/** One page with everything for an existing record: card details, add trip, recorded trips. */
export function ProfileEditor({
  profile,
  trips,
  visas = [],
  canDelete = true,
}: {
  profile: Profile;
  trips: Trip[];
  visas?: Visa[];
  /** Users and admins can add and update; only admins can delete. */
  canDelete?: boolean;
}) {
  const newestFirst = [...trips].reverse();

  return (
    <div className="space-y-8">
      <JumpNav
        items={[
          { id: "details", label: "🪪 Travel card details" },
          { id: "trips", label: "🌍 Immigration record" },
          { id: "recorded", label: "🧾 Recorded trips" },
          { id: "visas", label: "🛂 Visas", primary: true },
        ]}
      />
      <section id="details" className="panel p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Step 1</p>
        <h2 className="mb-6 mt-1 font-serif text-2xl font-bold text-navy">Travel card details</h2>
        <ProfileForm action={updateProfile.bind(null, profile.id)} profile={profile} submitLabel="Save details" />
      </section>

      <section id="trips" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Step 2</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Add to the immigration record</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Choose a country and list its visits. Visits to a country already in the record are added to it.
            </p>
          </div>
          <Link href={`/admin/import?profile=${profile.id}`} className="btn btn-gold ml-auto">
            ⬆ Fill from a document
          </Link>
        </div>
        <RecordForm
          target={profile.id}
          showProfile={false}
          stayOnPage
          saveLabel="Save visits"
          initialProfile={{ ...EMPTY_PROFILE, passportNumber: profile.passportNumber, previousPassports: profile.previousPassports }}
        />
      </section>

      <section id="recorded" className="panel overflow-hidden">
        <h2 className="border-b border-line px-6 py-4 font-serif text-xl font-bold text-navy">
          Recorded trips <span className="text-base font-normal text-ink-soft">({trips.length})</span>
        </h2>
        {!trips.length && <p className="px-6 py-8 text-center text-ink-soft">No trips yet. Add your first trip above.</p>}
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
              {canDelete && (
                <form action={deleteTrip.bind(null, trip.id)}>
                  <ConfirmButton message="Delete this trip?" className="btn btn-danger !py-1.5">
                    Delete
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section id="visas" className="panel p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Step 3</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-navy">Add / edit visas</h2>
        <p className="mb-5 mt-1 text-sm text-ink-soft">
          Upload a visa (e-Visa PDF, or a photo of a paper visa) and press <b>Read details from document</b> to fill the
          form, or type the details in. The document is saved with the visa.
        </p>
        <VisaManager
          profileId={profile.id}
          visas={visas}
          passports={[profile.passportNumber, ...profile.previousPassports].filter((p): p is string => !!p)}
          defaultPassport={profile.passportNumber}
          canDelete={canDelete}
        />
      </section>
    </div>
  );
}
