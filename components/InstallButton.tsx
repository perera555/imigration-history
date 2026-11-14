"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else {
      setShowHelp((v) => !v);
    }
  }

  return (
    <div className="relative">
      <button onClick={install} className="btn btn-gold !px-3.5 !py-1.5 text-sm">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Install app
      </button>
      {showHelp && (
        <div className="absolute right-0 top-11 z-40 w-72 rounded-2xl border border-line bg-card p-4 text-sm text-ink shadow-xl">
          <p className="mb-2 font-semibold">Install on this device</p>
          {isIos ? (
            <p className="text-ink-soft">
              In Safari, tap the <b>Share</b> button, then choose <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="text-ink-soft">
              Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>. In Chrome or Edge
              on desktop, use the install icon in the address bar.
            </p>
          )}
          <button onClick={() => setShowHelp(false)} className="mt-3 text-xs font-semibold text-navy-2 underline">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
