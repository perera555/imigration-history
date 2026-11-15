"use client";

import { useState } from "react";
import { deleteVisa } from "@/lib/visa-actions";
import { countryName, flagSvg } from "@/lib/countries";
import type { Visa } from "@/lib/data";
import { VisaForm } from "./VisaForm";
import { ConfirmButton } from "./SubmitButton";

/**
 * Add, edit (and for admins, delete) the visas of one record.
 * `expanded` (Update record page): every saved visa is shown as an open form filled with its data,
 * and an empty "Add a visa" form waits below; a newly added visa appears as its own filled form.
 */
export function VisaManager({
  profileId,
  visas,
  passports,
  defaultPassport,
  canDelete,
  expanded = false,
}: {
  profileId: string;
  visas: Visa[];
  passports: string[];
  /** Pre-filled on new visas (the travel card's current passport). */
  defaultPassport?: string | null;
  canDelete: boolean;
  expanded?: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(visas.length ? null : "new");
  const [newKey, setNewKey] = useState(0);

  const header = (v: Visa) => (
    <div className="flex flex-wrap items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagSvg(v.countryCode)} alt="" className="h-6 w-9 rounded-[3px] object-cover" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {countryName(v.countryCode)} · {v.visaType || "Visa"}
          {v.hasDocument && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[10px] text-ink-soft">📎 document</span>}
        </p>
        <p className="text-sm text-ink-soft">
          <span className="font-mono">{v.visaNumber ?? "No number"}</span>
          {v.issueDate && ` · issued ${v.issueDate}`}
          {v.expiryDate && ` · expires ${v.expiryDate}`}
        </p>
      </div>
      {!expanded && (
        <button type="button" onClick={() => setEditing(editing === v.id ? null : v.id)} className="btn btn-ghost !py-1.5">
          {editing === v.id ? "Close" : "Edit"}
        </button>
      )}
      {canDelete && (
        <form action={deleteVisa.bind(null, v.id)}>
          <ConfirmButton message="Delete this visa and its document?" className="btn btn-danger !py-1.5">
            Delete
          </ConfirmButton>
        </form>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div className="space-y-6">
        {visas.map((v, i) => (
          <div key={v.id} className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Visa {i + 1} of {visas.length} · update
            </p>
            {header(v)}
            <div className="mt-4 border-t border-line pt-4">
              <VisaForm profileId={profileId} visa={v} passports={passports} />
            </div>
          </div>
        ))}
        <div className="rounded-2xl border-2 border-dashed border-gold/50 bg-white p-5">
          <h3 className="mb-4 font-serif text-lg font-bold text-navy">+ Add a visa</h3>
          <VisaForm
            key={newKey}
            profileId={profileId}
            passports={passports}
            defaultPassport={defaultPassport}
            onDone={() => setNewKey((k) => k + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visas.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {visas.map((v) => (
            <li key={v.id} className="px-4 py-3">
              {header(v)}
              {editing === v.id && (
                <div className="mt-4 border-t border-line pt-4">
                  <VisaForm profileId={profileId} visa={v} passports={passports} onDone={() => setEditing(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing === "new" ? (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-4 font-serif text-lg font-bold text-navy">Add a visa</h3>
          <VisaForm profileId={profileId} passports={passports} defaultPassport={defaultPassport} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-gold">
          + Add visa
        </button>
      )}
    </div>
  );
}
