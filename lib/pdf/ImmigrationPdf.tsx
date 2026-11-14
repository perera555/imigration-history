import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Never split words with hyphens (e.g. "Bel-gium").
Font.registerHyphenationCallback((word) => [word]);
import {
  ageFrom,
  formatDate,
  groupByCountry,
  travelStats,
  tripDuration,
  daysToYmd,
  type Profile,
  type Trip,
} from "@/lib/data";

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

export function ImmigrationPdf({
  profile,
  trips,
  flags,
  generatedOn,
}: {
  profile: Profile;
  trips: Trip[];
  flags: Record<string, string | null>;
  generatedOn: string;
}) {
  const age = ageFrom(profile.dateOfBirth);
  const stats = travelStats(trips);
  const groups = groupByCountry(trips);
  const [mrz1, mrz2] = mrz(profile);

  return (
    <Document title={`Previous Immigration History - ${profile.fullName}`} author={profile.fullName}>
      <Page size="A4" style={s.page}>
        <View style={s.titleRow}>
          <View>
            <Text style={s.eyebrow}>PERSONAL TRAVEL RECORD</Text>
            <Text style={s.title}>Previous Immigration History</Text>
          </View>
          <Text style={s.generated}>Generated {generatedOn}</Text>
        </View>

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
        <Text style={s.sectionTitle}>Immigration History</Text>
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

        <View style={s.footer} fixed>
          <Text>{profile.fullName} · Private &amp; confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
