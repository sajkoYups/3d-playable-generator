import Link from "next/link";
import { cn } from "@/lib/utils";

export const FORGEPLAY_MARK_SRC = "/forgeplay-logo/forgeplay-orange.svg";

export function ForgePlayMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG mark, not a remote LCP image
    <img src={FORGEPLAY_MARK_SRC} alt={alt} className={cn("h-7 w-7 shrink-0", className)} />
  );
}

export function ForgePlayWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-display)] font-semibold tracking-tight", className)}>
      Forge<span className="text-accent">Play</span>
    </span>
  );
}

export function ForgePlayLogo({
  href,
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ForgePlayMark className={markClassName} alt={showWordmark ? "" : "ForgePlay"} />
      {showWordmark ? <ForgePlayWordmark className={wordmarkClassName} /> : null}
    </span>
  );
  if (!href) return content;
  return (
    <Link
      href={href}
      aria-label={showWordmark ? undefined : "ForgePlay"}
      className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {content}
    </Link>
  );
}
