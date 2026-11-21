"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "ok" | "info" | "error" };

/** Shows a pop-up anywhere in the app: window.dispatchEvent(new CustomEvent("toast", { detail: { message } })). */
export function toast(message: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, tone } }));
}

/**
 * Pop-up messages ("✓ Record saved", "Signed in as …", "Record deleted successfully").
 * Server actions leave a short-lived "flash" cookie; it is read here and removed.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    const show = (message: string, tone: Toast["tone"]) => {
      const id = ++n;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    };
    const readCookie = () => {
      const m = document.cookie.match(/(?:^|;\s*)flash=([^;]+)/);
      if (!m) return;
      document.cookie = "flash=; Max-Age=0; path=/";
      try {
        const v = JSON.parse(decodeURIComponent(decodeURIComponent(m[1])));
        if (v?.message) show(String(v.message), v.tone ?? "ok");
      } catch {
        /* ignore a broken cookie */
      }
    };
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.message) show(String(d.message), d.tone ?? "ok");
    };
    readCookie();
    // Server actions set the cookie without a full page load: check often (cheap).
    const timer = setInterval(readCookie, 600);
    window.addEventListener("toast", onEvent);
    return () => {
      clearInterval(timer);
      window.removeEventListener("toast", onEvent);
    };
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
            t.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : t.tone === "info"
                ? "border-white/10 bg-navy text-white"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-base ${t.tone === "error" ? "bg-red-100" : t.tone === "info" ? "bg-white/10" : "bg-emerald-100"}`} aria-hidden>
            {t.tone === "error" ? "!" : t.tone === "info" ? "👋" : "✓"}
          </span>
          <span>{t.message}</span>
          <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-1 text-current/60 hover:text-current" aria-label="Close">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
