"use client";

/** Buttons that scroll to a section on the page (below the sticky header). */
export function JumpNav({ items }: { items: { id: string; label: string; primary?: boolean }[] }) {
  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - header - 16;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Jump to section">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => go(it.id)}
          className={`btn ${it.primary ? "btn-gold" : "btn-ghost"} !py-1.5`}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
