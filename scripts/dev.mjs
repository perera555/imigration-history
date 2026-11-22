// `npm run dev`: starts the local database (when .env.local uses it), then the Next.js dev server.
// Stopping the dev server (Ctrl+C) also stops the database cleanly.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalDb, portInUse, LOCAL_DB_PORT } from "./local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usesLocalDb() {
  try {
    const env = readFileSync(path.join(root, ".env.local"), "utf8");
    const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)/m)?.[1] ?? "";
    return new RegExp(`(localhost|127\\.0\\.0\\.1):${LOCAL_DB_PORT}\\b`).test(url);
  } catch {
    return false;
  }
}

let stopDb = null;
const local = usesLocalDb();
async function ensureDb(quiet = false) {
  if (stopDb) return; // ours is running
  try {
    stopDb = await startLocalDb({ quiet });
  } catch (error) {
    console.error("Could not start the local database:", error?.message ?? error);
  }
}
if (local) {
  await ensureDb();
  // Watchdog: if the database ever stops (e.g. another copy that was running closes), start it again.
  setInterval(async () => {
    if (!stopDb && !(await portInUse())) {
      console.log("Local database stopped — starting it again…");
      await ensureDb(true);
    }
  }, 10_000).unref();
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });

let stopping = false;
const shutdown = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill("SIGINT");
  if (stopDb) await stopDb();
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
child.on("exit", (code) => shutdown(code ?? 0));
