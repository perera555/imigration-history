"use client";

import { useEffect, useRef, useState } from "react";
import hotToast from "react-hot-toast";

const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/** Gets the new version: updates the service worker, clears old cached pages, reloads. */
async function updateNow() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const keys = await caches?.keys();
    await Promise.all((keys ?? []).filter((k) => k.startsWith("ih-pages")).map((k) => caches.delete(k)));
  } catch {
    /* reload anyway */
  }
  window.location.reload();
}

async function liveVersion(): Promise<string | null> {
  const res = await fetch("/api/version", { cache: "no-store" });
  const { version } = (await res.json()) as { version?: string };
  return version ?? null;
}

/** The "New version available — Update now / Later" pop-up. */
function showUpdateToast(onLater?: () => void) {
  hotToast(
    (t) => (
      <div className="flex items-center gap-3">
        <div>
          <p className="font-semibold">✨ New version available</p>
          <p className="text-xs font-normal text-ink-soft">Update to get the latest features and fixes.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            hotToast.dismiss(t.id);
            updateNow();
          }}
          className="btn btn-gold !px-3 !py-1.5 text-xs"
        >
          Update now
        </button>
        <button
          type="button"
          onClick={() => {
            hotToast.dismiss(t.id);
            onLater?.();
          }}
          className="text-xs text-ink-soft hover:underline"
        >
          Later
        </button>
      </div>
    ),
    { id: "app-update", duration: Infinity },
  );
}

/**
 * "New version available — Update now": checks the live version every few minutes and whenever the
 * app comes back to the screen (e.g. the installed app reopened on a phone).
 */
export function UpdateChecker() {
  const shown = useRef(false);

  useEffect(() => {
    if (CURRENT === "dev" || process.env.NODE_ENV !== "production") return;
    const check = async () => {
      if (shown.current || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const version = await liveVersion();
        if (!version || version === CURRENT) return;
        shown.current = true;
        showUpdateToast(() => setTimeout(() => (shown.current = false), 30 * 60 * 1000)); // ask again in 30 minutes
      } catch {
        /* offline or server busy: try again later */
      }
    };
    const timer = setInterval(check, 3 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    const first = setTimeout(check, 15_000);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  return null;
}

/** "App update" box (account page, admin panel): shows the version and checks for a new one. */
export function AppUpdatePanel() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"latest" | "new" | "offline" | null>(null);

  async function check() {
    setChecking(true);
    try {
      const version = await liveVersion();
      if (version && version !== CURRENT) {
        setStatus("new");
        showUpdateToast();
      } else {
        setStatus("latest");
        hotToast.success(`You have the latest version (${CURRENT})`);
      }
    } catch {
      setStatus("offline");
      hotToast.error("Couldn't check for updates. Are you online?");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section id="app-update" className="panel flex scroll-mt-24 flex-wrap items-center gap-4 p-5 sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-navy text-2xl" aria-hidden>
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">App update</p>
        <p className="mt-0.5 font-semibold text-navy">Version {CURRENT}</p>
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

/** Small version label, e.g. "Version 0.1.0+3f2a9c1". */
export function AppVersion() {
  return <span>Version {CURRENT}</span>;
}
