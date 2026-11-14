/** "View PDF" (opens in a new tab) and "Download PDF" buttons for a traveller's record. */
export function PdfButtons({ profileId }: { profileId: string }) {
  const href = `/api/profiles/${profileId}/pdf`;
  return (
    <>
      <a href={`${href}?view=1`} target="_blank" rel="noopener" className="btn btn-ghost">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        View PDF
      </a>
      <a href={href} className="btn btn-gold">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Download PDF
      </a>
    </>
  );
}
