"use client";

import { useEffect } from "react";
import hotToast, { Toaster as HotToaster } from "react-hot-toast";

type Tone = "ok" | "info" | "error";

/** Pop-up message anywhere in the app (top right). */
export function toast(message: string, tone: Tone = "ok") {
  if (tone === "error") hotToast.error(message);
  else if (tone === "info") hotToast(message, { icon: "👋" });
  else hotToast.success(message);
}

/** Shows a component's own success / error message as a pop-up too, whenever it changes. */
export function useToastOn(ok?: string | null, error?: string | null) {
  useEffect(() => {
    if (ok) toast(ok.replace(/^✓\s*/, ""));
  }, [ok]);
  useEffect(() => {
    if (error) toast(error, "error");
  }, [error]);
}

/**
 * Pop-up messages for the whole app, top right ("Signed in as …", "Record saved successfully",
 * "Record deleted successfully"). Server actions leave a short-lived "flash" cookie; it is read here
 * and removed, so messages also appear after a redirect (sign in, sign out, delete).
 */
export function Toaster() {
  useEffect(() => {
    const readCookie = () => {
      const m = document.cookie.match(/(?:^|;\s*)flash=([^;]+)/);
      if (!m) return;
      document.cookie = "flash=; Max-Age=0; path=/";
      let raw = m[1];
      try {
        raw = decodeURIComponent(raw);
        raw = decodeURIComponent(raw);
      } catch {
        /* already decoded */
      }
      try {
        const v = JSON.parse(raw);
        if (v?.message) toast(String(v.message), v.tone ?? "ok");
      } catch {
        /* ignore a broken cookie */
      }
    };
    readCookie();
    // Server actions set the cookie without a full page load: check often (cheap).
    const timer = setInterval(readCookie, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <HotToaster
      position="top-right"
      gutter={10}
      containerStyle={{ top: 76, right: 16 }}
      toastOptions={{
        duration: 4500,
        style: {
          borderRadius: "16px",
          padding: "12px 16px",
          fontWeight: 600,
          fontSize: "14px",
          color: "#0f1b2d",
          background: "#fffdf8",
          border: "1px solid #e3d6b4",
          boxShadow: "0 18px 40px -12px rgba(11,31,58,0.35)",
        },
        success: { iconTheme: { primary: "#1d7a4e", secondary: "#ffffff" } },
        error: { duration: 6000, iconTheme: { primary: "#b4232f", secondary: "#ffffff" } },
      }}
    />
  );
}
