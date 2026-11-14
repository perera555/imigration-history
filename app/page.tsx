import Link from "next/link";
import { flagSvg } from "@/lib/countries";

const FLAG_RING = ["th", "au", "gb", "fr", "in", "ae", "cn", "my", "nz", "kh", "nl", "be"];

const FEATURES = [
  {
    title: "Travel identity card",
    body: "Photo, full name, age, sex, nationality, current and previous passport numbers, phone, email and address on one elegant card.",
    icon: (
      <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zm5 3.5a2 2 0 1 0 0 .01M5.5 16c.5-1.5 1.5-2.5 2.5-2.5s2 1 2.5 2.5M13 9h5m-5 3h5m-5 3h3" />
    ),
  },
  {
    title: "Complete immigration history",
    body: "Every journey grouped by country with its flag: number of visits, departure and arrival dates, days abroad, purpose and passport used.",
    icon: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 12 2.5a7 7 0 0 1 7 7C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  },
  {
    title: "One-click PDF",
    body: "Download a polished A4 document with the travel card and photo on top and the full history below, ready for visa applications.",
    icon: <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 0v5h5M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5" />,
  },
  {
    title: "Install as an app",
    body: "Add it to your phone or computer home screen and open it like any other app, with no app store needed.",
    icon: <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 16h.01M12 7v6m0 0-2.5-2.5M12 13l2.5-2.5" />,
  },
];

const STEPS = [
  { n: "01", title: "Create your account", body: "Sign up with your name, email and a password." },
  { n: "02", title: "Add your travel data", body: "Fill in your travel card, then each country and its visits, or upload a document." },
  { n: "03", title: "View & download", body: "See your record and download the PDF in one tap." },
];

export default function LandingPage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      {/* Hero */}
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-navy-2">
            <span className="size-1.5 rounded-full bg-gold" /> Personal travel record
          </p>
          <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] text-navy sm:text-6xl">
            Your immigration history, <span className="gold-text">beautifully organised.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Keep every journey in one place, with each passport, country, date and purpose, and turn it into a
            professional PDF for visa and immigration applications in seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-gold !px-6 !py-3 text-base">
              Create account →
            </Link>
            <Link href="/login" className="btn btn-ghost !px-6 !py-3 text-base">
              Sign in
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-2">
              {FLAG_RING.slice(0, 6).map((c) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c} src={flagSvg(c)} alt="" className="size-8 rounded-full border-2 border-paper object-cover" />
              ))}
            </div>
            <p className="text-sm text-ink-soft">Every country in the world, with its flag</p>
          </div>
        </div>

        {/* Decorative card preview */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-gold/30 via-transparent to-navy-2/30 blur-2xl" />
          <div className="id-card rotate-[-3deg] rounded-[1.75rem] p-6 transition-transform duration-500 hover:rotate-0">
            <div className="relative z-10">
              <div className="flex items-center justify-between border-b border-gold-soft/25 pb-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-gold-soft/80">Travel identity card</p>
                  <p className="gold-text font-serif text-lg font-bold">Immigration History</p>
                </div>
                <div className="grid size-10 place-items-center rounded-full border border-gold-soft/50 text-gold-soft">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
                  </svg>
                </div>
              </div>
              <div className="mt-5 flex gap-5">
                <div className="grid h-32 w-24 shrink-0 place-items-center rounded-xl border-2 border-gold-soft/60 bg-white/10 text-white/40">
                  <svg viewBox="0 0 24 24" className="size-12" fill="currentColor" aria-hidden>
                    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-3">
                  {["Full name", "Passport no.", "Nationality", "Previous passports"].map((l, i) => (
                    <div key={l}>
                      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-gold-soft/70">{l}</p>
                      <div className="mt-1 h-2.5 rounded-full bg-white/25" style={{ width: `${90 - i * 14}%` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-6 gap-2">
                {FLAG_RING.slice(0, 12).map((c) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c} src={flagSvg(c)} alt="" className="aspect-[3/2] w-full rounded-[3px] object-cover opacity-90" />
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-black/25 px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-white/60">
                <p>P&lt;&lt;&lt;IMMIGRATION&lt;&lt;HISTORY&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</p>
                <p>N0000000&lt;0&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Features</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-navy sm:text-4xl">Everything immigration officers ask for</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-6 transition-transform hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-2xl bg-navy text-gold-soft">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {f.icon}
                </svg>
              </div>
              <h3 className="mt-5 font-semibold text-navy">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="id-card rounded-[2rem] px-6 py-12 sm:px-12">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-soft/80">How it works</p>
          <h2 className="gold-text mt-2 font-serif text-3xl font-bold">Three simple steps</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="font-serif text-3xl font-bold text-gold">{s.n}</p>
                <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-white/70">{s.body}</p>
              </div>
            ))}
          </div>
          <Link href="/register" className="btn btn-gold mt-10 !px-6 !py-3">
            Create account →
          </Link>
        </div>
      </section>
    </div>
  );
}
