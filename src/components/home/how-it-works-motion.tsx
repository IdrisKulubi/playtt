"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { MARKETING_EASE_OUT } from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

interface HowItWorksMotionProps {
  children: ReactNode;
}

export function HowItWorksMotion({ children }: HowItWorksMotionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();
      const scope = sectionRef.current;
      if (!scope) return;

      const stages = gsap.utils.toArray<HTMLElement>("[data-how-stage]");
      const rail = scope.querySelector("[data-how-rail]");
      const ball = scope.querySelector("[data-how-ball]");
      const heading = scope.querySelector("[data-how-heading]");

      if (prefersReducedMotion) {
        gsap.set([heading, rail, ball, ...stages], { clearProps: "all", opacity: 1 });
        return;
      }

      gsap.fromTo(
        heading,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          ease: MARKETING_EASE_OUT,
          scrollTrigger: { trigger: scope, start: "top 75%" },
        }
      );
      const desktopSequence = window.matchMedia("(min-width: 1024px)").matches;

      if (desktopSequence && rail instanceof HTMLElement && ball instanceof HTMLElement) {
        gsap.set(ball, { opacity: 1, scale: 0.75 });
        gsap.fromTo(
          rail,
          { scaleY: 0, transformOrigin: "top" },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: scope, start: "top 68%", end: "bottom 64%", scrub: 0.45 },
          }
        );
        gsap.to(ball, {
          y: () => Math.max(0, rail.offsetHeight - ball.offsetHeight),
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: scope, start: "top 68%", end: "bottom 64%", scrub: 0.45 },
        });
      }

      stages.forEach((stage, index) => {
        const phone = stage.querySelector("[data-how-phone]");
        const copy = stage.querySelector("[data-how-copy]");
        const fromX = index % 2 === 0 ? -56 : 56;

        if (desktopSequence) {
          const tilt = index % 2 === 0 ? -13 : 13;
          const settleTilt = index % 2 === 0 ? -4 : 4;
          const sequence = gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              start: "top 82%",
              end: "center 52%",
              scrub: 0.55,
              onToggle: ({ isActive }) => stage.classList.toggle("how-rally-stage--active", isActive),
            },
          });

          sequence.fromTo(
            copy,
            { x: fromX, y: 64, opacity: 0 },
            { x: 0, y: 0, opacity: 1, duration: 1, ease: MARKETING_EASE_OUT },
            0
          );
          sequence.fromTo(
            phone,
            { x: -fromX * 0.8, y: 130, opacity: 0, rotate: tilt, scale: 0.82 },
            { x: 0, y: -20, opacity: 1, rotate: settleTilt, scale: 1, duration: 1, ease: MARKETING_EASE_OUT },
            0.08
          );
          sequence.to(phone, { y: -8, rotate: 0, duration: 0.45, ease: MARKETING_EASE_OUT }, 0.72);
        } else {
          gsap.fromTo(
            [copy, phone],
            { x: fromX, y: 38, opacity: 0, rotate: index % 2 === 0 ? -3 : 3 },
            {
              x: 0,
              y: 0,
              opacity: 1,
              rotate: 0,
              duration: 0.78,
              stagger: 0.1,
              ease: MARKETING_EASE_OUT,
              scrollTrigger: { trigger: stage, start: "top 76%", once: true },
            }
          );
        }
      });
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return <section ref={sectionRef}>{children}</section>;
}
