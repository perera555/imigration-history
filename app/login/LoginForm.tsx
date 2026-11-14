"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions";
import { AuthCard } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

/** /login = user sign-in (with Create account); /login?as=admin = admin-only sign-in. */
export function LoginForm() {
  const params = useSearchParams();
  const isAdmin = params.get("as") === "admin";
  const justReset = params.get("reset") === "1";
  const [state, action] = useActionState(login, undefined);

  return (
    <AuthCard
      eyebrow={isAdmin ? "Admin panel" : "My account"}
      title={isAdmin ? "Admin sign in" : "Sign in"}
      subtitle={
        isAdmin
          ? "For administrators only. Manage every traveller's record."
          : "Sign in to add and update your travel card and immigration record."
      }
    >
      <form action={action} className="mt-8 space-y-4 text-left">
        <input type="hidden" name="mode" value={isAdmin ? "admin" : "user"} />
        {justReset && (
          <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
            Password changed. Sign in with your new password.
          </p>
        )}
        <label className="block">
          <span className="field-label text-gold-soft/80!">{isAdmin ? "Admin email" : "Email"}</span>
          <input type="email" name="email" required autoFocus autoComplete="username" className="field" />
        </label>
        <label className="block">
          <span className="field-label text-gold-soft/80!">Password</span>
          <PasswordInput name="password" required autoComplete="current-password" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input type="checkbox" name="remember" defaultChecked className="size-4 accent-[#c9a54c]" />
          Remember me for 30 days
        </label>
        {state?.error && <p className="text-sm font-medium text-red-300">{state.error}</p>}
        <SubmitButton className="btn btn-gold w-full" pendingText="Signing in…">
          {isAdmin ? "Sign in to admin panel" : "Sign in"}
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-gold-soft/90 underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          {!isAdmin && (
            <>
              <span className="mx-2 text-white/30">·</span>
              <Link href="/register" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
                Create account
              </Link>
            </>
          )}
        </p>
        <p className="text-center text-xs text-white/50">
          {isAdmin ? (
            <Link href="/login" className="hover:underline">
              Not an admin? User sign in →
            </Link>
          ) : (
            <Link href="/login?as=admin" className="hover:underline">
              Administrator? Admin sign in →
            </Link>
          )}
        </p>
      </form>
    </AuthCard>
  );
}
