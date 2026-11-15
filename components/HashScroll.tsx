"use client";

import { useEffect } from "react";

/** After the page has loaded, scroll to the element named in the URL (#visa-…), below the sticky header. */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 20) clearInterval(timer);
      if (!el) return;
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header - 16, behavior: "smooth" });
      el.classList.add("ring-2", "ring-gold");
      setTimeout(() => el.classList.remove("ring-2", "ring-gold"), 2500);
    }, 150);
    return () => clearInterval(timer);
  }, []);
  return null;
}
