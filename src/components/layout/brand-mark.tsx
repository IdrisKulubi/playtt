import Link from "next/link"
import Image from "next/image"

import { PLAYTT_TAGLINE } from "@/lib/brand"
import { cn } from "@/lib/utils"

interface BrandMarkProps {
  href?: string
  caption?: string
  size?: "default" | "compact"
  tone?: "dark" | "light"
  className?: string
}

export function BrandMark({
  href = "/",
  caption = PLAYTT_TAGLINE,
  size = "default",
  tone = "dark",
  className,
}: BrandMarkProps) {
  const compact = size === "compact"
  const onLight = tone === "light"
  const logoSrc = onLight
    ? "/brand/playtt-logo-primary.svg"
    : "/brand/playtt-logo-reversed.svg"

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-3 transition hover:opacity-90",
        onLight ? "text-foreground" : "text-white",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden",
          compact ? "w-24" : "w-32"
        )}
      >
        <Image
          src={logoSrc}
          alt="PlayTT"
          width={690}
          height={200}
          className="h-auto w-full object-contain"
          priority
        />
      </span>
      {caption ? (
        <span className="min-w-0">
          <span
            className={cn(
              onLight ? "text-muted-foreground" : "text-white/50",
              compact ? "text-[11px]" : "text-xs"
            )}
          >
            {caption}
          </span>
        </span>
      ) : null}
    </Link>
  )
}
