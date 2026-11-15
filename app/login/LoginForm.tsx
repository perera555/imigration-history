"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions";
import { AuthCard } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

/**
 * One sign-in for everyone: admins go to the Admin panel, users to My account.
 * (/login?as=admin only changes the heading.)
 */
export function LoginForm() {
  const params = useSearchParams();
  const fromAdmin = params.get("as") === "admin";
  const justReset = params.get("reset") === "1";
  const [state, action] = useActionState(login, undefined);

  return (
    <AuthCard
      eyebrow={fromAdmin ? "Admin panel" : "Welcome"}
      title="Sign in"
      subtitle="One sign-in for admins and users. You'll be taken to the right place automatically."
    >
      <form action={action} className="mt-8 space-y-4 text-left">
        {justReset && (
          <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
            Password changed. Sign in with your new password.
          </p>
        )}
        <label className="block">
          <span className="field-label text-gold-soft/80!">Email</span>
          <input type="email" name="email" required autoFocus autoComplete="username" inputMode="email" className="field" />
        </label>
        <label className="block">
          <span className="field-label text-gold-soft/80!">Password</span>
          <PasswordInput name="password" required autoComplete="current-password" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input type="checkbox" name="remember" defaultChecked className="size-4 accent-[#c9a54c]" />
          Keep me signed in for 30 days
        </label>
        {state?.error && (
          <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-medium text-red-200">
            {state.error} Check your email and password, or use “Forgot password?”.
          </p>
        )}
        <SubmitButton className="btn btn-gold w-full !py-3 text-base" pendingText="Signing in…">
          Sign in
        </SubmitButton>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-gold-soft/90 underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <Link href="/register" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            New here? Create account →
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
