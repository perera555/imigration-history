import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatDate, type BoardingPass } from "@/lib/data";

const NAVY = "#0b1f3a";
const GOLD = "#c9a54c";
const GOLD_SOFT = "#e8d49a";
const INK = "#0f1b2d";
const MUTED = "#5b6577";
const PAPER = "#f7f3ea";
const SOFT = "#9fb0c8";

/** Real boarding pass size: 203 x 83 mm = 575.4 x 235.3 pt. */
export const BP_WIDTH = 575.4;
export const BP_HEIGHT = 235.3;

/** One boarding pass drawn at real size (main part + tear-off stub with barcode). */
export function BoardingPassView({
  pass: b,
  passenger,
  tripLabel,
}: {
  pass: BoardingPass;
  passenger: string;
  tripLabel?: string | null;
}) {
  return (
    <View style={{ width: BP_WIDTH, height: BP_HEIGHT, flexDirection: "row", borderRadius: 10, overflow: "hidden", borderWidth: 0.8, borderColor: GOLD }}>
      <View style={{ width: "72%", backgroundColor: NAVY, padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: GOLD_SOFT, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>{(b.airline ?? "BOARDING PASS").toUpperCase()}</Text>
          <Text style={{ color: SOFT, fontSize: 7, letterSpacing: 1.5 }}>BOARDING PASS{b.direction ? ` · ${b.direction.toUpperCase()}` : ""}</Text>
        </View>
        <Text style={{ color: SOFT, fontSize: 7, marginTop: 8, letterSpacing: 1 }}>
          PASSENGER <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold" }}>{passenger.toUpperCase()}</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 22 }}>
          <View>
            <Text style={{ color: SOFT, fontSize: 7, letterSpacing: 1.5 }}>FROM</Text>
            <Text style={{ color: "#ffffff", fontSize: 34, fontFamily: "Times-Bold" }}>{b.fromAirport ?? "---"}</Text>
          </View>
          <Text style={{ color: GOLD_SOFT, fontSize: 16, marginHorizontal: 18, marginBottom: 8 }}>&gt;&gt;</Text>
          <View>
            <Text style={{ color: SOFT, fontSize: 7, letterSpacing: 1.5 }}>TO</Text>
            <Text style={{ color: "#ffffff", fontSize: 34, fontFamily: "Times-Bold" }}>{b.toAirport ?? "---"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: 18 }}>
          {[
            ["FLIGHT", b.flightNumber ?? "-"],
            ["DATE", b.flightDate ? formatDate(b.flightDate) : "-"],
            ["SEAT", b.seat ?? "-"],
            ["PNR", b.bookingRef ?? "-"],
          ].map(([label, value]) => (
            <View key={label} style={{ marginRight: 24 }}>
              <Text style={{ color: SOFT, fontSize: 6.5, letterSpacing: 1.2 }}>{label}</Text>
              <Text style={{ color: "#ffffff", fontSize: 10, fontFamily: "Helvetica-Bold" }}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: SOFT, fontSize: 6.5, marginTop: 10 }}>
          {tripLabel ? `Trip: ${tripLabel}` : "Current / upcoming trip"}
          {b.checkedIn ? "  ·  Checked in online" : ""}
        </Text>
      </View>
      <View style={{ width: "28%", backgroundColor: PAPER, padding: 14, borderLeftWidth: 1.5, borderLeftColor: GOLD, borderStyle: "dashed" }}>
        <Text style={{ color: GOLD, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 }}>STUB</Text>
        <Text style={{ color: NAVY, fontSize: 16, fontFamily: "Times-Bold", marginTop: 6 }}>{`${b.fromAirport ?? "---"} > ${b.toAirport ?? "---"}`}</Text>
        <Text style={{ color: MUTED, fontSize: 8, marginTop: 4 }}>{b.flightNumber ?? "-"}</Text>
        <Text style={{ color: MUTED, fontSize: 8 }}>{b.flightDate ? formatDate(b.flightDate) : "-"}</Text>
        <Text style={{ color: MUTED, fontSize: 8 }}>Seat {b.seat ?? "-"}</Text>
        <View style={{ flexDirection: "row", marginTop: "auto", height: 34 }}>
          {Array.from({ length: 34 }, (_, i) => (
            <View key={i} style={{ width: [1, 2, 1, 3, 1, 2][i % 6], marginRight: [2, 1, 3, 1, 2, 1][i % 6], backgroundColor: INK }} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** A PDF whose page is exactly one boarding pass (203 x 83 mm): print at 100%. */
export function SingleBoardingPassPdf({ pass, passenger, tripLabel }: { pass: BoardingPass; passenger: string; tripLabel?: string | null }) {
  return (
    <Document title={`Boarding pass ${pass.flightNumber ?? ""}`.trim()} author={passenger}>
      <Page size={[BP_WIDTH, BP_HEIGHT]} style={{ padding: 0 }}>
        <BoardingPassView pass={pass} passenger={passenger} tripLabel={tripLabel} />
      </Page>
    </Document>
  );
}
