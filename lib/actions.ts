"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { ensureFirstAdmin, getDb } from "./db";
import { isUuid } from "./data";
import { isCountryCode } from "./countries";
import {
  canAccessProfile,
  createSession,
  deleteSession,
  requireAdmin,
  requireAuth,
  requireProfileAccess,
} from "./session";
import { hashPassword, newResetToken, sha256, validatePassword, verifyPassword } from "./password";
import { sendEmail } from "./email";
import { saveRestorePoint } from "./backup";

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_PREVIOUS_PASSPORTS = 10;

const text = (form: FormData, key: string, max = 500) => {
  const value = String(form.get(key) ?? "").trim();
  return value ? value.slice(0, max) : null;
};
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// ---------------- auth ----------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A real hash so failed logins for unknown emails take the same time as known ones.
const DUMMY_HASH =
  "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

type AdminRow = { id: string; email: string; passwordHash: string; role: string };

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const sql = await getDb();
  await ensureFirstAdmin(sql); // recreates the owner account if no admin exists
  const [admin] = await sql<AdminRow[]>`select id, email, password_hash, role from admins where email = ${email}`;
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) return { error: "Incorrect email or password." };

  await createSession({ adminId: admin.id, email: admin.email }, form.get("remember") === "on");
  redirect(admin.role === "admin" ? "/admin" : "/account");
}

/** Public sign-up: creates a user account plus their own empty travel record. */
export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name", 160);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  if (!name) return { error: "Enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const problem = validatePassword(password);
  if (problem) return { error: problem };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const sql = await getDb();
  const passwordHash = await hashPassword(password);
  const accountId = await sql.begin(async (tx) => {
    const exists = await tx`select 1 from admins where email = ${email}`;
    if (exists.length) return null;
    const [profile] = await tx<{ id: string }[]>`
      insert into profiles (full_name, email) values (${name}, ${email}) returning id`;
    const [account] = await tx<{ id: string }[]>`
      insert into admins (email, name, password_hash, role, profile_id)
      values (${email}, ${name}, ${passwordHash}, 'user', ${profile.id}) returning id`;
    return account.id;
  });
  if (!accountId) return { error: "An account with that email already exists. Sign in instead." };

  await createSession({ adminId: accountId, email }, true);
  redirect("/account?welcome=1");
}

/** Change the signed-in account's own password. */
export async function changeOwnPassword(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireAuth();
  const current = String(form.get("currentPassword") ?? "");
  const password = String(form.get("password") ?? "");
  const problem = validatePassword(password);
  if (problem) return { error: problem };
  const sql = await getDb();
  const [row] = await sql<{ passwordHash: string }[]>`select password_hash from admins where id = ${session.adminId}`;
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: "Current password is incorrect." };
  await sql`update admins set password_hash = ${await hashPassword(password)} where id = ${session.adminId}`;
  return { ok: "Password changed." };
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const generic = { ok: "If that email has an account, a reset link has been sent. It expires in 1 hour." };

  const sql = await getDb();
  const [admin] = await sql<{ id: string }[]>`select id from admins where email = ${email}`;
  if (!admin) return generic;

  const { token, tokenHash } = newResetToken();
  await sql`delete from password_resets where admin_id = ${admin.id} or expires_at < now()`;
  await sql`insert into password_resets (token_hash, admin_id, expires_at)
            values (${tokenHash}, ${admin.id}, now() + interval '1 hour')`;

  const h = await headers();
  const origin =
    process.env.APP_URL ||
    h.get("origin") ||
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;

  const sent = await sendEmail(
    email,
    "Reset your Immigration History password",
    `<div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="color:#0b1f3a">Reset your password</h2>
      <p>Someone asked to reset the password for your Immigration History account.</p>
      <p><a href="${link}" style="display:inline-block;background:#0b1f3a;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Choose a new password</a></p>
      <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't ask for this, ignore this email.</p>
    </div>`,
  );
  if (!sent) {
    if (process.env.NODE_ENV !== "production") console.log(`[dev] Password reset link for ${email}: ${link}`);
    return {
      error:
        "Email sending is not set up on this server (RESEND_API_KEY missing). Ask an admin to reset your password from the admin panel.",
    };
  }
  return generic;
}

export async function resetPassword(token: string, _: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const problem = validatePassword(password);
  if (problem) return { error: problem };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const sql = await getDb();
  const [reset] = await sql<{ adminId: string }[]>`
    update password_resets set used_at = now()
    where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
    returning admin_id`;
  if (!reset) return { error: "This reset link is invalid or has expired. Request a new one." };

  await sql`update admins set password_hash = ${await hashPassword(password)} where id = ${reset.adminId}`;
  await sql`delete from password_resets where admin_id = ${reset.adminId}`;
  redirect("/login?reset=1");
}

// ---------------- admins ----------------

export async function addAdmin(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = text(form, "name", 100) ?? "";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const problem = validatePassword(password);
  if (problem) return { error: problem };

  const sql = await getDb();
  const rows = await sql`
    insert into admins (email, name, password_hash, role)
    values (${email}, ${name}, ${await hashPassword(password)}, 'admin')
    on conflict (email) do nothing returning id`;
  if (!rows.length) return { error: "An account with that email already exists." };
  refresh();
  return { ok: `Admin ${email} added.` };
}

export async function setAdminPassword(adminId: string, _: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  if (!isUuid(adminId)) return { error: "Unknown admin." };
  const password = String(form.get("password") ?? "");
  const problem = validatePassword(password);
  if (problem) return { error: problem };
  const sql = await getDb();
  const rows = await sql`update admins set password_hash = ${await hashPassword(password)} where id = ${adminId} returning id`;
  if (!rows.length) return { error: "Admin not found." };
  return { ok: "Password updated." };
}

export async function deleteAdmin(adminId: string) {
  const session = await requireAdmin();
  if (!isUuid(adminId) || adminId === session.adminId) return; // can't remove yourself
  const sql = await getDb();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(724520)`;
    const [target] = await tx<{ role: string }[]>`select role from admins where id = ${adminId}`;
    if (!target) return;
    const [{ count }] = await tx<{ count: number }[]>`select count(*)::int as count from admins where role = 'admin'`;
    // Users can always be removed; an admin only while another admin remains.
    if (target.role !== "admin" || count > 1) {
      await saveRestorePoint(tx, { adminId }, "Removed an account", session.email);
      await tx`delete from admins where id = ${adminId}`;
    }
  });
  refresh();
}

// ---------------- profiles ----------------

const MAX_PHOTO_CHARS = 900_000; // ~650 KB image; the client resizes well below this

function readProfile(form: FormData) {
  const fullName = text(form, "fullName", 160);
  const dateOfBirth = text(form, "dateOfBirth", 10);
  const email = text(form, "email", 200);
  const photo = text(form, "photo", MAX_PHOTO_CHARS + 1);
  const previousPassports = form
    .getAll("previousPassports")
    .flatMap((v) => String(v).split(/[\s,;]+/))
    .map((p) => p.trim().toUpperCase().slice(0, 30))
    .filter(Boolean)
    .slice(0, MAX_PREVIOUS_PASSPORTS);

  if (!fullName) return { error: "Full name is required." } as const;
  if (dateOfBirth && !isDate(dateOfBirth)) return { error: "Date of birth is not a valid date." } as const;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email address looks invalid." } as const;
  if (photo && (!photo.startsWith("data:image/") || photo.length > MAX_PHOTO_CHARS)) {
    return { error: "Photo must be an image under ~650 KB." } as const;
  }
  const passportIssueDate = text(form, "passportIssueDate", 10);
  const passportExpiryDate = text(form, "passportExpiryDate", 10);
  if (passportIssueDate && !isDate(passportIssueDate)) return { error: "Passport issue date is not valid." } as const;
  if (passportExpiryDate && !isDate(passportExpiryDate)) return { error: "Passport expiry date is not valid." } as const;
  if (passportIssueDate && passportExpiryDate && passportExpiryDate <= passportIssueDate) {
    return { error: "Passport expiry date must be after the issue date." } as const;
  }

  return {
    values: {
      fullName,
      dateOfBirth,
      sex: text(form, "sex", 20),
      nationality: text(form, "nationality", 80),
      nationalId: text(form, "nationalId", 40)?.toUpperCase() ?? null,
      address: text(form, "address", 400),
      phone: text(form, "phone", 40),
      email,
      passportNumber: text(form, "passportNumber", 30)?.toUpperCase() ?? null,
      passportIssueDate,
      passportExpiryDate,
      previousPassports,
      photo,
    },
  } as const;
}

export async function createProfile(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = readProfile(form);
  if ("error" in parsed) return { error: parsed.error };
  const sql = await getDb();
  const [row] = await sql<{ id: string }[]>`insert into profiles ${sql(parsed.values)} returning id`;
  redirect(`/admin/profiles/${row.id}?created=1`);
}

export async function updateProfile(id: string, _: FormState, form: FormData): Promise<FormState> {
  if (!isUuid(id)) return { error: "Unknown profile." };
  await requireProfileAccess(id);
  const parsed = readProfile(form);
  if ("error" in parsed) return { error: parsed.error };
  const sql = await getDb();
  const values = parsed.values;
  await sql`update profiles set ${sql(values)}, updated_at = now() where id = ${id}`;
  refresh();
  return { ok: "Profile saved." };
}

export async function deleteProfile(id: string) {
  const session = await requireAdmin();
  if (!isUuid(id)) return;
  const sql = await getDb();
  const [p] = await sql<{ fullName: string }[]>`select full_name from profiles where id = ${id}`;
  if (!p) return;
  await saveRestorePoint(sql, { profileId: id }, `Deleted traveller ${p.fullName || "(no name)"} (with all trips, visas, boarding passes)`, session.email);
  await sql`delete from profiles where id = ${id}`;
  redirect("/admin");
}

// ---------------- trips ----------------

function readTrip(form: FormData) {
  const countryCode = text(form, "countryCode", 2)?.toUpperCase() ?? null;
  const departureDate = text(form, "departureDate", 10);
  const returnDate = text(form, "returnDate", 10);

  if (!countryCode || !isCountryCode(countryCode)) return { error: "Please choose a country." } as const;
  if (!isDate(departureDate)) return { error: "Departure date is required." } as const;
  if (returnDate && !isDate(returnDate)) return { error: "Return date is not a valid date." } as const;
  if (returnDate && departureDate && returnDate < departureDate) {
    return { error: "Return date cannot be before the departure date." } as const;
  }

  return {
    values: {
      countryCode,
      city: text(form, "city", 120),
      departureDate: departureDate!,
      returnDate,
      purpose: text(form, "purpose", 200) ?? "",
      passportNumber: text(form, "passportNumber", 30)?.toUpperCase() ?? null,
      notes: text(form, "notes", 1000),
    },
  } as const;
}

export async function addTrip(profileId: string, _: FormState, form: FormData): Promise<FormState> {
  if (!isUuid(profileId)) return { error: "Unknown profile." };
  await requireProfileAccess(profileId);
  const parsed = readTrip(form);
  if ("error" in parsed) return { error: parsed.error };
  const sql = await getDb();
  const { countryCode, departureDate, returnDate } = parsed.values;
  const dup = await sql`
    select 1 from trips where profile_id = ${profileId} and trim(country_code) = ${countryCode}
      and departure_date = ${departureDate} and return_date is not distinct from ${returnDate}`;
  if (dup.length) return { error: "This visit is already in the record." };
  await sql`insert into trips ${sql({ ...parsed.values, profileId })}`;
  refresh();
  return { ok: "Trip added." };
}

export async function updateTrip(tripId: string, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireAuth(); // users: own record only (checked below)
  if (!isUuid(tripId)) return { error: "Unknown trip." };
  const parsed = readTrip(form);
  if ("error" in parsed) return { error: parsed.error };
  const sql = await getDb();
  const [owner] = await sql<{ profileId: string }[]>`select profile_id from trips where id = ${tripId}`;
  if (!owner || !canAccessProfile(session, owner.profileId)) return { error: "Trip not found." };
  const [row] = await sql<{ profileId: string }[]>`
    update trips set ${sql(parsed.values)} where id = ${tripId} returning profile_id`;
  if (!row) return { error: "Trip not found." };
  await sql`update profiles set updated_at = now() where id = ${row.profileId}`;
  redirect(`/admin/profiles/${row.profileId}#trips`);
}

// ---------------- import from document ----------------

export type ImportTrip = {
  /** Existing trip id when editing (Update form); absent for new visits. */
  id?: string | null;
  countryCode: string;
  city: string | null;
  departureDate: string;
  returnDate: string | null;
  purpose: string;
  passportNumber: string | null;
  notes: string | null;
  /** Hotel / Airbnb home stayed on this visit, e.g. "PJ Watergate". */
  stayedAt?: string | null;
};
export type ImportProfile = {
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  nationality: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  passportNumber: string | null;
  previousPassports: string[];
  photo?: string | null;
  nationalId?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
};
export type ExtractState =
  | { error: string }
  | { ok: true; profile: ImportProfile; trips: ImportTrip[]; issues: string[] }
  | undefined;

const ALLOWED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_DOC_BYTES = 10 * 1024 * 1024;

export async function readDocument(_: ExtractState, form: FormData): Promise<ExtractState> {
  await requireAuth();
  const file = form.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF or image to upload." };
  if (!ALLOWED_DOC_TYPES.includes(file.type)) return { error: "Upload a PDF, PNG, JPG or WEBP file." };
  if (file.size > MAX_DOC_BYTES) return { error: "File is too large (max 10 MB)." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf";

  // 1. Table-style PDFs are read directly (free, no AI key needed).
  if (isPdf) {
    try {
      const { parseHistoryPdf } = await import("./pdf-table");
      const parsed = await parseHistoryPdf(new Uint8Array(bytes));
      if (parsed.trips.length) return { ok: true, profile: parsed.profile, trips: parsed.trips, issues: parsed.issues };
    } catch (error) {
      if (!(error instanceof Error && error.message === "NO_TABLE")) console.error("PDF table reading failed:", error);
    }
  }

  // 2. Other documents (photos, letters, scanned PDFs) need the optional AI reader.
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error: isPdf
        ? "Couldn't find a travel table in this PDF (it needs columns like Country, Departure Date, Return Date, Purpose). Please enter the data in the form below."
        : "Photos can't be read automatically on this server yet. Upload the PDF version, or enter the data in the form below.",
    };
  }
  try {
    const { extractFromDocument } = await import("./extract");
    const data = await extractFromDocument(bytes, file.type);
    const trips = data.trips.map((t) => ({ ...t, countryCode: t.countryCode.toUpperCase() }));
    return { ok: true, profile: data.profile, trips, issues: data.issues };
  } catch (error) {
    console.error("Document extraction failed:", error);
    return { error: "Could not read this document. Try a clearer PDF or photo, or enter the data manually." };
  }
}

function cleanTrip(t: ImportTrip): { error: string } | { values: ImportTrip } {
  const countryCode = String(t.countryCode ?? "").toUpperCase();
  const dep = String(t.departureDate ?? "");
  const ret = t.returnDate ? String(t.returnDate) : null;
  if (!isCountryCode(countryCode)) return { error: `Unknown country code "${countryCode}".` };
  if (!isDate(dep)) return { error: `Invalid departure date for ${countryCode}.` };
  if (ret && (!isDate(ret) || ret < dep)) return { error: `Return date for ${countryCode} (${dep}) is invalid or before departure.` };
  const s = (v: unknown, max: number) => (v ? String(v).trim().slice(0, max) || null : null);
  return {
    values: {
      countryCode,
      city: s(t.city, 120),
      departureDate: dep,
      returnDate: ret,
      purpose: s(t.purpose, 200) ?? "",
      passportNumber: s(t.passportNumber, 30)?.toUpperCase() ?? null,
      notes: s(t.notes, 1000),
      stayedAt: s(t.stayedAt, 200),
    },
  };
}

function profileValuesFrom(p: ImportProfile) {
  const s = (v: unknown, max: number) => (v ? String(v).trim().slice(0, max) || null : null);
  const dob = s(p.dateOfBirth, 10);
  const email = s(p.email, 200);
  return {
    fullName: s(p.fullName, 160),
    dateOfBirth: dob && isDate(dob) ? dob : null,
    sex: s(p.sex, 20),
    nationality: s(p.nationality, 80),
    address: s(p.address, 400),
    phone: s(p.phone, 40),
    email: email && EMAIL_RE.test(email) ? email : null,
    passportNumber: s(p.passportNumber, 30)?.toUpperCase() ?? null,
    nationalId: s(p.nationalId, 40)?.toUpperCase() ?? null,
    passportIssueDate: p.passportIssueDate && isDate(p.passportIssueDate) ? p.passportIssueDate : null,
    passportExpiryDate: p.passportExpiryDate && isDate(p.passportExpiryDate) ? p.passportExpiryDate : null,
    previousPassports: (p.previousPassports ?? [])
      .map((x) => String(x).trim().toUpperCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, MAX_PREVIOUS_PASSPORTS),
    photo:
      typeof p.photo === "string" && p.photo.startsWith("data:image/") && p.photo.length <= MAX_PHOTO_CHARS
        ? p.photo
        : null,
  };
}

/**
 * Update button: replaces the whole record with the edited form (card details + every visit).
 * Visits keep their id when edited; visits removed from the form are deleted. Users: own record only.
 */
export async function updateRecord(
  profileId: string,
  payload: { profile: ImportProfile; trips: ImportTrip[] },
  /** "card" saves only the travel card, "record" only the visits, "all" both. */
  part: "card" | "record" | "all" = "all",
): Promise<{ error: string } | { profileId: string; skipped?: number }> {
  if (!isUuid(profileId)) return { error: "Unknown record." };
  const session = await requireProfileAccess(profileId);
  const values = profileValuesFrom(payload.profile);
  if (part !== "record" && !values.fullName) return { error: "Full name is required." };
  if (values.passportIssueDate && values.passportExpiryDate && values.passportExpiryDate <= values.passportIssueDate) {
    return { error: "Passport expiry date must be after the issue date." };
  }
  const trips: (ImportTrip & { id: string | null })[] = [];
  const seen = new Set<string>();
  let merged = 0;
  for (const trip of payload.trips.slice(0, 500)) {
    const cleaned = cleanTrip(trip);
    if ("error" in cleaned) return { error: cleaned.error };
    const key = `${cleaned.values.countryCode}|${cleaned.values.departureDate}|${cleaned.values.returnDate ?? ""}`;
    if (seen.has(key)) {
      merged++; // the same visit twice in the form: keep one
      continue;
    }
    seen.add(key);
    trips.push({ ...cleaned.values, id: trip.id && isUuid(trip.id) ? trip.id : null });
  }

  const sql = await getDb();
  const [before] = await sql<{ fullName: string }[]>`select full_name from profiles where id = ${profileId}`;
  if (before) {
    const what = part === "card" ? "travel card" : part === "record" ? "immigration record" : "travel card and immigration record";
    await saveRestorePoint(sql, { profileRecord: profileId }, `Before saving the ${what} of ${before.fullName || "(no name)"}`, session.email);
  }
  await sql.begin(async (tx) => {
    if (part !== "record") {
      await tx`update profiles set ${tx({ ...values, fullName: values.fullName! })}, updated_at = now() where id = ${profileId}`;
    } else {
      await tx`update profiles set updated_at = now() where id = ${profileId}`;
    }
    if (part === "card") return;
    const rows = await tx<{ id: string; countryCode: string; departureDate: string; returnDate: string | null }[]>`
      select id, trim(country_code) as country_code, departure_date, return_date from trips where profile_id = ${profileId}`;
    const existing = new Set(rows.map((r) => r.id));
    // A row without an id that matches a saved visit (same country + dates) updates that visit instead of adding a copy.
    const byKey = new Map(rows.map((r) => [`${r.countryCode}|${r.departureDate}|${r.returnDate ?? ""}`, r.id]));
    const claimed = new Set(trips.map((t) => t.id).filter(Boolean));
    for (const t of trips) {
      if (t.id && existing.has(t.id)) continue;
      const match = byKey.get(`${t.countryCode}|${t.departureDate}|${t.returnDate ?? ""}`);
      if (match && !claimed.has(match)) {
        t.id = match;
        claimed.add(match);
      }
    }
    const keep = trips.filter((t) => t.id && existing.has(t.id)).map((t) => t.id!);
    if (keep.length) await tx`delete from trips where profile_id = ${profileId} and id not in ${tx(keep)}`;
    else await tx`delete from trips where profile_id = ${profileId}`;
    for (const { id, ...t } of trips) {
      if (id && existing.has(id)) await tx`update trips set ${tx(t)} where id = ${id} and profile_id = ${profileId}`;
      else await tx`insert into trips ${tx({ ...t, profileId })}`;
    }
  });
  refresh();
  return { profileId, skipped: merged };
}

/** Saves reviewed data: creates a new profile (target "new") or fills an existing one, then adds the trips. */
export async function saveImport(
  target: string,
  payload: { profile: ImportProfile; trips: ImportTrip[] },
): Promise<{ error: string } | { profileId: string; added?: number; skipped?: number }> {
  const session = await requireAuth();
  if (session.role !== "admin" && (target === "new" || target !== session.profileId)) {
    return { error: "You can only import into your own record." };
  }
  const trips = [];
  for (const trip of payload.trips.slice(0, 500)) {
    const cleaned = cleanTrip(trip);
    if ("error" in cleaned) return { error: cleaned.error };
    trips.push(cleaned.values);
  }
  const profileValues = profileValuesFrom(payload.profile);

  const sql = await getDb();
  let profileId = target;
  if (target === "new") {
    if (!profileValues.fullName) return { error: "Full name is required to create a new profile." };
    const [row] = await sql<{ id: string }[]>`insert into profiles ${sql({ ...profileValues, fullName: profileValues.fullName })} returning id`;
    profileId = row.id;
  } else {
    if (!isUuid(target)) return { error: "Unknown profile." };
    // Only fill fields that are empty in the existing profile; never overwrite.
    const [existing] = await sql<Record<string, unknown>[]>`select * from profiles where id = ${target}`;
    if (!existing) return { error: "Profile not found." };
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(profileValues)) {
      const current = existing[key];
      const isEmpty = current == null || current === "" || (Array.isArray(current) && current.length === 0);
      const hasValue = value != null && value !== "" && !(Array.isArray(value) && value.length === 0);
      if (isEmpty && hasValue) updates[key] = value;
    }
    if (Object.keys(updates).length) {
      await sql`update profiles set ${sql(updates)}, updated_at = now() where id = ${target}`;
    }
  }
  // Skip visits that are already in the record (same country, departure and return date),
  // so importing the same document twice doesn't create duplicates.
  const existing = await sql<{ countryCode: string; departureDate: string; returnDate: string | null }[]>`
    select trim(country_code) as country_code, departure_date, return_date from trips where profile_id = ${profileId}`;
  const seen = new Set(existing.map((e) => `${e.countryCode}|${e.departureDate}|${e.returnDate ?? ""}`));
  const fresh = trips.filter((t) => {
    const key = `${t.countryCode}|${t.departureDate}|${t.returnDate ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const skipped = trips.length - fresh.length;
  if (trips.length && !fresh.length && target !== "new") {
    return { error: "This document is already added. All these visits are already in the record, so nothing was added again." };
  }
  if (fresh.length) {
    await sql`insert into trips ${sql(fresh.map((t) => ({ ...t, profileId })))}`;
  }
  return { profileId, added: fresh.length, skipped };
}

export async function deleteTrip(tripId: string) {
  const session = await requireAdmin(); // deleting trips is admin-only
  if (!isUuid(tripId)) return;
  const sql = await getDb();
  const [owner] = await sql<{ profileId: string }[]>`select profile_id from trips where id = ${tripId}`;
  if (!owner || !canAccessProfile(session, owner.profileId)) return;
  await saveRestorePoint(sql, { tripIds: [tripId] }, "Deleted a visit from the immigration record", session.email);
  const [row] = await sql<{ profileId: string }[]>`delete from trips where id = ${tripId} returning profile_id`;
  if (row) await sql`update profiles set updated_at = now() where id = ${row.profileId}`;
  refresh();
}
