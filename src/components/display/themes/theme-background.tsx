"use client"

import { useEffect, useRef } from "react"

import {
  FIELD_SCALE,
  GLASS_ORB_COUNT,
  drawThemeField,
  glassOrbLayout,
  type ThemeComposition,
} from "@/components/display/themes/theme-renderers"
import type { DisplayTheme } from "@/lib/display-themes"

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/**
 * Animated theme background that fills its container: the colour field on a
 * soft canvas, plus real frosted-glass spheres for Liquid Glass. `speed`
 * lets calmer states (a free table) move slower than a live game.
 */
export function ThemeBackground({
  theme,
  speed = 1,
  composition = "left",
  className = "",
}: {
  theme: DisplayTheme
  speed?: number
  /** Where the text sits, so visuals keep clear of it. */
  composition?: ThemeComposition
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const orbRefs = useRef<(HTMLDivElement | null)[]>([])
  const themeRef = useRef(theme)
  const speedRef = useRef(speed)
  const compositionRef = useRef(composition)

  useEffect(() => {
    themeRef.current = theme
    speedRef.current = speed
    compositionRef.current = composition
  }, [theme, speed, composition])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!container || !canvas || !ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let width = 0
    let height = 0
    const resize = () => {
      width = container.clientWidth
      height = container.clientHeight
      canvas.width = Math.max(32, Math.round(width * FIELD_SCALE))
      canvas.height = Math.max(18, Math.round(height * FIELD_SCALE))
      // Softness and glass blur scale with the container, so a small admin
      // preview looks like a shrunk TV, not a blurrier one.
      canvas.style.filter = `blur(${Math.max(1.5, height * 0.01).toFixed(1)}px)`
      const glassBlur = `blur(${Math.max(3, height * 0.026).toFixed(1)}px) saturate(1.12) brightness(1.04)`
      orbRefs.current.forEach((el) => {
        if (!el) return
        el.style.backdropFilter = glassBlur
        el.style.setProperty("-webkit-backdrop-filter", glassBlur)
      })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // Start part-way into the loop so the first frame is already composed.
    let clock = 40
    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!reduced) clock += dt * speedRef.current
      const current = themeRef.current
      drawThemeField(ctx, canvas.width, canvas.height, clock, current, compositionRef.current)
      const glass = current.renderer === "liquid_glass"
      const layout = glass ? glassOrbLayout(clock, width, height, compositionRef.current) : []
      orbRefs.current.forEach((el, index) => {
        if (!el) return
        const orb = layout[index]
        el.style.display = orb ? "block" : "none"
        if (!orb) return
        el.style.width = el.style.height = `${orb.d}px`
        el.style.transform = `translate(${orb.x - orb.d / 2}px, ${orb.y - orb.d / 2}px)`
      })
      if (!reduced) frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{ inset: "-2%", width: "104%", height: "104%" }}
      />
      {Array.from({ length: GLASS_ORB_COUNT }, (_, index) => (
        <div
          key={index}
          ref={(el) => {
            orbRefs.current[index] = el
          }}
          className="tv-glass-orb absolute top-0 left-0 hidden rounded-full"
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-soft-light"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  )
}
