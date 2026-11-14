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
  // Accounts: role 'admin' manages everything; role 'user' manages only their linked profile.
  `alter table admins add column if not exists role text not null default 'admin'`,
  `alter table admins add column if not exists profile_id uuid references profiles(id) on delete set null`,
  `create table if not exists password_resets (
    token_hash text primary key,
    admin_id uuid not null references admins(id) on delete cascade,
    expires_at timestamptz not null,
    used_at timestamptz
  )`,
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
