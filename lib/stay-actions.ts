"use server";

import { refresh } from "next/cache";
import { getDb } from "./db";
import { saveRestorePoint } from "./backup";
import { flash } from "./flash";
import { isUuid } from "./data";
import { STAY_KINDS } from "./stay-kinds";
import { isCountryCode } from "./countries";
import { requireAdmin, requireProfileAccess } from "./session";

const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const text = (form: FormData, key: string, max = 200) => {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

export type StaySaveState = { error?: string; ok?: string } | undefined;

/** "Read details from booking": fills the stay form from a booking confirmation PDF (free, no AI). */
export async function readStayDocument(
  profileId: string,
  form: FormData,
): Promise<{ error: string } | { ok: true; details: import("./stay-reader").StayDetails }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  await requireProfileAccess(profileId);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the booking confirmation first." };
  if (file.size > MAX_BYTES) return { error: "File is too large (max 8 MB)." };
  if (file.type !== "application/pdf") {
    return { error: "Only PDF confirmations can be read automatically. The photo is attached, so type the details and save." };
  }
  try {
    const { readStayPdf } = await import("./stay-reader");
    const details = await readStayPdf(new Uint8Array(await file.arrayBuffer()));
    if (details) return { ok: true, details };
  } catch (error) {
    console.error("Stay PDF reading failed:", error);
  }
  return { error: "Couldn't find booking details in this PDF. It is attached, so type the details and save." };
}

/** Adds (stayId = null) or updates a hotel / Airbnb stay, with an optional booking confirmation. Users: own record only. */
export async function saveStay(profileId: string, stayId: string | null, _: StaySaveState, form: FormData): Promise<StaySaveState> {
  if (!isUuid(profileId) || (stayId && !isUuid(stayId))) return { error: "Unknown record." };
  await requireProfileAccess(profileId);

  const name = text(form, "name", 160);
  if (!name) return { error: "Enter the hotel or home name." };
  const checkIn = text(form, "checkIn", 10);
  const checkOut = text(form, "checkOut", 10);
  if (checkIn && !isDate(checkIn)) return { error: "Check-in date is not valid." };
  if (checkOut && !isDate(checkOut)) return { error: "Check-out date is not valid." };
  if (checkIn && checkOut && checkOut < checkIn) return { error: "Check-out can't be before check-in." };
  const kindRaw = text(form, "kind", 40) ?? "Hotel";
  const code = text(form, "countryCode", 2)?.toUpperCase() ?? null;
  const ratingRaw = Number(text(form, "rating", 1));
  const tripRaw = text(form, "tripId", 40);

  const values = {
    tripId: tripRaw && isUuid(tripRaw) ? tripRaw : null,
    kind: (STAY_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "Other",
    name,
    countryCode: code && isCountryCode(code) ? code : null,
    city: text(form, "city", 120),
    address: text(form, "address", 300),
    checkIn,
    checkOut,
    bookingRef: text(form, "bookingRef", 40),
    link: (() => {
      const u = text(form, "link", 500);
      return u && /^https?:\/\//i.test(u) ? u : null;
    })(),
    rating: Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null,
    notes: text(form, "notes", 1000),
  };

  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!DOC_TYPES.includes(file.type)) return { error: "Booking file must be a PDF, PNG, JPG or WEBP." };
    if (file.size > MAX_BYTES) return { error: "File is too large (max 8 MB)." };
  }

  const sql = await getDb();
  if (values.tripId) {
    const [t] = await sql<{ countryCode: string }[]>`select trim(country_code) as country_code from trips where id = ${values.tripId} and profile_id = ${profileId}`;
    if (!t) values.tripId = null;
    else if (!values.countryCode) values.countryCode = t.countryCode;
  }
  // Not linked yet: put it under the trip whose dates include the check-in date.
  if (!values.tripId && values.checkIn) {
    const [match] = await sql<{ id: string; countryCode: string }[]>`
      select id, trim(country_code) as country_code from trips
      where profile_id = ${profileId} and departure_date <= ${values.checkIn}
        and coalesce(return_date, departure_date) >= ${values.checkIn}
        ${values.countryCode ? sql`and country_code = ${values.countryCode}` : sql``}
      order by departure_date desc limit 1`;
    if (match) {
      values.tripId = match.id;
      if (!values.countryCode) values.countryCode = match.countryCode;
    }
  }

  const fileValues = hasFile
    ? {
        fileName: (file as File).name.slice(0, 120) || "booking",
        mime: (file as File).type,
        size: (file as File).size,
        data: Buffer.from(await (file as File).arrayBuffer()),
      }
    : {};

  if (stayId) {
    const rows = await sql`update stays set ${sql({ ...values, ...fileValues })}, updated_at = now()
      where id = ${stayId} and profile_id = ${profileId} returning id`;
    if (!rows.length) return { error: "Stay not found." };
  } else {
    await sql`insert into stays ${sql({ ...values, ...fileValues, profileId })}`;
  }
  await sql`update profiles set updated_at = now() where id = ${profileId}`;
  await flash(stayId ? `${values.name} saved successfully` : `${values.name} added successfully`);
  refresh();
  return { ok: stayId ? "Stay updated." : "Stay added." };
}

/** Deleting is admin-only, like trips and visas; a restore point is saved first. */
export async function deleteStay(stayId: string) {
  const session = await requireAdmin();
  if (!isUuid(stayId)) return;
  const sql = await getDb();
  await saveRestorePoint(sql, { stayId }, "Deleted a hotel / Airbnb stay", session.email);
  await sql`delete from stays where id = ${stayId}`;
  await flash("Stay deleted successfully");
  refresh();
}
