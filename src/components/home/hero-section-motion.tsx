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
import { HeroRallyCursor } from "@/components/home/hero-rally-cursor";
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

      const glow = scope.querySelector("[data-hero-glow]");
      const rallyLight = scope.querySelector("[data-rally-light]");
      const room = scope.querySelector("[data-rally-room]");
      const court = scope.querySelector("[data-rally-court]");
      const net = scope.querySelector("[data-rally-net]");
      const trajectory = scope.querySelector("[data-rally-trajectory]");
      const ball = scope.querySelector("[data-rally-ball]");
      const ballCore = scope.querySelector("[data-rally-ball-core]");
      const eyebrow = scope.querySelector("[data-hero-eyebrow]");
      const lines = scope.querySelectorAll(".hero-line__inner");
      const subcopy = scope.querySelector("[data-hero-subcopy]");
      const tagline = scope.querySelector("[data-hero-tagline]");
      const ctaPrimary = scope.querySelector("[data-hero-cta-primary]");
      const ctaSecondary = scope.querySelector("[data-hero-cta-secondary]");
      const booking = scope.querySelector("[data-rally-booking]");
      const chips = scope.querySelectorAll("[data-rally-chip]");
      const caption = scope.querySelector("[data-rally-caption]");
      const trust = scope.querySelector("[data-hero-trust]");

      const targets = [
        glow,
        rallyLight,
        room,
        court,
        net,
        trajectory,
        ball,
        ballCore,
        eyebrow,
        ...lines,
        subcopy,
        tagline,
        ctaPrimary,
        ctaSecondary,
        booking,
        ...chips,
        caption,
        trust,
      ].filter(Boolean);

      if (prefersReducedMotion) {
        gsap.set(targets, { clearProps: "all", opacity: 1, y: 0, scale: 1 });
        return;
      }

      const drawablePaths = [
        ...gsap.utils.toArray<SVGPathElement>(scope.querySelectorAll("[data-rally-room] path")),
        ...gsap.utils.toArray<SVGPathElement>(scope.querySelectorAll("[data-rally-court] path")),
        ...gsap.utils.toArray<SVGPathElement>(scope.querySelectorAll("[data-rally-net] path")),
      ];

      drawablePaths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
      });

      if (trajectory instanceof SVGPathElement) {
        const length = trajectory.getTotalLength();
        gsap.set(trajectory, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
        gsap.set([ball, ballCore], { opacity: 0 });
      }

      gsap.set(glow, { scale: 0.75, opacity: 0 });
      gsap.set(rallyLight, { scale: 0.82, opacity: 0, transformOrigin: "58% 46%" });
      gsap.set(room, { opacity: 0 });
      gsap.set(eyebrow, { y: 12, opacity: 0 });
      gsap.set(lines, { yPercent: 110 });
      gsap.set([subcopy, tagline], { y: 16, opacity: 0 });
      gsap.set([ctaPrimary, ctaSecondary], { scale: 0.96, opacity: 0 });
      gsap.set(booking, { y: 24, opacity: 0, rotateX: 8, transformPerspective: 900 });
      gsap.set(chips, { y: 22, opacity: 0, rotate: 8 });
      gsap.set(caption, { y: 10, opacity: 0 });
      gsap.set(trust, { opacity: 0 });

      const timeline = gsap.timeline({ defaults: { ease: MARKETING_EASE_OUT } });

      timeline.to([glow, rallyLight], { scale: 1, opacity: 0.52, duration: 0.5 }, 0);
      timeline.to(room, { opacity: 0.7, duration: 0.45 }, 0.08);
      timeline.to(
        scope.querySelectorAll("[data-rally-court] path"),
        { strokeDashoffset: 0, duration: 0.62, stagger: 0.035 },
        0.16
      );
      timeline.to(
        scope.querySelectorAll("[data-rally-net] path"),
        { strokeDashoffset: 0, duration: 0.32, stagger: 0.025 },
        0.44
      );
      if (trajectory instanceof SVGPathElement) {
        timeline.to(trajectory, { strokeDashoffset: 0, duration: 0.68 }, 0.32);
        timeline.to([ball, ballCore], { opacity: 1, duration: 0.08 }, 0.33);
        timeline.to([ball, ballCore], { x: 650, y: -394, duration: 0.72 }, 0.34);
      }

      timeline.to(eyebrow, { y: 0, opacity: 1, duration: MARKETING_DURATION_SM }, 0.34);
      timeline.to(
        lines,
        { yPercent: 0, duration: MARKETING_DURATION_MD, stagger: MARKETING_STAGGER_SM },
        0.44
      );
      timeline.to(
        [subcopy, tagline],
        { y: 0, opacity: 1, duration: MARKETING_DURATION_SM, stagger: 0.06 },
        0.62
      );
      timeline.to(
        ctaPrimary,
        { scale: 1, opacity: 1, duration: MARKETING_DURATION_SM },
        0.76
      );
      timeline.to(
        ctaSecondary,
        { scale: 1, opacity: 1, duration: MARKETING_DURATION_SM },
        0.86
      );
      timeline.to(
        booking,
        { y: 0, opacity: 1, rotateX: 0, duration: MARKETING_DURATION_MD },
        0.88
      );
      timeline.to(chips, { y: 0, opacity: 1, rotate: 0, duration: 0.45, stagger: 0.09 }, 0.96);
      timeline.to(caption, { y: 0, opacity: 1, duration: MARKETING_DURATION_SM }, 1.02);
      timeline.to(trust, { opacity: 1, duration: MARKETING_DURATION_SM }, 1.16);

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
      <div className="hero-ambient-glow" data-hero-glow aria-hidden />
      {children}
      <HeroRallyCursor targetRef={sectionRef} />
    </section>
  );
}
