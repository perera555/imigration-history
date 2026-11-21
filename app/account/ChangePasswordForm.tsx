"use client";

import { useToastOn } from "@/components/Toaster";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, undefined);
  useToastOn(state?.ok, state?.error);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label>
        <span className="field-label">Current password</span>
        <PasswordInput name="currentPassword" required autoComplete="current-password" />
      </label>
      <label>
        <span className="field-label">New password (min 8)</span>
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
      </label>
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
      {state?.error && <p className="text-sm font-medium text-danger sm:col-span-3">{state.error}</p>}
      {state?.ok && <p className="text-sm font-medium text-ok sm:col-span-3">✓ {state.ok}</p>}
    </form>
  );
}
