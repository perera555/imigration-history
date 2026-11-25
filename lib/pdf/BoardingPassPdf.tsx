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

/**
 * One boarding pass (main part + tear-off stub with barcode). `size` 1 = real size for printing;
 * e.g. 0.45 = small, two side by side in the record PDF.
 */
export function BoardingPassView({
  pass: b,
  passenger,
  tripLabel,
  size = 1,
}: {
  pass: BoardingPass;
  passenger: string;
  tripLabel?: string | null;
  size?: number;
}) {
  const k = (n: number) => n * size;
  // Very small text is hard to read on paper: keep it at least 4 pt.
  const t = (n: number) => Math.max(4, n * size);
  return (
    <View style={{ width: k(BP_WIDTH), height: k(BP_HEIGHT), flexDirection: "row", borderRadius: k(10), overflow: "hidden", borderWidth: 0.8, borderColor: GOLD }}>
      <View style={{ width: "72%", backgroundColor: NAVY, padding: k(16) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: GOLD_SOFT, fontSize: t(9), fontFamily: "Helvetica-Bold", letterSpacing: k(2) }}>{(b.airline ?? "BOARDING PASS").toUpperCase()}</Text>
          <Text style={{ color: SOFT, fontSize: t(7), letterSpacing: k(1.5) }}>BOARDING PASS{b.direction ? ` · ${b.direction.toUpperCase()}` : ""}</Text>
        </View>
        <Text style={{ color: SOFT, fontSize: t(7), marginTop: k(8), letterSpacing: k(1) }}>
          PASSENGER <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold" }}>{passenger.toUpperCase()}</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: k(22) }}>
          <View>
            <Text style={{ color: SOFT, fontSize: t(7), letterSpacing: k(1.5) }}>FROM</Text>
            <Text style={{ color: "#ffffff", fontSize: k(34), fontFamily: "Times-Bold" }}>{b.fromAirport ?? "---"}</Text>
            {b.fromCity ? <Text style={{ color: "#dfe6f1", fontSize: t(9), fontFamily: "Helvetica-Bold" }}>{b.fromCity}</Text> : null}
          </View>
          <Text style={{ color: GOLD_SOFT, fontSize: k(16), marginHorizontal: k(18), marginBottom: k(8) }}>&gt;&gt;</Text>
          <View>
            <Text style={{ color: SOFT, fontSize: t(7), letterSpacing: k(1.5) }}>TO</Text>
            <Text style={{ color: "#ffffff", fontSize: k(34), fontFamily: "Times-Bold" }}>{b.toAirport ?? "---"}</Text>
            {b.toCity ? <Text style={{ color: "#dfe6f1", fontSize: t(9), fontFamily: "Helvetica-Bold" }}>{b.toCity}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: k(18) }}>
          {[
            ["FLIGHT", b.flightNumber ?? "-"],
            ["DATE", b.flightDate ? formatDate(b.flightDate) : "-"],
            ["SEAT", b.seat ?? "-"],
            ["PNR", b.bookingRef ?? "-"],
          ].map(([label, value]) => (
            <View key={label} style={{ marginRight: k(24) }}>
              <Text style={{ color: SOFT, fontSize: t(6.5), letterSpacing: k(1.2) }}>{label}</Text>
              <Text style={{ color: "#ffffff", fontSize: t(10), fontFamily: "Helvetica-Bold" }}>{value}</Text>
            </View>
          ))}
        </View>
        {size >= 0.7 && (
          <Text style={{ color: SOFT, fontSize: t(6.5), marginTop: k(10) }}>
            {tripLabel ? `Trip: ${tripLabel}` : "Current / upcoming trip"}
            {b.checkedIn ? "  ·  Checked in online" : ""}
          </Text>
        )}
      </View>
      <View style={{ width: "28%", backgroundColor: PAPER, padding: k(14), borderLeftWidth: 1.5, borderLeftColor: GOLD, borderStyle: "dashed" }}>
        <Text style={{ color: GOLD, fontSize: t(7), fontFamily: "Helvetica-Bold", letterSpacing: k(1.5) }}>STUB</Text>
        <Text style={{ color: NAVY, fontSize: k(16), fontFamily: "Times-Bold", marginTop: k(6) }}>{`${b.fromAirport ?? "---"} > ${b.toAirport ?? "---"}`}</Text>
        <Text style={{ color: MUTED, fontSize: t(8), marginTop: k(4) }}>{b.flightNumber ?? "-"}</Text>
        <Text style={{ color: MUTED, fontSize: t(8) }}>{b.flightDate ? formatDate(b.flightDate) : "-"}</Text>
        <Text style={{ color: MUTED, fontSize: t(8) }}>Seat {b.seat ?? "-"}</Text>
        <View style={{ flexDirection: "row", marginTop: "auto", height: k(34) }}>
          {Array.from({ length: 34 }, (_, i) => (
            <View key={i} style={{ width: k([1, 2, 1, 3, 1, 2][i % 6]), marginRight: k([2, 1, 3, 1, 2, 1][i % 6]), backgroundColor: INK }} />
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
