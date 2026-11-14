"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAdmin, type FormState } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function AddAdminForm() {
  const [state, action] = useActionState(addAdmin, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <label>
          <span className="field-label">Name</span>
          <input name="name" className="field" placeholder="Optional" />
        </label>
        <label>
          <span className="field-label">Email *</span>
          <input type="email" name="email" required className="field" autoComplete="off" />
        </label>
        <label>
          <span className="field-label">Password *</span>
          <PasswordInput name="password" required minLength={8} className="" autoComplete="new-password" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Adding…">Add admin</SubmitButton>
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
      </div>
    </form>
  );
}

export function PasswordForm({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-center gap-3">
      <div className="w-full max-w-xs">
        <PasswordInput name="password" required minLength={8} placeholder="New password (min 8)" autoComplete="new-password" />
      </div>
      <SubmitButton className="btn btn-primary" pendingText="Saving…">
        Set password
      </SubmitButton>
      {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
    </form>
  );
}
