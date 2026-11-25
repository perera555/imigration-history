// `npm run dev`: makes sure the local database is running (when .env.local uses it), then starts the
// Next.js dev server. The database runs in its own background keeper (scripts/local-db.mjs), which
// restarts it if it ever stops — so closing the dev server or a terminal never takes it down.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchKeeper, LOCAL_DB_PORT } from "./local-db.mjs";

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

if (usesLocalDb()) {
  console.log((await launchKeeper()) ? `✓ Local database ready on 127.0.0.1:${LOCAL_DB_PORT} (kept running in the background)` : "⚠ The local database did not start — see .localdb/db.log");
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
// After the PC sleeps or the database restarts, the database library reconnects with a wait that has
// already passed; Node then prints a harmless "TimeoutNegativeWarning" (shown as a red issue). Hide just that one.
const child = spawn(process.execPath, ["--disable-warning=TimeoutNegativeWarning", nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  // Also for the worker processes Next.js starts.
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --disable-warning=TimeoutNegativeWarning`.trim() },
});

let stopping = false;
const shutdown = (code = 0) => {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill("SIGINT");
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
child.on("exit", (code) => shutdown(code ?? 0));
