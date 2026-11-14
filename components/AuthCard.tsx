export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="id-card rounded-[1.75rem] p-8 text-center">
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-soft/80">{eyebrow}</p>
          <h1 className="gold-text mt-2 font-serif text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-white/70">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
