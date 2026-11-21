"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { OnlineDot } from "./OnlineDot";

type Props = {
  name: string;
  email: string;
  role: "admin" | "user";
  photo: string | null;
  profileId: string | null;
};

/** Account chip in the header: opens a panel with profile, shortcuts and Sign out. */
export function AccountMenu({ name, email, role, photo, profileId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const avatar = (size: string) =>
    photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" className={`${size} rounded-full border border-gold-soft/60 object-cover`} />
    ) : (
      <span className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold font-semibold text-navy`}>
        {name.charAt(0).toUpperCase()}
      </span>
    );

  const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-paper-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 py-1 pl-1 pr-3 hover:bg-white/10"
      >
        <span className="relative">
          {avatar("size-8")}
          <OnlineDot />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-32 truncate text-sm font-semibold text-white">{name}</span>
          <span className="block text-[10px] uppercase tracking-[0.15em] text-gold-soft/80">
            {role === "admin" ? "Admin" : "My account"} ▾
          </span>
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-card p-2 text-ink shadow-2xl">
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
            {avatar("size-11")}
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-xs text-ink-soft">{email}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${role === "admin" ? "bg-navy text-gold-soft" : "bg-paper-2 text-ink-soft"}`}
              >
                {role === "admin" ? "Admin" : "User"}
              </span>
            </div>
          </div>
          <nav className="py-1">
            {role === "admin" ? (
              <>
                <Link href="/admin" className={item}>🛠️ Admin panel</Link>
                <Link href="/admin/import" className={item}>➕ New travel record</Link>
                <Link href="/admin/admins" className={item}>👥 Admins &amp; users</Link>
                <Link href="/admin/recovery" className={item}>🛟 Backup &amp; recovery</Link>
              </>
            ) : (
              <Link href="/account" className={item}>👤 My account &amp; profile</Link>
            )}
            {profileId && (
              <>
                <Link href={`/profiles/${profileId}`} className={item}>🪪 View my travel card</Link>
                <Link href={`/admin/profiles/${profileId}/update`} className={item}>✏️ Update record</Link>
                <Link href={`/admin/profiles/${profileId}/visas`} className={item}>🛂 Visas</Link>
                <a href={`/api/profiles/${profileId}/pdf?view=1`} target="_blank" rel="noopener" className={item}>📄 View PDF</a>
              </>
            )}
            <Link href={role === "admin" ? "/admin/admins" : "/account#password"} className={item}>🔑 Change password</Link>
          </nav>
          <form action={logout} className="border-t border-line pt-1">
            <button className={`${item} w-full font-semibold text-danger`}>↩ Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
