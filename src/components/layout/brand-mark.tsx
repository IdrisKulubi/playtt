import Link from "next/link";
import Image from "next/image";

import { PLAYTT_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  href?: string;
  caption?: string;
  size?: "default" | "compact";
  tone?: "dark" | "light";
  className?: string;
}

export function BrandMark({
  href = "/",
  caption = PLAYTT_TAGLINE,
  size = "default",
  tone = "dark",
  className,
}: BrandMarkProps) {
  const compact = size === "compact";
  const onLight = tone === "light";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-3 transition hover:opacity-90",
        onLight ? "text-foreground" : "text-white",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden",
          compact ? "size-9" : "size-11",
        )}
      >
        <Image
          src="/logo.png"
          alt=""
          width={96}
          height={96}
          className="size-full object-contain"
          priority
        />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-semibold tracking-[0.24em]",
            onLight ? "text-foreground" : "text-white",
            compact ? "text-xs" : "text-sm",
          )}
        >
          PLAYTT
        </span>
        <span
          className={cn(
            onLight ? "text-muted-foreground" : "text-white/50",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {caption}
        </span>
      </span>
    </Link>
  );
}
