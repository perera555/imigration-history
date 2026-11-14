// Loads a profile + trips from a private JSON file into PostgreSQL.
// Usage:  npm run seed -- data/perera.local.json
// The JSON file is git-ignored (data/*.local.json) because it holds personal data.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { migrate, dateAsString } from "../lib/schema.mjs";

const file = process.argv[2] ?? "data/perera.local.json";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (put it in .env.local).");
  process.exit(1);
}

const { profile, trips } = JSON.parse(readFileSync(file, "utf8"));
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {}, transform: postgres.camel, types: { date: dateAsString } });

try {
  await migrate(sql);

  const existing = profile.passportNumber
    ? await sql`select id from profiles where passport_number = ${profile.passportNumber}`
    : [];
  if (existing.length) {
    console.log(`A profile with passport ${profile.passportNumber} already exists — nothing imported.`);
  } else {
    await sql.begin(async (tx) => {
      const [row] = await tx`insert into profiles ${tx(profile)} returning id`;
      for (const trip of trips) {
        await tx`insert into trips ${tx({
          profileId: row.id,
          countryCode: trip.countryCode,
          city: trip.city ?? null,
          departureDate: trip.departureDate,
          returnDate: trip.returnDate ?? null,
          purpose: trip.purpose ?? "",
          passportNumber: trip.passportNumber ?? null,
          notes: trip.notes ?? null,
        })}`;
      }
      console.log(`Imported "${profile.fullName}" with ${trips.length} trips (id ${row.id}).`);
    });
  }
} finally {
  await sql.end();
}
