import Link from "next/link";

/** Opens the separate Visas page of a record. */
export function VisasButton({ profileId, className = "btn btn-ghost" }: { profileId: string; className?: string }) {
  return (
    <Link href={`/admin/profiles/${profileId}/visas`} className={className}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h6M7 13h10M7 17h4" />
        <circle cx="17" cy="9" r="1.5" />
      </svg>
      Visas
    </Link>
  );
}
