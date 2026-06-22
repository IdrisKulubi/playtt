"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { MARKETING_EASE_OUT } from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

interface LocationsMotionProps {
  children: ReactNode;
}

export function LocationsMotion({ children }: LocationsMotionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();
      const scope = sectionRef.current;
      if (!scope) return;

      const heading = scope.querySelector("[data-locations-heading]");
      const path = scope.querySelector("[data-locations-path]");
      const markers = scope.querySelectorAll("[data-location-marker]");
      const rows = scope.querySelectorAll("[data-location-row]");

      if (prefersReducedMotion) {
        gsap.set([heading, path, ...markers, ...rows], { clearProps: "all", opacity: 1 });
        return;
      }

      if (path instanceof SVGPathElement) {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.05,
          ease: MARKETING_EASE_OUT,
          scrollTrigger: { trigger: scope, start: "top 76%", once: true },
        });
      }

      gsap.fromTo(
        heading,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 76%", once: true } }
      );
      gsap.fromTo(
        markers,
        { scale: 0.25, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, stagger: 0.12, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 62%", once: true } }
      );
      gsap.fromTo(
        rows,
        { x: 42, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 54%", once: true } }
      );
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return <section ref={sectionRef}>{children}</section>;
}
