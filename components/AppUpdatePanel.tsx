"use client";

import { useState } from "react";
import hotToast from "react-hot-toast";
import { APP_VERSION, liveVersion, showUpdateToast, updateNow } from "./UpdateChecker";

/** "App update" box at the top of the account page and admin panel: shows the version and checks for a new one. */
export function AppUpdatePanel() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"latest" | "new" | "offline" | null>(null);

  async function check() {
    setChecking(true);
    try {
      const version = await liveVersion();
      if (version && version !== APP_VERSION) {
        setStatus("new");
        showUpdateToast();
      } else {
        setStatus("latest");
        hotToast.success(`You have the latest version (${APP_VERSION})`);
      }
    } catch {
      setStatus("offline");
      hotToast.error("Couldn't check for updates. Are you online?");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section id="app-update" className="panel flex scroll-mt-24 flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-xl" aria-hidden>
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">App update</p>
        <p className="mt-0.5 font-semibold text-navy">Version {APP_VERSION}</p>
        <p className="text-sm text-ink-soft">
          {status === "new"
            ? "A new version is available. Press Update now."
            : status === "latest"
              ? "✓ You have the latest version."
              : status === "offline"
                ? "Couldn't check right now. Try again when online."
                : "The app tells you automatically when a new version is published."}
        </p>
      </div>
      {status === "new" ? (
        <button type="button" onClick={updateNow} className="btn btn-gold">
          ✨ Update now
        </button>
      ) : (
        <button type="button" onClick={check} disabled={checking} className="btn btn-primary">
          {checking ? "Checking…" : "🔄 Check for updates"}
        </button>
      )}
    </section>
  );
}
