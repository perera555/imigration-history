"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid } from "./data";
import { requireAdmin, requireProfileAccess } from "./session";
import type { BoardingDetails } from "./boarding-reader";

const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const text = (form: FormData, key: string, max = 120) => {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

export type BoardingReadState = { error: string } | { ok: true; details: BoardingDetails } | undefined;

/** "Read details" on a boarding pass PDF (free, no AI); photos need the optional AI key. */
export async function readBoardingPass(profileId: string, form: FormData): Promise<BoardingReadState> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the boarding pass first." };
  if (!DOC_TYPES.includes(file.type)) return { error: "Upload a PDF, PNG, JPG or WEBP file." };
  if (file.size > MAX_BYTES) return { error: "File is too large (max 8 MB)." };
  if (file.type !== "application/pdf") {
    return { error: "Photos can't be read automatically yet. The photo is attached, so fill in the flight details and save." };
  }
  try {
    const { readBoardingPdf } = await import("./boarding-reader");
    const details = await readBoardingPdf(new Uint8Array(await file.arrayBuffer()));
    if (details && Object.values(details).some((v) => v !== null)) return { ok: true, details };
  } catch (error) {
    console.error("Boarding pass reading failed:", error);
  }
  return { error: "Couldn't find flight details in this PDF. It is attached, so fill in the details and save." };
}

export type BoardingSaveState = { error?: string; ok?: string } | undefined;

/** Adds (passId = null) or updates a boarding pass, with optional file. Users: own record only. */
export async function saveBoardingPass(
  profileId: string,
  passId: string | null,
  _: BoardingSaveState,
  form: FormData,
): Promise<BoardingSaveState> {
  if (!isUuid(profileId) || (passId && !isUuid(passId))) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const tripId = text(form, "tripId", 40);
  const flightDate = text(form, "flightDate", 10);
  if (flightDate && !isDate(flightDate)) return { error: "Flight date is not valid." };

  const values = {
    tripId: tripId && isUuid(tripId) ? tripId : null,
    direction: text(form, "direction", 20),
    airline: text(form, "airline", 80),
    flightNumber: text(form, "flightNumber", 12)?.toUpperCase().replace(/\s+/g, "") ?? null,
    fromAirport: text(form, "fromAirport", 40)?.toUpperCase() ?? null,
    toAirport: text(form, "toAirport", 40)?.toUpperCase() ?? null,
    flightDate,
    seat: text(form, "seat", 6)?.toUpperCase() ?? null,
    bookingRef: text(form, "bookingRef", 12)?.toUpperCase() ?? null,
    notes: text(form, "notes", 500),
    checkinUrl: (() => {
      const u = text(form, "checkinUrl", 500);
      return u && /^https?:\/\//i.test(u) ? u : null;
    })(),
    checkedIn: form.get("checkedIn") === "on",
  };

  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!DOC_TYPES.includes(file.type)) return { error: "File must be a PDF, PNG, JPG or WEBP." };
    if (file.size > MAX_BYTES) return { error: "File is too large (max 8 MB)." };
  }
  if (!passId && !hasFile && !values.flightNumber) return { error: "Upload the boarding pass or enter the flight number." };

  const sql = await getDb();
  if (values.tripId) {
    const ok = await sql`select 1 from trips where id = ${values.tripId} and profile_id = ${profileId}`;
    if (!ok.length) values.tripId = null;
  }
  // Not linked yet: put it under the trip whose departure or return date is the flight date.
  if (!values.tripId && values.flightDate) {
    const [match] = await sql<{ id: string; departureDate: string }[]>`select id, departure_date from trips
      where profile_id = ${profileId} and (departure_date = ${values.flightDate} or return_date = ${values.flightDate})
      order by departure_date limit 1`;
    if (match) {
      values.tripId = match.id;
      if (!values.direction) values.direction = match.departureDate === values.flightDate ? "Departure" : "Return";
    }
  }
  // Same flight on the same date = the same boarding pass; don't add it twice.
  if (!passId && values.flightNumber && values.flightDate) {
    const dup = await sql`select 1 from boarding_passes where profile_id = ${profileId}
      and flight_number = ${values.flightNumber} and flight_date = ${values.flightDate}`;
    if (dup.length) return { error: `Boarding pass for ${values.flightNumber} on ${values.flightDate} is already added.` };
  }
  const fileValues = hasFile
    ? {
        fileName: (file as File).name.slice(0, 120) || "boarding-pass",
        mime: (file as File).type,
        size: (file as File).size,
        data: Buffer.from(await (file as File).arrayBuffer()),
      }
    : {};

  if (passId) {
    const rows = await sql`update boarding_passes set ${sql({ ...values, ...fileValues })}, updated_at = now()
      where id = ${passId} and profile_id = ${profileId} returning id`;
    if (!rows.length) return { error: "Boarding pass not found." };
  } else {
    await sql`insert into boarding_passes ${sql({ ...values, ...fileValues, profileId })}`;
  }
  await flash(passId ? "Boarding pass saved successfully" : "Boarding pass added successfully");
  refresh();
  return { ok: passId ? "Boarding pass updated." : "Boarding pass added." };
}

/** Deleting is admin-only, like trips and visas. */
export async function deleteBoardingPass(passId: string) {
  const session = await requireAdmin();
  if (!isUuid(passId)) return;
  const sql = await getDb();
  await saveRestorePoint(sql, { passId }, "Deleted a boarding pass", session.email);
  await sql`delete from boarding_passes where id = ${passId}`;
  await flash("Boarding pass deleted successfully");
  refresh();
}
