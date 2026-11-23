"use client";

import { useActionState, useEffect, useState } from "react";
import { readDocument, type ExtractState, type ImportProfile, type ImportTrip } from "@/lib/actions";
import { RecordForm } from "./RecordForm";
import type { VisitStay } from "./VisitBookings";
import { SubmitButton } from "./SubmitButton";

const tripKey = (t: ImportTrip) => `${t.countryCode}|${t.departureDate}|${t.returnDate ?? ""}`;

/**
 * Update record form with "Fill from a document": reads an uploaded PDF and fills the form
 * section by section: empty travel card fields, plus every country/visit not already listed.
 * Nothing is saved until the user presses a Save button.
 */
export function UpdateRecordForm({
  updateId,
  formKey,
  initialProfile,
  initialTrips,
  stays,
}: {
  updateId: string;
  formKey: string;
  stays?: VisitStay[];
  initialProfile: ImportProfile;
  initialTrips: ImportTrip[];
}) {
  const [state, action] = useActionState<ExtractState, FormData>(readDocument, undefined);
  const [filled, setFilled] = useState<{ n: number; profile: ImportProfile; trips: ImportTrip[]; addedTrips: number; addedFields: number } | null>(null);

  useEffect(() => {
    if (!state || !("ok" in state)) return;
    // Travel card: only fill fields that are empty now.
    const profile: ImportProfile = { ...initialProfile };
    let addedFields = 0;
    for (const [k, v] of Object.entries(state.profile) as [keyof ImportProfile, unknown][]) {
      if (k === "previousPassports" || k === "photo") continue;
      const cur = profile[k];
      if ((cur === null || cur === undefined || cur === "") && v) {
        (profile as Record<string, unknown>)[k] = v;
        addedFields++;
      }
    }
    const pp = [...new Set([...initialProfile.previousPassports, ...state.profile.previousPassports])].slice(0, 10);
    if (pp.length > initialProfile.previousPassports.length) addedFields++;
    profile.previousPassports = pp;
    // Immigration record: keep what's there, add only new visits.
    const have = new Set(initialTrips.map(tripKey));
    const fresh = state.trips.filter((t) => !have.has(tripKey(t)));
    setFilled((f) => ({ n: (f?.n ?? 0) + 1, profile, trips: [...initialTrips, ...fresh], addedTrips: fresh.length, addedFields }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="space-y-8">
      <section className="panel border-dashed p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Optional</p>
        <h2 className="mt-1 font-serif text-xl font-bold text-navy">Fill from a document</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Upload an immigration history PDF. Empty <b>travel card</b> fields are filled and every <b>country &amp; visit</b> that
          isn&apos;t listed yet is added below. Check each section, then press its Save button.
        </p>
        <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <SubmitButton className="btn btn-gold" pendingText="Reading document…">
            Read document &amp; fill form
          </SubmitButton>
        </form>
        {state && "error" in state && <p className="mt-3 text-sm font-medium text-danger">{state.error}</p>}
        {filled && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900">
            ✓ Filled from the document: {filled.addedFields} travel card field{filled.addedFields === 1 ? "" : "s"} and{" "}
            {filled.addedTrips} new visit{filled.addedTrips === 1 ? "" : "s"}
            {filled.addedTrips === 0 && " (all visits in the document are already in the record)"}. Nothing is saved yet. Check the
            sections below and press <b>Save travel card</b> / <b>Save immigration record</b>.
          </p>
        )}
        {state && "ok" in state && state.issues.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 rounded-xl border border-amber-300 bg-amber-50 py-3 pl-8 pr-4 text-sm text-amber-900">
            {state.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </section>

      <RecordForm
        key={filled ? `filled-${filled.n}` : formKey}
        target={updateId}
        updateId={updateId}
        stays={stays}
        saveLabel="Save / Update record"
        initialProfile={filled?.profile ?? initialProfile}
        initialTrips={filled?.trips ?? initialTrips}
      />
    </div>
  );
}
