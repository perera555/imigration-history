import { getBoardingPasses, getPassportDocuments, getStays, getVisas, formatShortDate } from "@/lib/data";
import { countryName } from "@/lib/countries";
import { STAY_ICON } from "@/lib/stay-kinds";

type Doc = { key: string; icon: string; title: string; detail: string; view: string; download?: string };

const sizeText = (n: number) => (n >= 1_000_000 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * "All my PDFs & documents": every saved file of this record in one place, right below the travel card.
 * Private: only render it for the record's owner and admins.
 */
export async function DocumentsPanel({ profileId }: { profileId: string }) {
  const [passports, visas, passes, stays] = await Promise.all([
    getPassportDocuments(profileId),
    getVisas(profileId),
    getBoardingPasses(profileId),
    getStays(profileId),
  ]);

  const groups: { title: string; docs: Doc[] }[] = [
    {
      title: "Full record",
      docs: [
        {
          key: "record",
          icon: "🗂️",
          title: "Complete travel record (PDF)",
          detail: "Travel card, immigration record, hotels, visas and boarding passes",
          view: `/api/profiles/${profileId}/pdf?view=1`,
          download: `/api/profiles/${profileId}/pdf`,
        },
      ],
    },
    {
      title: "Passports",
      docs: passports.map((p) => ({
        key: p.id,
        icon: "📕",
        title: `Passport ${p.passportNumber}`,
        detail: `${p.pageCount ? `${p.pageCount} pages · ` : ""}${sizeText(p.size)}`,
        view: `/api/passport-documents/${p.id}`,
        download: `/api/passport-documents/${p.id}?download=1`,
      })),
    },
    {
      title: "Visas",
      docs: visas.flatMap((v) => [
        ...(v.hasDocument
          ? [
              {
                key: v.id,
                icon: "🛂",
                title: `${countryName(v.countryCode)} visa${v.visaNumber ? ` · ${v.visaNumber}` : ""}`,
                detail: [v.visaType, v.issueDate && `issued ${formatShortDate(v.issueDate)}`, v.documentName].filter(Boolean).join(" · "),
                view: `/api/visas/${v.id}/document`,
                download: `/api/visas/${v.id}/document?download=1`,
              },
            ]
          : []),
        ...v.pages.map((p, i) => ({
          key: p.id,
          icon: "📄",
          title: `${countryName(v.countryCode)} visa · page ${i + 1}`,
          detail: p.fileName,
          view: `/api/visa-pages/${p.id}`,
          download: `/api/visa-pages/${p.id}?download=1`,
        })),
      ]),
    },
    {
      title: "Boarding passes",
      docs: passes.map((b) => ({
        key: b.id,
        icon: "✈️",
        title: `${b.flightNumber || "Boarding pass"}${b.fromAirport || b.toAirport ? ` · ${b.fromAirport || "?"} → ${b.toAirport || "?"}` : ""}`,
        detail: [b.flightDate && formatShortDate(b.flightDate), b.airline, b.hasFile ? b.fileName : "real-size PDF"].filter(Boolean).join(" · "),
        view: b.hasFile ? `/api/boarding/${b.id}/file` : `/api/boarding/${b.id}/pdf`,
        download: b.hasFile ? `/api/boarding/${b.id}/file?download=1` : `/api/boarding/${b.id}/pdf`,
      })),
    },
    {
      title: "Hotels & Airbnb",
      docs: stays
        .filter((s) => s.hasFile)
        .map((s) => ({
          key: s.id,
          icon: STAY_ICON[s.kind] ?? "🏨",
          title: s.name,
          detail: [s.city, s.checkIn && formatShortDate(s.checkIn), s.fileName].filter(Boolean).join(" · "),
          view: `/api/stays/${s.id}/file`,
          download: `/api/stays/${s.id}/file?download=1`,
        })),
    },
  ];
  const count = groups.reduce((n, g) => n + g.docs.length, 0);

  return (
    <section id="documents" className="panel scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Documents</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-navy">All my PDFs &amp; documents</h2>
        </div>
        <span className="ml-auto rounded-full bg-paper-2 px-3 py-1 text-xs font-semibold text-ink-soft">
          {count} file{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups
          .filter((g) => g.docs.length)
          .map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                {g.title} ({g.docs.length})
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                {g.docs.map((d) => (
                  <li key={d.key} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper text-lg" aria-hidden>
                      {d.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{d.title}</p>
                      {d.detail && <p className="truncate text-xs text-ink-soft">{d.detail}</p>}
                    </div>
                    <a href={d.view} target="_blank" rel="noopener" className="btn btn-ghost !px-2.5 !py-1 text-xs" title="View">
                      👁
                    </a>
                    {d.download && (
                      <a href={d.download} className="btn btn-ghost !px-2.5 !py-1 text-xs" title="Download">
                        ⬇
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
      {count <= 1 && (
        <p className="mt-3 text-sm text-ink-soft">
          Passport PDFs, visa documents, boarding passes and hotel confirmations you upload will be listed here too.
        </p>
      )}
    </section>
  );
}
