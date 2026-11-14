"use client";

import { useActionState } from "react";
import { readDocument, type ExtractState } from "@/lib/actions";
import { SubmitButton } from "./SubmitButton";
import { RecordForm } from "./RecordForm";

/**
 * All-in-one record form: optional document upload at the top fills the
 * travel card and the country/visits form below; everything can also be typed by hand.
 */
export function DocumentImport({
  profiles,
  defaultTarget,
  allowNew = true,
}: {
  profiles: { id: string; fullName: string }[];
  defaultTarget: string;
  allowNew?: boolean;
}) {
  const [state, action] = useActionState<ExtractState, FormData>(readDocument, undefined);
  const extracted = state && "ok" in state ? state : null;

  const targets = [
    ...(allowNew ? [{ value: "new", label: "➕ New traveller" }] : []),
    ...profiles.map((p) => ({ value: p.id, label: `${p.fullName} (add to existing record)` })),
  ];

  return (
    <div className="space-y-8">
      <section className="panel border-dashed p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Optional</p>
        <h2 className="mt-1 font-serif text-xl font-bold text-navy">Fill automatically from a document</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Upload a PDF or photo of an immigration history, travel record or passport page. The form below is filled for
          you to check. Or skip this and type everything in by hand.
        </p>
        <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="field max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <SubmitButton className="btn btn-gold" pendingText="Reading document… (up to a minute)">
            Read document
          </SubmitButton>
        </form>
        {state && "error" in state && <p className="mt-3 text-sm font-medium text-danger">{state.error}</p>}
        {extracted && (
          <p className="mt-3 text-sm font-medium text-ok">
            ✓ Read {extracted.trips.length} trips. Please check the form below, then save.
          </p>
        )}
      </section>

      {extracted && extracted.issues.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Please check these points from the document:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {extracted.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Re-mount with the extracted data each time a document is read */}
      <RecordForm
        key={extracted ? JSON.stringify(extracted.trips).length + extracted.trips.length : "blank"}
        target={defaultTarget}
        targets={targets}
        initialProfile={extracted ? { ...extracted.profile, photo: null } : undefined}
        initialTrips={extracted?.trips}
        saveLabel="Save travel card & record"
      />
    </div>
  );
}
