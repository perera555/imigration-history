"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthCard } from "@/components/AuthCard";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPassword, undefined);
  return (
    <AuthCard eyebrow="Account recovery" title="Forgot password" subtitle="Enter your admin email and we'll send you a reset link.">
      <form action={action} className="mt-8 space-y-4 text-left">
        <label className="block">
          <span className="field-label text-gold-soft/80!">Email</span>
          <input type="email" name="email" required autoFocus autoComplete="username" className="field" />
        </label>
        {state?.error && <p className="text-sm font-medium text-red-300">{state.error}</p>}
        {state?.ok && <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.ok}</p>}
        <SubmitButton className="btn btn-gold w-full" pendingText="Sending…">
          Send reset link
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/login" className="text-gold-soft/90 hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
