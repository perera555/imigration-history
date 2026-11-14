import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-6 max-w-lg">
      <div className="id-card rounded-[1.75rem] p-10 text-center">
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-soft/80">Error 404</p>
          <h1 className="gold-text mt-2 font-serif text-3xl font-bold">Page not found</h1>
          <p className="mt-3 text-sm text-white/70">
            This page or record doesn&apos;t exist anymore. It may have been moved or deleted.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-gold">
              Go to home page
            </Link>
            <Link href="/records" className="btn border border-white/25 text-white hover:bg-white/10">
              View records
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
