// `npm run db:autostart`      → the local database keeper starts by itself when you log in to Windows.
// `npm run db:autostart:off`  → stop doing that.
// It adds (or removes) one small hidden launcher in your Windows "Startup" folder; nothing else changes.
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchKeeper } from "./local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const startup = path.join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
const launcher = path.join(startup, "imigration-history-database.vbs");

if (process.platform !== "win32") {
  console.log("Start-at-log-in is for Windows. On other systems run `npm run db` once after starting the computer.");
  process.exit(0);
}

if (process.argv[2] === "off") {
  if (existsSync(launcher)) unlinkSync(launcher);
  console.log("✓ The local database will no longer start by itself at log-in. (It keeps running until you restart the PC.)");
  process.exit(0);
}

const vb = (s) => s.replace(/"/g, '""');
writeFileSync(
  launcher,
  [
    "' Starts the imigration-history local database keeper (hidden) when you log in.",
    "' Remove with: npm run db:autostart:off",
    'Set sh = CreateObject("WScript.Shell")',
    `sh.CurrentDirectory = "${vb(root)}"`,
    `sh.Run """${vb(process.execPath)}"" ""${vb(path.join(root, "scripts", "local-db.mjs"))}""", 0, False`,
    "",
  ].join("\r\n"),
);
console.log(`✓ The local database will start by itself every time you log in to Windows.\n  (launcher: ${launcher})`);
console.log((await launchKeeper()) ? "✓ Database keeper running now." : "⚠ The database did not start — see .localdb/db.log");
