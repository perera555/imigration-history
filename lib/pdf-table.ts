import "server-only";
import { getDocumentProxy } from "unpdf";
import { COUNTRIES, countryName } from "./countries";

/**
 * Reads a table-style immigration history PDF (Country | Visits | Departure | Return | Purpose [| Passport])
 * without any AI: text positions from the PDF are mapped to columns and rows.
 * Works for PDFs that contain real text (not scanned images).
 */

export type ParsedTrip = {
  countryCode: string;
  city: string | null;
  departureDate: string;
  returnDate: string | null;
  purpose: string;
  passportNumber: string | null;
  notes: string | null;
};
export type ParsedDocument = {
  profile: {
    fullName: string | null;
    dateOfBirth: null;
    sex: null;
    nationality: string | null;
    address: null;
    phone: null;
    email: null;
    passportNumber: string | null;
    previousPassports: string[];
  };
  trips: ParsedTrip[];
  issues: string[];
};

type Item = { order: number; x: number; text: string };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Names people commonly write that differ from the ISO list. Value: [code, city?]
const ALIASES: Record<string, [string, string?]> = {
  netherland: ["NL"], netherlands: ["NL"], holland: ["NL"],
  uk: ["GB"], "u k": ["GB"], england: ["GB"], scotland: ["GB"], wales: ["GB"], britain: ["GB"], "great britain": ["GB"],
  london: ["GB", "London"], manchester: ["GB", "Manchester"],
  dubai: ["AE", "Dubai"], "abu dhabi": ["AE", "Abu Dhabi"], sharjah: ["AE", "Sharjah"], uae: ["AE"], emirates: ["AE"],
  usa: ["US"], "u s a": ["US"], america: ["US"], "united states of america": ["US"],
  korea: ["KR"], "south korea": ["KR"], russia: ["RU"], vietnam: ["VN"], "viet nam": ["VN"], laos: ["LA"],
  "hong kong": ["HK"], macau: ["MO"], taiwan: ["TW"], iran: ["IR"], syria: ["SY"], turkey: ["TR"], turkiye: ["TR"],
  "czech republic": ["CZ"], "saudi": ["SA"], ksa: ["SA"], singapore: ["SG"], maldives: ["MV"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const BY_NAME = new Map(COUNTRIES.map((c) => [norm(c.name), c.code]));

function matchCountry(raw: string): { code: string; city: string | null } | null {
  const paren = raw.match(/^(.*?)\(([^)]*)\)\s*$/); // e.g. "Uk(London)"
  const base = norm(paren ? paren[1] : raw);
  const cityInParens = paren ? paren[2].trim() : null;
  if (!base) return null;
  const alias = ALIASES[base];
  if (alias) return { code: alias[0], city: cityInParens ?? alias[1] ?? null };
  const code = BY_NAME.get(base);
  return code ? { code, city: cityInParens } : null;
}

type DateParts = { d: number; m: number; y: number | null };

function findDates(text: string): DateParts[] {
  const out: DateParts[] = [];
  const named = /(\d{1,2})(?:st|nd|rd|th)?[\s\-./]*([A-Za-z]{3,9})\.?(?:[\s\-./,]+(\d{4}))?/g;
  for (const m of text.matchAll(named)) {
    const month = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (month) out.push({ d: Number(m[1]), m: month, y: m[3] ? Number(m[3]) : null });
  }
  if (out.length) return out;
  for (const m of text.matchAll(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g)) {
    out.push({ d: Number(m[1]), m: Number(m[2]), y: Number(m[3]) });
  }
  return out;
}

const iso = (p: DateParts, year: number) =>
  `${year}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
const pretty = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

async function readItems(bytes: Uint8Array): Promise<Item[][]> {
  const pdf = await getDocumentProxy(bytes);
  const pages: Item[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { items } = await page.getTextContent();
    const list: Item[] = [];
    for (const it of items as { str?: string; transform?: number[] }[]) {
      const text = it.str?.trim();
      if (!text || !it.transform) continue;
      // order: page by page, top to bottom
      list.push({ order: p * 10000 + (5000 - it.transform[5]), x: it.transform[4], text });
    }
    pages.push(list);
  }
  return pages;
}

export async function parseHistoryPdf(bytes: Uint8Array): Promise<ParsedDocument> {
  const pages = await readItems(bytes);
  const all = pages.flat();
  const issues: string[] = [];

  // ---- profile: "…History- P TD Perera" and "Passport Numbers-(A,B,C)"
  let fullName: string | null = null;
  let passports: string[] = [];
  for (const it of all.slice(0, 40)) {
    const name = it.text.match(/history\s*[-–:]\s*(.+)$/i);
    if (name && !fullName) fullName = name[1].trim();
    const pp = it.text.match(/passport\s*(?:numbers?|nos?\.?)\s*[-–:]*\s*\(?([A-Z0-9,\s/]+)\)?/i);
    if (pp && !passports.length) passports = pp[1].split(/[,\s/]+/).map((s) => s.trim().toUpperCase()).filter((s) => s.length >= 5);
  }

  // ---- header → column x positions
  const header = all.find((it) => /^country$/i.test(it.text));
  if (!header) throw new Error("NO_TABLE");
  const sameRow = (it: Item) => Math.abs(it.order - header.order) < 4;
  const colX = (re: RegExp) => all.find((it) => sameRow(it) && re.test(it.text))?.x;
  const columns = [
    { key: "country", x: header.x },
    { key: "visits", x: colX(/no\.?\s*of|visits?/i) },
    { key: "dep", x: colX(/departure|depart|from date|left/i) },
    { key: "ret", x: colX(/return|arrival|arrived|back/i) },
    { key: "purpose", x: colX(/purpose|reason/i) },
    { key: "passport", x: colX(/passport/i) },
  ].filter((c): c is { key: string; x: number } => typeof c.x === "number").sort((a, b) => a.x - b.x);
  if (!columns.some((c) => c.key === "dep")) throw new Error("NO_TABLE");

  const columnOf = (x: number) => {
    let found = columns[0].key;
    for (const c of columns) if (x >= c.x - 6) found = c.key;
    return found;
  };

  // body = everything after the header row (header labels like "visits" may sit a line lower)
  const body = all.filter((it) => it.order > header.order + 20).sort((a, b) => a.order - b.order);
  const col = (key: string) => body.filter((it) => columnOf(it.x) === key);

  // ---- countries (joining names split over two lines, e.g. "New" + "Zealand")
  const countries: { order: number; code: string; city: string | null; label: string }[] = [];
  let buffer: { text: string; order: number } | null = null;
  for (const it of col("country")) {
    if (/^\d+$/.test(it.text)) continue;
    const joined: string = buffer ? `${buffer.text} ${it.text}` : it.text;
    const hitJoined = buffer ? matchCountry(joined) : null;
    if (hitJoined) {
      countries.push({ order: buffer!.order, ...hitJoined, label: countryName(hitJoined.code) });
      buffer = null;
      continue;
    }
    const hit = matchCountry(it.text);
    if (hit) {
      countries.push({ order: it.order, ...hit, label: hit.city ? `${countryName(hit.code)} (${hit.city})` : countryName(hit.code) });
      buffer = null;
    } else {
      buffer = buffer ? { text: joined, order: buffer.order } : { text: it.text, order: it.order };
    }
  }
  if (!countries.length) throw new Error("NO_TABLE");

  const deps = col("dep");
  const rets = col("ret");
  const purposes = col("purpose");
  const passportCol = col("passport");
  const trips: ParsedTrip[] = [];
  let previous: { label: string; visits: ParsedTrip[] } | null = null;

  countries.forEach((c, i) => {
    const start = c.order - 3;
    const end = i + 1 < countries.length ? countries[i + 1].order - 3 : Infinity;
    const inRange = (it: Item) => it.order >= start && it.order < end;
    const myDeps = deps.filter((it) => inRange(it) && findDates(it.text).length);
    const visits: ParsedTrip[] = [];

    myDeps.forEach((dep, k) => {
      const nextDep = k + 1 < myDeps.length ? myDeps[k + 1].order - 3 : end;
      const near = (list: Item[]) =>
        list.filter((it) => it.order >= dep.order - 3 && it.order < nextDep).map((it) => it.text).join(" ");
      const notes: string[] = [];
      const depParts = findDates(dep.text)[0];
      const depYear = depParts.y ?? new Date().getFullYear();
      const departureDate = iso(depParts, depYear);

      const retText = near(rets);
      const retDates = findDates(retText);
      let returnDate: string | null = null;
      if (retDates.length) {
        const r = retDates[retDates.length - 1];
        let year = r.y ?? depYear;
        if (!r.y) {
          notes.push(`Return year missing in document ("${retText}"); assumed ${year}.`);
          issues.push(`${c.label}: return year missing ("${retText}"); assumed ${year}.`);
        }
        if (iso(r, year) < departureDate) {
          year += 1;
          const fix = `Return date "${retText}" was before departure; corrected to ${pretty(iso(r, year))}.`;
          notes.push(fix);
          issues.push(`${c.label}: ${fix}`);
        }
        if (retDates.length > 1) {
          notes.push(`Document shows "${retText}"; used ${pretty(iso(r, year))}.`);
          issues.push(`${c.label}: two return dates ("${retText}"); please check which is right.`);
        }
        returnDate = iso(r, year);
      }

      visits.push({
        countryCode: c.code,
        city: c.city,
        departureDate,
        returnDate,
        purpose: near(purposes).trim(),
        passportNumber: near(passportCol).match(/[A-Z]{1,2}\d{5,9}/i)?.[0].toUpperCase() ?? null,
        notes: notes.length ? notes.join(" ") : null,
      });
    });

    if (!visits.length && previous) {
      // Countries listed together in one row (e.g. Netherlands / Belgium / France) share that row's journey.
      for (const v of previous.visits) {
        visits.push({ ...v, countryCode: c.code, city: c.city, notes: `Same journey as ${previous.label}.` });
      }
      if (visits.length) issues.push(`${c.label}: no own dates in the document; used the dates of ${previous.label} (same row).`);
    }
    if (!visits.length) issues.push(`${c.label}: no dates found.`);
    trips.push(...visits);
    if (myDeps.length) previous = { label: c.label, visits };
  });

  if (passports.length > 1) {
    issues.push(`Passport numbers found: ${passports.join(", ")}. The first is used as the current passport; please confirm.`);
  }

  return {
    profile: {
      fullName,
      dateOfBirth: null,
      sex: null,
      nationality: null,
      address: null,
      phone: null,
      email: null,
      passportNumber: passports[0] ?? null,
      previousPassports: passports.slice(1, 11),
    },
    trips,
    issues,
  };
}
