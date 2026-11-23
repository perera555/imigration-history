// Local PostgreSQL for development (port 5433), data kept in .localdb/data inside the project.
// `npm run dev` starts it automatically; `npm run db` starts it on its own.
import EmbeddedPostgres from "embedded-postgres";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
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

/**
 * The database really answers (not just a port that is held open by a leftover process):
 * sends PostgreSQL's SSL request and expects its one-letter reply ("S" or "N").
 */
export function dbAnswers(port = LOCAL_DB_PORT, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("error", () => done(false));
    socket.once("connect", () => socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])));
    socket.once("data", (d) => done(d.length > 0 && (d[0] === 0x53 || d[0] === 0x4e)));
  });
}

/** Stops this project's own database processes that were left behind after a crash (Windows). */
export function killLeftoverDb() {
  if (process.platform !== "win32") return;
  const bin = path.join(root, "node_modules", "@embedded-postgres").replace(/'/g, "''");
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      // Only postgres.exe started from this project's node_modules (never another PostgreSQL on the PC).
      `$bin = '${bin}'; Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/', '\\').Contains($bin) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: "ignore", timeout: 20_000 },
  );
}

/** Starts the local database unless it is already running. Returns a stop function (or null). */
export async function startLocalDb({ quiet = false } = {}) {
  if (await portInUse()) {
    if (!(await dbAnswers()) && !(await new Promise((r) => setTimeout(r, 3000)).then(() => dbAnswers()))) {
      // Port held, but the database doesn't answer: a crashed copy left processes behind.
      console.log("Local database is not answering — clearing the stuck copy and starting it again…");
      dbLog("port held but no answer: clearing leftover database processes");
      killLeftoverDb();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
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
    // The database's own messages go to .localdb/db.log, so a stop can always be explained.
    onLog: (m) => dbLog(`pg: ${String(m).trim()}`),
    onError: (e) => dbLog(`pg error: ${String(e).trim()}`),
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

/** Appends a line to .localdb/db.log (kept under ~5 MB). */
export function dbLog(line) {
  try {
    const file = path.join(root, ".localdb", "db.log");
    mkdirSync(path.dirname(file), { recursive: true });
    if (existsSync(file) && statSync(file).size > 5 * 1024 * 1024) renameSync(file, file + ".old");
    appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* logging must never stop the database */
  }
}

/**
 * Starts the keeper as its own background program (hidden, not tied to this terminal), unless one
 * is already running. Then waits until the database answers.
 */
export async function launchKeeper() {
  if (!keeperRunning()) {
    const script = path.join(root, "scripts", "local-db.mjs");
    if (process.platform === "win32") {
      // Through Windows itself (WMI), so the keeper isn't closed together with the program that started it.
      const q = (s) => s.replace(/'/g, "''");
      spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; ` +
            `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '"${q(process.execPath)}" "${q(script)}"'; CurrentDirectory = '${q(root)}'; ProcessStartupInformation = $si } | Out-Null`,
        ],
        { stdio: "ignore", timeout: 30_000 },
      );
    } else {
      spawn(process.execPath, [script], { cwd: root, detached: true, stdio: "ignore" }).unref();
    }
  }
  for (let i = 0; i < 60; i++) {
    if (await dbAnswers()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** The keeper that is already running (its process id), if any. */
const keeperFile = path.join(root, ".localdb", "keeper.pid");
function keeperRunning() {
  try {
    const pid = Number(readFileSync(keeperFile, "utf8"));
    if (!pid || pid === process.pid) return false;
    process.kill(pid, 0); // throws when that process is gone
    return true;
  } catch {
    return false;
  }
}

/**
 * `node scripts/local-db.mjs` (`npm run db`, and at Windows log-in): the database keeper.
 * Starts the database, checks every 10 s that it really answers, and starts it again if it stopped
 * or got stuck. Runs on its own, so closing a terminal or the dev server doesn't take the database down.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (keeperRunning()) {
    console.log("✓ The database keeper is already running.");
    process.exit(0);
  }
  mkdirSync(path.dirname(keeperFile), { recursive: true });
  writeFileSync(keeperFile, String(process.pid));
  dbLog(`keeper started (pid ${process.pid})`);

  let stop = null;
  const start = async (why) => {
    try {
      if (why) dbLog(why);
      stop = (await startLocalDb({ quiet: true })) ?? stop;
      dbLog((await dbAnswers()) ? "database answering" : "database did not come up");
    } catch (e) {
      dbLog(`start failed: ${e?.message ?? e}`);
    }
  };
  await start();

  let checking = false;
  setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      if (await dbAnswers()) return;
      await new Promise((r) => setTimeout(r, 3000));
      if (await dbAnswers()) return; // just busy
      stop = null;
      await start((await portInUse()) ? "database stopped answering — restarting it" : "database stopped — starting it again");
    } finally {
      checking = false;
    }
  }, 10_000);

  const shutdown = async () => {
    dbLog("keeper stopping (database stopped cleanly)");
    if (stop) await stop();
    try {
      if (readFileSync(keeperFile, "utf8") === String(process.pid)) unlinkSync(keeperFile);
    } catch {
      /* already gone */
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
