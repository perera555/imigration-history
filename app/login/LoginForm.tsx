"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  const justReset = useSearchParams().get("reset") === "1";
  return (
    <form action={action} className="mt-8 space-y-4 text-left">
      {justReset && (
        <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
          Password changed. Sign in with your new password.
        </p>
      )}
      <label className="block">
        <span className="field-label text-gold-soft/80!">Email</span>
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
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-gold-soft/90 underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
