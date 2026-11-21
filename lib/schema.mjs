// Shared by the app (lib/db.ts) and the seed script (scripts/seed.mjs).
// Every statement is idempotent so it is safe to run on every cold start.
export const SCHEMA_STATEMENTS = [
  `create table if not exists profiles (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    date_of_birth date,
    sex text,
    nationality text,
    address text,
    phone text,
    email text,
    passport_number text,
    previous_passports text[] not null default '{}',
    photo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists trips (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade,
    country_code char(2) not null,
    city text,
    departure_date date not null,
    return_date date,
    purpose text not null default '',
    passport_number text,
    notes text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists trips_profile_idx on trips (profile_id, departure_date)`,
  `create table if not exists admins (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null default '',
    password_hash text not null,
    created_at timestamptz not null default now()
  )`,
  // Travel card: ID number and passport issue / expiry dates.
  `alter table profiles add column if not exists national_id text`,
  `alter table profiles add column if not exists passport_issue_date date`,
  `alter table profiles add column if not exists passport_expiry_date date`,
  // Visas held by a traveller, plus the uploaded visa document (kept in its own table so lists stay light).
  `create table if not exists visas (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade,
    country_code char(2) not null,
    visa_type text not null default '',
    visa_number text,
    issue_date date,
    expiry_date date,
    travel_from date,
    travel_to date,
    purpose text,
    entries text,
    stay_days int,
    issued_at text,
    passport_number text,
    status text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table visas add column if not exists travel_from date`,
  `alter table visas add column if not exists travel_to date`,
  `alter table visas add column if not exists purpose text`,
  `alter table visas add column if not exists visa_format text`,
  `alter table visas add column if not exists countries_travelled text[] not null default '{}'`,
  `create index if not exists visas_profile_idx on visas (profile_id, issue_date)`,
  `create table if not exists visa_documents (
    visa_id uuid primary key references visas(id) on delete cascade,
    file_name text not null default 'document',
    mime text not null,
    size int not null,
    data bytea not null,
    uploaded_at timestamptz not null default now()
  )`,
  // Boarding passes: for previous trips (linked to a trip) or current/upcoming travel; file stored privately.
  `create table if not exists boarding_passes (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade,
    trip_id uuid references trips(id) on delete set null,
    direction text,
    airline text,
    flight_number text,
    from_airport text,
    to_airport text,
    flight_date date,
    seat text,
    booking_ref text,
    notes text,
    file_name text,
    mime text,
    size int,
    data bytea,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists boarding_profile_idx on boarding_passes (profile_id, flight_date)`,
  `alter table boarding_passes add column if not exists checkin_url text`,
  `alter table boarding_passes add column if not exists checked_in boolean not null default false`,
  // Accounts: role 'admin' manages everything; role 'user' manages only their linked profile.
  `alter table admins add column if not exists role text not null default 'admin'`,
  `alter table admins add column if not exists profile_id uuid references profiles(id) on delete set null`,
  `create table if not exists password_resets (
    token_hash text primary key,
    admin_id uuid not null references admins(id) on delete cascade,
    expires_at timestamptz not null,
    used_at timestamptz
  )`,
  // Restore points: compressed copies of records, saved before deletes, daily and on request.
  `create table if not exists restore_points (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    reason text not null,
    kind text not null default 'partial',
    created_by text not null default '',
    records int not null default 0,
    size int not null default 0,
    data bytea not null
  )`,
  `create index if not exists restore_points_created_idx on restore_points (created_at desc)`,
  // Extra pages / photos of a visa (visa page, entry stamps, …), any number per visa.
  `create table if not exists visa_pages (
    id uuid primary key default gen_random_uuid(),
    visa_id uuid not null references visas(id) on delete cascade,
    file_name text not null,
    mime text not null,
    size int not null,
    data bytea not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists visa_pages_visa_idx on visa_pages (visa_id, created_at)`,
];

/** Runs the schema inside a transaction guarded by an advisory lock so
 *  parallel serverless cold starts don't race each other. */
export async function migrate(sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(724519)`;
    for (const statement of SCHEMA_STATEMENTS) {
      await tx.unsafe(statement);
    }
  });
}

/** Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifts). */
export const dateAsString = {
  to: 1082,
  from: [1082],
  serialize: (x) => x,
  parse: (x) => x,
};
