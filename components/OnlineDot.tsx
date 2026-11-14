"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Small green (online) / grey (offline) status dot. */
export function OnlineDot() {
  const online = useOnline();
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-navy ${online ? "bg-emerald-400" : "bg-gray-400"}`}
    />
  );
}

/** Banner shown while the device is offline. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-navy">
      You&apos;re offline. Showing saved records; changes need an internet connection.
    </div>
  );
}

/** "Online / Offline" pill. */
export function OnlinePill() {
  const online = useOnline();
  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/85 md:inline-flex">
      <span className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-gray-400"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}
