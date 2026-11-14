"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useActionState(resetPassword.bind(null, token), undefined);

  if (!token) {
    return (
      <p className="mt-6 text-sm text-red-300">
        This link is missing its token.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4 text-left">
      <label className="block">
        <span className="field-label text-gold-soft/80!">New password</span>
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" className="" />
      </label>
      <label className="block">
        <span className="field-label text-gold-soft/80!">Confirm password</span>
        <PasswordInput name="confirmPassword" required minLength={8} autoComplete="new-password" className="" />
      </label>
      {state?.error && <p className="text-sm font-medium text-red-300">{state.error}</p>}
      <SubmitButton className="btn btn-gold w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
