"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface HeroRallyCursorProps {
  targetRef: React.RefObject<HTMLElement | null>;
}

export function HeroRallyCursor({ targetRef }: HeroRallyCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const target = targetRef.current;
    const cursor = cursorRef.current;
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;

    if (!target || !cursor || prefersReducedMotion || !supportsFinePointer) return;

    const moveX = gsap.quickTo(cursor, "x", { duration: 0.32, ease: "power3.out" });
    const moveY = gsap.quickTo(cursor, "y", { duration: 0.32, ease: "power3.out" });
    const handleMove = (event: PointerEvent) => {
      cursor.classList.add("hero-rally-cursor--visible");
      cursor.style.setProperty("opacity", "1", "important");
      moveX(event.clientX);
      moveY(event.clientY);
    };
    const handleEnter = () => {
      cursor.classList.add("hero-rally-cursor--visible");
      cursor.style.setProperty("opacity", "1", "important");
    };
    const handleLeave = () => {
      cursor.classList.remove("hero-rally-cursor--visible");
      cursor.style.removeProperty("opacity");
    };
    const handleOver = (event: PointerEvent) => {
      cursor.classList.toggle(
        "hero-rally-cursor--active",
        event.target instanceof Element && Boolean(event.target.closest("a, button"))
      );
    };

    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerenter", handleEnter);
    target.addEventListener("pointerleave", handleLeave);
    target.addEventListener("pointerover", handleOver);

    return () => {
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerenter", handleEnter);
      target.removeEventListener("pointerleave", handleLeave);
      target.removeEventListener("pointerover", handleOver);
    };
  }, [prefersReducedMotion, targetRef]);

  return (
    <div ref={cursorRef} className="hero-rally-cursor" aria-hidden>
      <span className="hero-rally-cursor__core" />
      <span className="hero-rally-cursor__label">Rally</span>
    </div>
  );
}
