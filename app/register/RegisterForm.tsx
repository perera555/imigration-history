"use client";

import { useToastOn } from "@/components/Toaster";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions";
import { AuthCard } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  useToastOn(state?.ok, state?.error);
  return (
    <AuthCard
      eyebrow="Step 1 of 2"
      title="Create account"
      subtitle="Create your account, then add your travel card and immigration record."
    >
      <form action={action} className="mt-8 space-y-4 text-left">
        <label className="block">
          <span className="field-label text-gold-soft/80!">Full name (as in passport)</span>
          <input name="name" required autoFocus autoComplete="name" className="field" />
        </label>
        <label className="block">
          <span className="field-label text-gold-soft/80!">Email</span>
          <input type="email" name="email" required autoComplete="email" className="field" />
        </label>
        <label className="block">
          <span className="field-label text-gold-soft/80!">Password (min 8 characters)</span>
          <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="block">
          <span className="field-label text-gold-soft/80!">Confirm password</span>
          <PasswordInput name="confirmPassword" required minLength={8} autoComplete="new-password" />
        </label>
        {state?.error && <p className="text-sm font-medium text-red-300">{state.error}</p>}
        <SubmitButton className="btn btn-gold w-full" pendingText="Creating account…">
          Create account & add travel data →
        </SubmitButton>
        <p className="text-center text-sm text-white/70">
          Already have an account?{" "}
          <Link href="/login" className="text-gold-soft underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
