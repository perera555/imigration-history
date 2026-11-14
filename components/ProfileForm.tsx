"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import type { Profile } from "@/lib/data";
import { PhotoInput } from "./PhotoInput";
import { PassportListInput } from "./PassportListInput";
import { SubmitButton } from "./SubmitButton";

export function ProfileForm({
  action,
  profile,
  submitLabel,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  profile?: Profile;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <span className="field-label">Photo</span>
        <PhotoInput name="photo" defaultValue={profile?.photo} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="field-label">Full name *</span>
          <input name="fullName" required defaultValue={profile?.fullName} className="field" placeholder="As shown in passport" />
        </label>
        <label>
          <span className="field-label">Date of birth (age is calculated)</span>
          <input type="date" name="dateOfBirth" defaultValue={profile?.dateOfBirth ?? ""} className="field" />
        </label>
        <label>
          <span className="field-label">Sex</span>
          <select name="sex" defaultValue={profile?.sex ?? ""} className="field">
            <option value="">—</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          <span className="field-label">Nationality</span>
          <input name="nationality" defaultValue={profile?.nationality ?? ""} className="field" placeholder="e.g. Sri Lankan" />
        </label>
        <label>
          <span className="field-label">Phone number</span>
          <input type="tel" name="phone" defaultValue={profile?.phone ?? ""} className="field" placeholder="+94 …" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Email</span>
          <input type="email" name="email" defaultValue={profile?.email ?? ""} className="field" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Address</span>
          <textarea name="address" rows={2} defaultValue={profile?.address ?? ""} className="field" />
        </label>
        <label>
          <span className="field-label">Current passport number</span>
          <input name="passportNumber" defaultValue={profile?.passportNumber ?? ""} className="field font-mono uppercase" />
        </label>
        <div className="sm:col-span-2">
          <span className="field-label">Previous passport numbers (up to 10)</span>
          <PassportListInput name="previousPassports" defaultValue={profile?.previousPassports} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
      </div>
    </form>
  );
}
