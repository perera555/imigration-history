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
  lockFilled = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  profile?: Profile;
  submitLabel: string;
  /** Users: fields that already have a value are read-only (only admins can change saved data). */
  lockFilled?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const locked = (value: unknown) => lockFilled && value != null && value !== "";
  const lockClass = "bg-paper-2/70 text-ink-soft cursor-not-allowed";

  return (
    <form action={formAction} className="space-y-6">
      {lockFilled && (
        <p className="rounded-xl bg-paper-2/70 px-4 py-2.5 text-sm text-ink-soft">
          🔒 Saved details are locked. You can fill in empty fields; ask an admin to change saved information.
        </p>
      )}
      <div>
        <span className="field-label">Photo</span>
        {locked(profile?.photo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile!.photo!} alt="Profile photo" className="h-32 w-26 rounded-xl border border-line object-cover" />
        ) : (
          <PhotoInput name="photo" defaultValue={profile?.photo} />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="field-label">Full name *</span>
          <input name="fullName" required readOnly={locked(profile?.fullName)} defaultValue={profile?.fullName} className={`field ${locked(profile?.fullName) ? lockClass : ""}`} placeholder="As shown in passport" />
        </label>
        <label>
          <span className="field-label">Date of birth (age is calculated)</span>
          <input type="date" name="dateOfBirth" readOnly={locked(profile?.dateOfBirth)} defaultValue={profile?.dateOfBirth ?? ""} className={`field ${locked(profile?.dateOfBirth) ? lockClass : ""}`} />
        </label>
        <label>
          <span className="field-label">Sex</span>
          {locked(profile?.sex) ? (
            <input name="sex" readOnly defaultValue={profile?.sex ?? ""} className={`field ${lockClass}`} />
          ) : (
            <select name="sex" defaultValue={profile?.sex ?? ""} className="field">
              <option value="">—</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          )}
        </label>
        <label>
          <span className="field-label">Nationality</span>
          <input name="nationality" readOnly={locked(profile?.nationality)} defaultValue={profile?.nationality ?? ""} className={`field ${locked(profile?.nationality) ? lockClass : ""}`} placeholder="e.g. Sri Lankan" />
        </label>
        <label>
          <span className="field-label">Phone number</span>
          <input type="tel" name="phone" readOnly={locked(profile?.phone)} defaultValue={profile?.phone ?? ""} className={`field ${locked(profile?.phone) ? lockClass : ""}`} placeholder="+94 …" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Email</span>
          <input type="email" name="email" readOnly={locked(profile?.email)} defaultValue={profile?.email ?? ""} className={`field ${locked(profile?.email) ? lockClass : ""}`} />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Address</span>
          <textarea name="address" rows={2} readOnly={locked(profile?.address)} defaultValue={profile?.address ?? ""} className={`field ${locked(profile?.address) ? lockClass : ""}`} />
        </label>
        <label>
          <span className="field-label">Current passport number</span>
          <input name="passportNumber" readOnly={locked(profile?.passportNumber)} defaultValue={profile?.passportNumber ?? ""} className={`field font-mono uppercase ${locked(profile?.passportNumber) ? lockClass : ""}`} />
        </label>
        <div className="sm:col-span-2">
          <span className="field-label">Previous passport numbers (up to 10)</span>
          {lockFilled && profile?.previousPassports.length ? (
            <>
              <p className="mb-2 font-mono text-sm text-ink-soft">Saved: {profile.previousPassports.join(", ")}</p>
              <PassportListInput name="previousPassports" />
            </>
          ) : (
            <PassportListInput name="previousPassports" defaultValue={profile?.previousPassports} />
          )}
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
