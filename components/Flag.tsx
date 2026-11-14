import { countryName, flagSvg } from "@/lib/countries";

export function Flag({ code, className = "h-5 w-7" }: { code: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSvg(code)}
      alt={`${countryName(code)} flag`}
      loading="lazy"
      className={`${className} shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`}
    />
  );
}
