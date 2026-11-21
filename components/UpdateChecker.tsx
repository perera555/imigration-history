"use client";

import { useEffect, useRef } from "react";
import hotToast from "react-hot-toast";

const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const APP_VERSION = CURRENT;

/** Gets the new version: updates the service worker, clears old cached pages, reloads. */
export async function updateNow() {
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

export async function liveVersion(): Promise<string | null> {
  const res = await fetch("/api/version", { cache: "no-store" });
  const { version } = (await res.json()) as { version?: string };
  return version ?? null;
}

/** The "New version available — Update now / Later" pop-up. */
export function showUpdateToast(onLater?: () => void) {
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

/** Small version label, e.g. "Version 0.1.0+3f2a9c1". */
export function AppVersion() {
  return <span>Version {CURRENT}</span>;
}
