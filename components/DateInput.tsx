"use client";

import { useRef, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-21" -> "21 November 2026" */
export function longDate(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : v;
}

/**
 * Date field that shows the date as "21 November 2026". Works like <input type="date">:
 * same name/value/defaultValue/onChange (the change event comes from the real date input),
 * and clicking it opens the browser's calendar picker.
 */
export function DateInput({
  className = "field",
  value,
  defaultValue,
  onChange,
  readOnly,
  disabled,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value ?? "") : inner;
  const locked = readOnly || disabled;

  const open = () => {
    if (locked) return;
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div
      role="button"
      tabIndex={locked ? -1 : 0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`${className} relative flex items-center gap-2 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`flex-1 truncate ${current ? "" : "text-ink-soft/60"}`}>{current ? longDate(current) : "Choose date"}</span>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <input
        {...rest}
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-hidden
        readOnly={readOnly}
        disabled={disabled}
        {...(value !== undefined ? { value: current } : { value: inner })}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value);
          onChange?.(e);
        }}
        // Inline style (not CSS classes) so the real date box is always invisible and never
        // shows its own "12/12/2013" text or icon over the formatted date.
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          color: "transparent",
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
