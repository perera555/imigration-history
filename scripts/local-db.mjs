// Local PostgreSQL for development (port 5433), data kept in .localdb/data inside the project.
// `npm run dev` starts it automatically; `npm run db` starts it on its own.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LOCAL_DB_PORT = 5433;
const databaseDir = path.join(root, ".localdb", "data");

/** True when something already answers on the port (e.g. the database is already running). */
export function portInUse(port = LOCAL_DB_PORT) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** Starts the local database unless it is already running. Returns a stop function (or null). */
export async function startLocalDb({ quiet = false } = {}) {
  if (await portInUse()) {
    if (!quiet) console.log(`✓ Local database already running on 127.0.0.1:${LOCAL_DB_PORT}`);
    return null;
  }
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: LOCAL_DB_PORT,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error(String(e)),
  });
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("Creating the local database (first time only)…");
    await pg.initialise();
  }
  await pg.start();
  console.log(`✓ Local database ready on 127.0.0.1:${LOCAL_DB_PORT} (data: .localdb/data)`);
  return async () => {
    try {
      await pg.stop();
    } catch {
      /* already stopped */
    }
  };
}

// `node scripts/local-db.mjs`: run the database on its own until Ctrl+C.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stop = await startLocalDb();
  if (stop) {
    const shutdown = async () => {
      await stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    setInterval(() => {}, 1 << 30);
  }
}
