import Link from "next/link";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  href?: string;
  caption?: string;
  size?: "default" | "compact";
  className?: string;
}

export function BrandMark({
  href = "/",
  caption = "Autonomous Table Tennis. Anytime.",
  size = "default",
  className,
}: BrandMarkProps) {
  const compact = size === "compact";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-3 text-white transition hover:opacity-90",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border bg-secondary font-semibold text-primary",
          compact ? "size-10 text-sm" : "size-12 text-base",
        )}
      >
        TT
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-semibold tracking-[0.24em] text-white",
            compact ? "text-xs" : "text-sm",
          )}
        >
          PLAYTT
        </span>
        <span className={cn("block text-white/50", compact ? "text-[11px]" : "text-xs")}>
          {caption}
        </span>
      </span>
    </Link>
  );
}
