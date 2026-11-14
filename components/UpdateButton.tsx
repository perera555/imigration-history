import Link from "next/link";

/** Opens the full record form pre-filled with everything from the database. */
export function UpdateButton({ profileId, className = "btn btn-primary" }: { profileId: string; className?: string }) {
  return (
    <Link href={`/admin/profiles/${profileId}/update`} className={className}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      Update record
    </Link>
  );
}
