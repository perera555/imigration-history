"use client";

import { DateInput } from "./DateInput";
import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/actions";
import type { Trip } from "@/lib/data";
import { CountrySelect } from "./CountrySelect";
import { SubmitButton } from "./SubmitButton";
import { CityInput } from "./CityInput";

const PURPOSES = ["Tour", "Business", "Business & Tour", "Visit", "Family Visit", "Student", "Work", "Transit", "Medical", "Conference"];

export function TripForm({
  action,
  trip,
  passports,
  submitLabel,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  trip?: Trip;
  passports: string[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [country, setCountry] = useState(trip?.countryCode ?? "");
  const [city, setCity] = useState(trip?.city ?? "");

  // After a successful "add", clear the form for the next entry.
  useEffect(() => {
    if (state?.ok && !trip) {
      formRef.current?.reset();
      setCity("");
      setCountry("");
      setFormKey((k) => k + 1);
    }
  }, [state, trip]);

  return (
    <form ref={formRef} key={formKey} action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="field-label">Country *</span>
          <CountrySelect name="countryCode" defaultValue={trip?.countryCode} onChange={setCountry} />
        </div>
        <label>
          <span className="field-label">City (optional)</span>
          <CityInput countryCode={country} value={city} onChange={setCity} />
          <input type="hidden" name="city" value={city} />
        </label>
        <label>
          <span className="field-label">Purpose</span>
          <input name="purpose" list="purposes" defaultValue={trip?.purpose ?? ""} className="field" placeholder="Tour, Business…" />
          <datalist id="purposes">
            {PURPOSES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="field-label">Departure date *</span>
          <DateInput name="departureDate" required defaultValue={trip?.departureDate ?? ""} className="field" />
        </label>
        <label>
          <span className="field-label">Arrival (return) date</span>
          <DateInput name="returnDate" defaultValue={trip?.returnDate ?? ""} className="field" />
        </label>
        <label>
          <span className="field-label">Passport used</span>
          <input
            name="passportNumber"
            list="passport-list"
            defaultValue={trip?.passportNumber ?? ""}
            className="field font-mono uppercase"
            placeholder="Choose or type"
          />
          <datalist id="passport-list">
            {passports.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="sm:col-span-2 lg:col-span-3">
          <span className="field-label">Notes</span>
          <input name="notes" defaultValue={trip?.notes ?? ""} className="field" placeholder="Optional" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}
      </div>
    </form>
  );
}
