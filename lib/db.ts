import "server-only";
import postgres from "postgres";
import { migrate, dateAsString, SCHEMA_STATEMENTS } from "./schema.mjs";
import { hashPassword } from "./password";

type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as {
  __sql?: Sql;
  __schema?: Promise<void>;
  __schemaVersion?: string;
};

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your PostgreSQL connection string to .env.local (local) or the Vercel project settings.",
    );
  }
  return postgres(url, {
    prepare: false, // works with pooled (pgbouncer) connections, e.g. Neon
    max: Number(process.env.DB_POOL_MAX) || 5, // set DB_POOL_MAX=1 for single-connection local test databases
    idle_timeout: 20,
    onnotice: () => {},
    transform: postgres.camel,
    types: { date: dateAsString },
  }) as unknown as Sql;
}

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when no admin exists yet. */
export async function ensureFirstAdmin(sql: Sql) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from admins where role = 'admin'`;
  if (count > 0) return;
  await sql`
    insert into admins (email, name, password_hash, role)
    values (${email}, 'Owner', ${await hashPassword(password)}, 'admin')
    on conflict (email) do update set role = 'admin'`;
}

/** Returns a connected client after making sure the tables (and first admin) exist. */
export async function getDb(): Promise<Sql> {
  if (!globalForDb.__sql) globalForDb.__sql = createClient();
  const sql = globalForDb.__sql;
  // Re-run the (idempotent) schema whenever its definition changes, e.g. after a code update in dev.
  const version = SCHEMA_STATEMENTS.join(";");
  if (globalForDb.__schemaVersion !== version) {
    globalForDb.__schemaVersion = version;
    globalForDb.__schema = undefined;
  }
  if (!globalForDb.__schema) {
    globalForDb.__schema = migrate(sql)
      .then(() => ensureFirstAdmin(sql))
      .catch((error: unknown) => {
        globalForDb.__schema = undefined;
        throw error;
      });
  }
  await globalForDb.__schema;
  return sql;
}
