import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Never split words with hyphens (e.g. "Bel-gium").
Font.registerHyphenationCallback((word) => [word]);
import {
  ageFrom,
  formatDate,
  groupForDisplay,
  travelStats,
  tripDuration,
  daysToYmd,
  formatShortDate,
  visaState,
  type Profile,
  type Trip,
  type Visa,
  type BoardingPass,
} from "@/lib/data";
import { countryName, isSchengen } from "@/lib/countries";
import { BoardingPassView } from "./BoardingPassPdf";

const NAVY = "#0b1f3a";
const NAVY_2 = "#13315c";
const GOLD = "#c9a54c";
const GOLD_SOFT = "#e8d49a";
const INK = "#0f1b2d";
const MUTED = "#5b6577";
const LINE = "#ddd5c3";
const PAPER = "#f7f3ea";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 50, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: INK },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  eyebrow: { fontSize: 7, letterSpacing: 2, color: GOLD, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Times-Bold", color: NAVY, marginTop: 2 },
  generated: { fontSize: 7.5, color: MUTED },

  card: { backgroundColor: NAVY, borderRadius: 12, padding: 18, borderWidth: 1.2, borderColor: GOLD },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.6,
    borderBottomColor: "#5d5233",
    paddingBottom: 8,
    marginBottom: 12,
  },
  cardEyebrow: { fontSize: 6.5, letterSpacing: 2.2, color: GOLD_SOFT, fontFamily: "Helvetica-Bold" },
  cardTitle: { fontSize: 14, color: GOLD_SOFT, fontFamily: "Times-Bold", marginTop: 2 },
  cardBody: { flexDirection: "row" },
  photoFrame: { width: 96, height: 120, borderRadius: 8, borderWidth: 1.5, borderColor: GOLD_SOFT, overflow: "hidden", backgroundColor: NAVY_2 },
  photo: { width: 96, height: 120, objectFit: "cover" },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  fields: { flex: 1, marginLeft: 18, flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", marginBottom: 8, paddingRight: 8 },
  fieldWide: { width: "100%", marginBottom: 8 },
  label: { fontSize: 6, letterSpacing: 1.4, color: "#bba76d", fontFamily: "Helvetica-Bold", marginBottom: 2 },
  value: { fontSize: 9.5, color: "#ffffff" },
  valueMono: { fontSize: 9.5, color: "#ffffff", fontFamily: "Courier-Bold" },
  mrz: { marginTop: 8, backgroundColor: "#071427", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  mrzText: { fontFamily: "Courier", fontSize: 7.5, color: "#c5cede", letterSpacing: 1.2 },

  stats: { flexDirection: "row", marginTop: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: PAPER, borderRadius: 8, borderWidth: 0.6, borderColor: LINE, paddingVertical: 7, paddingHorizontal: 10, marginRight: 6 },
  statLabel: { fontSize: 6.5, letterSpacing: 1.2, color: MUTED, fontFamily: "Helvetica-Bold" },
  statValue: { fontSize: 12, fontFamily: "Times-Bold", color: NAVY, marginTop: 2 },

  sectionTitle: { fontSize: 13, fontFamily: "Times-Bold", color: NAVY, marginBottom: 6 },
  thead: { flexDirection: "row", backgroundColor: NAVY, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  th: { color: GOLD_SOFT, fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, paddingVertical: 6, paddingHorizontal: 4 },
  group: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: LINE, borderLeftWidth: 0.6, borderRightWidth: 0.6, borderLeftColor: LINE, borderRightColor: LINE },
  countryCell: { flexDirection: "column", paddingVertical: 6, paddingHorizontal: 5 },
  flag: { width: 26, height: 17, borderWidth: 0.4, borderColor: "#cccccc", marginBottom: 3 },
  countryName: { fontFamily: "Helvetica-Bold", fontSize: 8.6 },
  cell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8.2 },
  visitRow: { flexDirection: "row" },
  note: { fontSize: 6.8, color: MUTED, marginTop: 1 },

  footer: { position: "absolute", bottom: 22, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
});

// column widths (percent of table)
const W = { country: "16%", visits: "8%", dep: "15%", ret: "15%", days: "14%", purpose: "20%", passport: "12%" } as const;
const VISIT_COLS = 100 - 16 - 8; // share of width used by per-visit columns
const pct = (w: string) => `${(parseFloat(w) / VISIT_COLS) * 100}%`;

function F({ label, value, mono, wide }: { label: string; value: string | null | undefined; mono?: boolean; wide?: boolean }) {
  return (
    <View style={wide ? s.fieldWide : s.field}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <Text style={mono ? s.valueMono : s.value}>{value || "—"}</Text>
    </View>
  );
}

function mrz(profile: Profile) {
  const parts = profile.fullName.toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/);
  const surname = parts.pop() ?? "";
  const top = `P<${(profile.nationality ?? "").slice(0, 3).toUpperCase().padEnd(3, "<")}${surname}<<${parts.join("<")}`;
  const bottom = `${(profile.passportNumber ?? "").padEnd(9, "<")}<${(profile.dateOfBirth ?? "").replaceAll("-", "").slice(2)}<${(profile.sex ?? "<").charAt(0).toUpperCase()}`;
  return [top.padEnd(44, "<").slice(0, 44), bottom.padEnd(44, "<").slice(0, 44)];
}

export type PdfParts = { card: boolean; record: boolean; visas: boolean; boarding?: boolean };
export type PdfBoardingPass = BoardingPass & { image: string | null; tripLabel: string | null };

export function ImmigrationPdf({
  profile,
  trips,
  flags,
  generatedOn,
  visas = [],
  parts = { card: true, record: true, visas: true },
  boarding = [],
}: {
  /** Boarding passes (with an embedded image when the upload was a photo). */
  boarding?: PdfBoardingPass[];
  /** Which parts to include (each starts on its own page). */
  parts?: PdfParts;
  profile: Profile;
  trips: Trip[];
  visas?: Visa[];
  flags: Record<string, string | null>;
  generatedOn: string;
}) {
  const age = ageFrom(profile.dateOfBirth);
  const stats = travelStats(trips);
  const groups = groupForDisplay(trips);
  const [mrz1, mrz2] = mrz(profile);
  const heading = !parts.record && parts.visas ? "Visas Held" : "Previous Immigration History";
  const titleRow = (
    <View style={s.titleRow}>
      <View>
        <Text style={s.eyebrow}>PERSONAL TRAVEL RECORD</Text>
        <Text style={s.title}>{heading}</Text>
      </View>
      <Text style={s.generated}>Generated {generatedOn}</Text>
    </View>
  );
  // Visa Record: always the last part of the full PDF (travel card -> immigration record -> visa record),
  // or the whole content of the visas-only PDF.
  const visasSection = visas.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={s.sectionTitle} minPresenceAhead={60}>
              Visa Record
            </Text>
            <View style={s.thead}>
              <Text style={[s.th, { width: "20%" }]}>COUNTRY</Text>
              <Text style={[s.th, { width: "17%" }]}>TYPE / NO.</Text>
              <Text style={[s.th, { width: "14%" }]}>ISSUED</Text>
              <Text style={[s.th, { width: "14%" }]}>EXPIRES</Text>
              <Text style={[s.th, { width: "17%" }]}>TRAVEL FROM - TO</Text>
              <Text style={[s.th, { width: "9%" }]}>ENTRIES</Text>
              <Text style={[s.th, { width: "9%" }]}>STATUS</Text>
            </View>
            {visas.map((v, i) => {
              const st = visaState(v);
              return (
                <View key={v.id} style={[s.group, i % 2 ? { backgroundColor: PAPER } : {}]} wrap={false}>
                  <View style={[s.countryCell, { width: "20%" }]}>
                    {flags[v.countryCode] && (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image src={flags[v.countryCode]!} style={s.flag} />
                    )}
                    <Text style={s.countryName}>{countryName(v.countryCode)}</Text>
                    {isSchengen(v.countryCode) ? <Text style={s.note}>Schengen visa (all Schengen countries)</Text> : null}
                    {v.countriesTravelled.length ? (
                      <Text style={s.note}>Travelled: {v.countriesTravelled.map(countryName).join(", ")}</Text>
                    ) : null}
                  </View>
                  <View style={[s.cell, { width: "17%" }]}>
                    <Text>{v.visaType || "Visa"}</Text>
                    {v.visaFormat ? <Text style={s.note}>{v.visaFormat}</Text> : null}
                    {v.visaNumber ? <Text style={[s.note, { fontFamily: "Courier" }]}>{v.visaNumber}</Text> : null}
                    {v.purpose ? <Text style={s.note}>{v.purpose}</Text> : null}
                  </View>
                  <Text style={[s.cell, { width: "14%" }]}>{v.issueDate ? formatDate(v.issueDate) : "—"}</Text>
                  <Text style={[s.cell, { width: "14%" }]}>{v.expiryDate ? formatDate(v.expiryDate) : "—"}</Text>
                  <Text style={[s.cell, { width: "17%" }]}>
                    {v.travelFrom || v.travelTo ? `${formatShortDate(v.travelFrom)} to ${formatShortDate(v.travelTo)}` : "—"}
                  </Text>
                  <Text style={[s.cell, { width: "9%" }]}>
                    {v.entries ?? "—"}
                    {v.stayDays ? `\n${v.stayDays} days` : ""}
                  </Text>
                  <Text
                    style={[
                      s.cell,
                      { width: "9%", fontFamily: "Helvetica-Bold", color: st.tone === "valid" ? "#1d7a4e" : st.tone === "expired" ? "#b4232f" : MUTED },
                    ]}
                  >
                    {st.label}
                  </Text>
                </View>
              );
            })}
          </View>
  ) : (
    <View style={{ marginTop: 18 }}>
      <Text style={s.sectionTitle}>Visa Record</Text>
      <View style={[s.group, { padding: 12, borderTopWidth: 0.6, borderTopColor: LINE }]}>
        <Text style={{ color: MUTED }}>No visas recorded yet.</Text>
      </View>
    </View>
  );
  const footer = (
    <View style={s.footer} fixed>
      <Text>{profile.fullName} · Private &amp; confidential</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );


  return (
    <Document title={`${heading} - ${profile.fullName}`} author={profile.fullName}>
      {parts.card && (
      <Page size="A4" style={s.page}>
        {titleRow}

        {/* Travel identity card */}
        <View style={s.card} wrap={false}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardEyebrow}>TRAVEL IDENTITY CARD</Text>
              <Text style={s.cardTitle}>{profile.fullName}</Text>
            </View>
            <Text style={[s.cardEyebrow, { alignSelf: "flex-end" }]}>
              {[profile.passportNumber, ...profile.previousPassports].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={s.cardBody}>
            <View style={s.photoFrame}>
              {profile.photo ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={profile.photo} style={s.photo} />
              ) : (
                <View style={s.photoEmpty}>
                  <Text style={{ color: "#8090a8", fontSize: 7 }}>NO PHOTO</Text>
                </View>
              )}
            </View>
            <View style={s.fields}>
              <F label="Full name" value={profile.fullName} wide />
              <F label="Sex" value={profile.sex} />
              <F label="Age" value={age !== null ? `${age} years (born ${formatDate(profile.dateOfBirth)})` : null} />
              <F label="Nationality" value={profile.nationality} />
              <F label="ID number (NIC)" value={profile.nationalId} mono />
              <F label="Passport no." value={profile.passportNumber} mono />
              <F label="Passport issue date" value={profile.passportIssueDate ? formatDate(profile.passportIssueDate) : null} />
              <F label="Passport expiry date" value={profile.passportExpiryDate ? formatDate(profile.passportExpiryDate) : null} />
              <F label="Previous passports" value={profile.previousPassports.join(", ")} mono wide />
              <F label="Phone" value={profile.phone} />
              <F label="Email" value={profile.email} />
              <F label="Address" value={profile.address} wide />
            </View>
          </View>
          <View style={s.mrz}>
            <Text style={s.mrzText}>{mrz1}</Text>
            <Text style={s.mrzText}>{mrz2}</Text>
          </View>
        </View>


        {footer}
      </Page>
      )}
      {/* Page 2+: immigration record (its table header repeats only on these pages) */}
      {parts.record && (
        <Page size="A4" style={s.page}>
        {!parts.card && titleRow}
        <View style={s.stats}>
          {[
            ["COUNTRIES", stats.countries],
            ["TRIPS", stats.trips],
            ["TIME ABROAD", daysToYmd(stats.daysAbroad)],
            ["YEARS", stats.span],
          ].map(([label, value], i) => (
            <View key={String(label)} style={[s.stat, i === 2 ? { flex: 1.6 } : {}, i === 3 ? { marginRight: 0 } : {}]}>
              <Text style={s.statLabel}>{label}</Text>
              <Text style={s.statValue}>{String(value)}</Text>
            </View>
          ))}
        </View>

        {/* Immigration history */}
        <Text style={s.sectionTitle}>Immigration Record</Text>
        <View style={s.thead} fixed>
          <Text style={[s.th, { width: W.country }]}>COUNTRY</Text>
          <Text style={[s.th, { width: W.visits, textAlign: "center" }]}>VISITS</Text>
          <Text style={[s.th, { width: W.dep }]}>DEPARTURE</Text>
          <Text style={[s.th, { width: W.ret }]}>RETURN</Text>
          <Text style={[s.th, { width: W.days }]}>DURATION</Text>
          <Text style={[s.th, { width: W.purpose }]}>PURPOSE</Text>
          <Text style={[s.th, { width: W.passport }]}>PASSPORT</Text>
        </View>
        {groups.length === 0 && (
          <View style={[s.group, { padding: 12 }]}>
            <Text style={{ color: MUTED }}>No trips recorded.</Text>
          </View>
        )}
        {groups.map((group, gi) => (
          <View key={group.countryCode} style={[s.group, gi % 2 ? { backgroundColor: PAPER } : {}]} wrap={false}>
            <View style={[s.countryCell, { width: W.country }]}>
              {flags[group.countryCode] && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={flags[group.countryCode]!} style={s.flag} />
              )}
              <Text style={s.countryName}>{group.countryName}</Text>
              {group.schengen ? <Text style={s.note}>Schengen visa</Text> : null}
            </View>
            <Text style={[s.cell, { width: W.visits, textAlign: "center", fontFamily: "Helvetica-Bold", paddingTop: 6 }]}>
              {group.visits.length}
            </Text>
            <View style={{ width: `${VISIT_COLS}%`, paddingVertical: 2 }}>
              {group.visits.map((trip) => (
                <View key={trip.id} style={s.visitRow}>
                  <Text style={[s.cell, { width: pct(W.dep) }]}>{formatDate(trip.departureDate)}</Text>
                  <Text style={[s.cell, { width: pct(W.ret) }]}>{formatDate(trip.returnDate)}</Text>
                  <Text style={[s.cell, { width: pct(W.days) }]}>{tripDuration(trip) ?? "—"}</Text>
                  <View style={[s.cell, { width: pct(W.purpose) }]}>
                    <Text>
                      {trip.purpose || "—"}
                      {trip.city ? ` (${trip.city})` : ""}
                    </Text>
                    {trip.countries ? <Text style={s.note}>Countries: {trip.countries.map(countryName).join(", ")}</Text> : null}
                    {trip.notes ? <Text style={s.note}>{trip.notes}</Text> : null}
                  </View>
                  <Text style={[s.cell, { width: pct(W.passport), fontFamily: "Courier" }]}>
                    {trip.passportNumber ?? "—"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

          {footer}
        </Page>
      )}
      {/* Last part: visa record */}
      {parts.visas && (
        <Page size="A4" style={s.page}>
          {!parts.card && !parts.record && titleRow}
          {visasSection}
          {footer}
        </Page>
      )}
      {parts.boarding && (
        // Boarding passes at real size: 203 x 83 mm (575 x 235 pt), landscape A4, two per page.
        <Page size="A4" orientation="landscape" style={[s.page, { paddingHorizontal: 40 }]}>
          {!parts.card && !parts.record && !parts.visas && titleRow}
          <Text style={s.sectionTitle}>Boarding Passes</Text>
          <Text style={[s.note, { marginBottom: 10 }]}>Actual size 203 x 83 mm. Print at 100% (no "fit to page").</Text>
          {boarding.length === 0 && <Text style={{ color: MUTED }}>No boarding passes uploaded yet.</Text>}
          {boarding.map((b) => (
            <View key={b.id} wrap={false} style={{ marginBottom: 14 }}>
              <BoardingPassView pass={b} passenger={profile.fullName} tripLabel={b.tripLabel} />
            </View>
          ))}
          {footer}
        </Page>
      )}
      {parts.boarding && boarding.some((b) => b.image) && (
        // Uploaded boarding pass photos, shown at boarding pass width (203 mm).
        <Page size="A4" orientation="landscape" style={[s.page, { paddingHorizontal: 40 }]}>
          <Text style={s.sectionTitle}>Uploaded boarding passes</Text>
          {boarding.filter((b) => b.image).map((b) => (
            <View key={`img-${b.id}`} wrap={false} style={{ marginBottom: 14 }}>
              <Text style={s.note}>{`${b.flightNumber ?? "Boarding pass"}${b.flightDate ? ` · ${formatDate(b.flightDate)}` : ""}`}</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={b.image!} style={{ width: 575.4, maxHeight: 420, objectFit: "contain", marginTop: 4 }} />
            </View>
          ))}
          {footer}
        </Page>
      )}    </Document>
  );
}
