"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
  MARKETING_DURATION_MD,
  MARKETING_DURATION_SM,
  MARKETING_EASE_OUT,
  MARKETING_STAGGER_SM,
} from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

interface HeroSectionMotionProps {
  children: ReactNode;
}

export function HeroSectionMotion({ children }: HeroSectionMotionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();

      const scope = sectionRef.current;
      if (!scope) return;

      const eyebrow = scope.querySelector("[data-hero-eyebrow]");
      const availability = scope.querySelector("[data-hero-availability]");
      const lines = scope.querySelectorAll(".hero-line__inner");
      const subcopy = scope.querySelector("[data-hero-subcopy]");
      const ctaPrimary = scope.querySelector("[data-hero-cta-primary]");
      const ctaSecondary = scope.querySelector("[data-hero-cta-secondary]");
      const trust = scope.querySelector("[data-hero-trust]");
      const ticker = scope.querySelector("[data-hero-ticker]");

      const targets = [
        eyebrow,
        availability,
        ...lines,
        subcopy,
        ctaPrimary,
        ctaSecondary,
        trust,
        ticker,
      ].filter(Boolean);

      if (prefersReducedMotion) {
        gsap.set(targets, { clearProps: "all", opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap.set(eyebrow, { y: 12, opacity: 0 });
      gsap.set(availability, { y: -12, opacity: 0 });
      gsap.set(lines, { yPercent: 110 });
      gsap.set(subcopy, { y: 16, opacity: 0 });
      gsap.set([ctaPrimary, ctaSecondary], { scale: 0.96, opacity: 0 });
      gsap.set(trust, { opacity: 0 });
      gsap.set(ticker, { yPercent: 100, opacity: 0 });

      const timeline = gsap.timeline({ defaults: { ease: MARKETING_EASE_OUT } });

      timeline.to(eyebrow, { y: 0, opacity: 1, duration: MARKETING_DURATION_SM }, 0.12);
      timeline.to(
        availability,
        { y: 0, opacity: 1, duration: MARKETING_DURATION_SM },
        0.18
      );
      timeline.to(
        lines,
        { yPercent: 0, duration: MARKETING_DURATION_MD, stagger: MARKETING_STAGGER_SM },
        0.26
      );
      timeline.to(subcopy, { y: 0, opacity: 1, duration: MARKETING_DURATION_SM }, 0.48);
      timeline.to(
        ctaPrimary,
        { scale: 1, opacity: 1, duration: MARKETING_DURATION_SM },
        0.6
      );
      timeline.to(
        ctaSecondary,
        { scale: 1, opacity: 1, duration: MARKETING_DURATION_SM },
        0.68
      );
      timeline.to(trust, { opacity: 1, duration: MARKETING_DURATION_SM }, 0.8);
      timeline.to(ticker, { yPercent: 0, opacity: 1, duration: MARKETING_DURATION_MD }, 0.56);

      if (ticker) {
        gsap.to(ticker, {
          xPercent: -50,
          duration: 26,
          ease: "none",
          repeat: -1,
        });
      }

      const cleanupActions = window.matchMedia("(pointer: fine)").matches
        ? gsap.utils.toArray<HTMLElement>("[data-hero-action]").map((action) => {
            const moveX = gsap.quickTo(action, "x", {
              duration: 0.38,
              ease: MARKETING_EASE_OUT,
            });
            const moveY = gsap.quickTo(action, "y", {
              duration: 0.38,
              ease: MARKETING_EASE_OUT,
            });
            const scale = gsap.quickTo(action, "scale", {
              duration: 0.24,
              ease: MARKETING_EASE_OUT,
            });
            const onMove = (event: PointerEvent) => {
              const bounds = action.getBoundingClientRect();
              moveX(((event.clientX - bounds.left) / bounds.width - 0.5) * 8);
              moveY(((event.clientY - bounds.top) / bounds.height - 0.5) * 6);
            };
            const onEnter = () => scale(1.035);
            const onLeave = () => {
              moveX(0);
              moveY(0);
              scale(1);
            };

            action.addEventListener("pointermove", onMove);
            action.addEventListener("pointerenter", onEnter);
            action.addEventListener("pointerleave", onLeave);

            return () => {
              action.removeEventListener("pointermove", onMove);
              action.removeEventListener("pointerenter", onEnter);
              action.removeEventListener("pointerleave", onLeave);
            };
          })
        : [];

      return () => cleanupActions.forEach((cleanup) => cleanup());
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section ref={sectionRef} aria-labelledby="hero-heading" className="hero-stage">
      {children}
    </section>
  );
}
