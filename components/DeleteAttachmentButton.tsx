"use client";

import { useTransition } from "react";
import { deleteAttachment, type AttachmentKind } from "@/lib/attachment-actions";

/** "🗑 Delete PDF / photo": removes only the file, keeps the visa / boarding pass / stay. Admins. */
export function DeleteAttachmentButton({ kind, id, label = "🗑 Delete PDF / photo" }: { kind: AttachmentKind; id: string; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this PDF / photo? The details are kept. (You can get it back from Backup & recovery.)")) start(() => deleteAttachment(kind, id).then(() => {}));
      }}
      className="btn btn-danger !py-1.5 text-xs"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
