import type { BoardingPass } from "./data";

/** Real boarding pass size 203 x 83 mm at 300 dpi. */
const W = 2398;
const H = 980;

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";

/** Draws the boarding pass onto a canvas and downloads it as PNG or JPEG (browser only). */
export async function downloadBoardingPassImage(p: BoardingPass, holder: string, type: "png" | "jpeg", tripLabel?: string) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const stubX = Math.round(W * 0.72);
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "Arial, Helvetica, sans-serif";

  // Main part (navy)
  const grad = g.createLinearGradient(0, 0, stubX, H);
  grad.addColorStop(0, "#14284b");
  grad.addColorStop(1, "#0b1a33");
  g.fillStyle = grad;
  g.fillRect(0, 0, stubX, H);
  // Stub (cream)
  g.fillStyle = "#f8f3e6";
  g.fillRect(stubX, 0, W - stubX, H);
  // Perforation
  g.strokeStyle = "#b9a67a";
  g.lineWidth = 6;
  g.setLineDash([24, 18]);
  g.beginPath();
  g.moveTo(stubX, 30);
  g.lineTo(stubX, H - 30);
  g.stroke();
  g.setLineDash([]);

  const text = (s: string, x: number, y: number, size: number, color: string, font = sans, weight = "normal", maxW?: number) => {
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color;
    g.fillText(s, x, y, maxW);
  };
  const label = (s: string, x: number, y: number, color = "rgba(255,255,255,0.55)") => text(s.toUpperCase(), x, y, 34, color, sans, "bold");

  const pad = 90;
  text(`✈ ${(p.airline || "Boarding pass").toUpperCase()}`, pad, 130, 52, "#e9d9a8", sans, "bold", stubX - pad * 2 - 520);
  g.textAlign = "right";
  text(`BOARDING PASS${p.direction ? ` · ${p.direction.toUpperCase()}` : ""}`, stubX - pad, 130, 36, "rgba(255,255,255,0.65)", sans, "bold");
  g.textAlign = "left";
  label("Passenger", pad, 230);
  text(holder.toUpperCase() || "—", pad + 230, 230, 40, "#ffffff", sans, "bold", stubX - pad * 2 - 230);

  label("From", pad, 360);
  text(p.fromAirport || "---", pad, 520, 170, "#ffffff", serif, "bold");
  text("✈", pad + 470, 500, 100, "#e9d9a8");
  label("To", pad + 640, 360);
  text(p.toAirport || "---", pad + 640, 520, 170, "#ffffff", serif, "bold");

  const cols: [string, string][] = [
    ["Flight", p.flightNumber || "—"],
    ["Date", fmt(p.flightDate)],
    ["Seat", p.seat || "—"],
    ["PNR", p.bookingRef || "—"],
  ];
  // Relative column widths: the date needs the most room.
  const weights = [0.8, 1.5, 0.6, 1.1];
  const unit = (stubX - pad * 2) / weights.reduce((a, b) => a + b, 0);
  let cx = pad;
  cols.forEach(([k, v], i) => {
    const w = weights[i] * unit;
    label(k, cx, 680);
    text(v, cx, 750, 48, "#ffffff", sans, "bold", w - 40);
    cx += w;
  });
  if (tripLabel) text(`Trip: ${tripLabel}`, pad, 870, 34, "rgba(255,255,255,0.6)", sans, "normal", stubX - pad * 2);
  if (p.checkedIn) text("✓ Checked in online", stubX - pad - 420, 870, 36, "#86efac", sans, "bold");

  // Stub
  const sx = stubX + 70;
  const sw = W - stubX - 140;
  label("Stub", sx, 130, "#b08d3c");
  text(`${p.fromAirport || "---"} → ${p.toAirport || "---"}`, sx, 250, 84, "#14284b", serif, "bold", sw);
  text(`${p.flightNumber || "—"} · ${fmt(p.flightDate)}`, sx, 330, 38, "#5b6475", sans, "normal", sw);
  text(`Seat ${p.seat || "—"}`, sx, 390, 38, "#5b6475");
  // Barcode bars (decorative)
  g.fillStyle = "#14284b";
  let x = sx;
  let seed = [...(p.id || "x")].reduce((a, ch) => a + ch.charCodeAt(0), 7);
  while (x < sx + sw) {
    seed = (seed * 9301 + 49297) % 233280;
    const bw = 4 + (seed % 4) * 4;
    g.fillRect(x, 700, bw, 200);
    x += bw + 6 + (seed % 3) * 4;
  }

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type === "png" ? "image/png" : "image/jpeg", 0.92));
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const name = [p.flightNumber, p.fromAirport && p.toAirport ? `${p.fromAirport}-${p.toAirport}` : "", p.flightDate].filter(Boolean).join("_") || "boarding-pass";
  a.download = `boarding-pass_${name}.${type === "png" ? "png" : "jpg"}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
