"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "./Toaster";

/**
 * Keeps a record page up to date: when the record changes (e.g. an admin adds visits, visas or
 * documents), the page refreshes its data by itself. Checks every few seconds while visible and
 * whenever the tab comes back. Your own changes refresh quietly; others show a pop-up.
 */
export function LiveRefresh({ profileId, every = 8000 }: { profileId: string; every?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const lastLocal = useRef(0);

  useEffect(() => {
    // Remember the user's own activity (saves, uploads, clicks) so their own changes don't pop up.
    const mark = () => (lastLocal.current = Date.now());
    document.addEventListener("submit", mark, true);
    document.addEventListener("click", mark, true);
    document.addEventListener("change", mark, true);

    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch(`/api/profiles/${profileId}/stamp`, { cache: "no-store" });
        if (!res.ok) return;
        const { stamp } = (await res.json()) as { stamp: string };
        if (last.current === null) {
          last.current = stamp;
          return;
        }
        if (stamp !== last.current) {
          last.current = stamp;
          router.refresh();
          if (Date.now() - lastLocal.current > 20_000) toast("Your record was updated — showing the latest", "info");
        }
      } catch {
        /* offline: try again later */
      }
    };
    check();
    const timer = setInterval(check, every);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      document.removeEventListener("submit", mark, true);
      document.removeEventListener("click", mark, true);
      document.removeEventListener("change", mark, true);
    };
  }, [profileId, every, router]);

  return null;
}
