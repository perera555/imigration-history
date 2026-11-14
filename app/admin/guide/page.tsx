import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Guide" };

type Step = { title: string; body: React.ReactNode };

const USER_STEPS: Step[] = [
  {
    title: "Open the app",
    body: (
      <>
        Users don&apos;t need to sign in. Share the website link; anyone with the link can view the record and
        download the PDF. Only admins sign in, using the <b>Admin panel</b> button at the bottom of the page.
      </>
    ),
  },
  {
    title: "View the travel card",
    body: (
      <>
        Tap <b>View records</b> on the home page (or <b>Records</b> at the top) and choose a traveller. Their
        page shows the <b>travel identity card</b>: photo, full name, age, sex, nationality, passport and previous
        passport numbers, phone, email and address.
      </>
    ),
  },
  {
    title: "Read the immigration history",
    body: (
      <>
        Below the card you&apos;ll find quick totals (countries, trips, days abroad) and the full history,
        grouped by country with its flag. For each country you&apos;ll see the number of visits, every departure
        and return date, the length of each trip, its purpose, and the passport used.
      </>
    ),
  },
  {
    title: "Download the PDF",
    body: (
      <>
        Tap <b>Download PDF</b>. The document puts the travel card with photo at the top, followed by the complete
        immigration history table. It is ready to print or attach to a visa application.
      </>
    ),
  },
  {
    title: "Install the app",
    body: (
      <>
        Tap <b>Install app</b> at the top of any page to add it to your phone or computer like a normal app. On
        iPhone/iPad: open in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.
      </>
    ),
  },
];

const ADMIN_STEPS: Step[] = [
  {
    title: "Open the admin panel",
    body: (
      <>
        Scroll to the bottom of any page and tap <b>Admin panel</b>, then sign in with your admin email and
        password. Use <b>Sign out</b> in the admin panel when you finish. From here you can create, edit and delete
        traveller profiles and their trips.
      </>
    ),
  },
  {
    title: "Add or edit a traveller",
    body: (
      <>
        Tap <b>+ New profile</b> (or <b>Edit</b> on an existing one). Fill in the full name (required), date of
        birth (age is calculated automatically), sex, nationality, phone, email, address, current passport number,
        and previous passport numbers separated by commas. Upload a passport-style photo; it&apos;s resized
        automatically. Tap <b>Save details</b>.
      </>
    ),
  },
  {
    title: "Add trips manually",
    body: (
      <>
        On the profile&apos;s edit page, use <b>Add a trip</b>. Search and pick the <b>country</b> (flags are
        shown), optionally add a city (e.g. Dubai, London), the <b>purpose</b>, the <b>departure</b> and{" "}
        <b>arrival/return</b> dates, and the <b>passport used</b> (pick from the profile&apos;s passports or type
        one). Enter each journey separately. The number of visits per country is counted automatically.
      </>
    ),
  },
  {
    title: "Multi-country trips",
    body: (
      <>
        For one journey through several countries (for example a Europe trip to the Netherlands, Belgium and
        France), add one trip per country with the same dates and a short note.
      </>
    ),
  },
  {
    title: "Fix or remove a trip",
    body: (
      <>
        In <b>Recorded trips</b>, tap <b>Edit</b> to change a trip or <b>Delete</b> to remove it. The app
        won&apos;t let a return date be earlier than the departure date.
      </>
    ),
  },
  {
    title: "Manage admins",
    body: (
      <>
        In the admin panel tap <b>Manage admins</b>. Add an admin with a name, email and password (min. 8
        characters). You can reset any admin&apos;s password, change your own, or remove other admins. You
        can&apos;t remove yourself, and there is always at least one admin.
      </>
    ),
  },
  {
    title: "Forgotten passwords",
    body: (
      <>
        <b>Forgot password?</b> emails a reset link that works for 1 hour (this needs email sending to be set up
        on the server). If email isn&apos;t set up, another admin can set a new password from{" "}
        <b>Manage admins</b>.
      </>
    ),
  },
  {
    title: "Keep data accurate",
    body: (
      <>
        Check every date against the passport stamps before downloading the PDF. Immigration officers compare the
        history with passport records, so mismatched dates can cause delays.
      </>
    ),
  },
];

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.title} className="panel flex gap-4 p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy font-serif font-bold text-gold-soft">
            {i + 1}
          </span>
          <div>
            <h3 className="font-semibold text-navy">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Help</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy sm:text-4xl">How to use Immigration History</h1>
        <nav className="mt-4 flex flex-wrap gap-2">
          <a href="#user" className="btn btn-primary">
            User guide
          </a>
          <a href="#admin" className="btn btn-ghost">
            Admin guide
          </a>
        </nav>
      </header>

      <section id="user" className="scroll-mt-24 space-y-4">
        <h2 className="font-serif text-2xl font-bold text-navy">User guide</h2>
        <Steps steps={USER_STEPS} />
      </section>

      <section id="admin" className="scroll-mt-24 space-y-4">
        <h2 className="font-serif text-2xl font-bold text-navy">Admin guide</h2>
        <Steps steps={ADMIN_STEPS} />
      </section>

      <p className="text-center text-sm">
        <Link href="/admin" className="text-navy-2 underline-offset-4 hover:underline">
          ← Back to the admin panel
        </Link>
      </p>
    </div>
  );
}
