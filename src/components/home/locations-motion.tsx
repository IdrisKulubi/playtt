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
      const map = scope.querySelector("[data-locations-map]");
      const orbits = scope.querySelectorAll("[data-locations-orbit]");
      const markers = scope.querySelectorAll("[data-location-marker]");
      const rows = scope.querySelectorAll("[data-location-row]");
      const featured = scope.querySelector("[data-locations-featured]");
      const pulses = scope.querySelectorAll("[data-locations-pulse]");

      if (prefersReducedMotion) {
        gsap.set([heading, map, path, featured, ...orbits, ...markers, ...rows], { clearProps: "all", opacity: 1 });
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
        orbits,
        { scale: 0.7, opacity: 0, transformOrigin: "50% 50%" },
        { scale: 1, opacity: 1, duration: 0.8, stagger: 0.1, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 68%", once: true } }
      );

      gsap.fromTo(
        heading,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 76%", once: true } }
      );
      gsap.fromTo(
        map,
        { y: 48, opacity: 0, rotate: -1.5, scale: 0.96 },
        { y: 0, opacity: 1, rotate: 0, scale: 1, duration: 0.82, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 60%", once: true } }
      );
      gsap.fromTo(
        markers,
        { scale: 0.25, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, stagger: 0.12, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 62%", once: true } }
      );
      gsap.fromTo(
        featured,
        { y: 38, opacity: 0, rotate: -3 },
        { y: 0, opacity: 1, rotate: 0, duration: 0.72, ease: MARKETING_EASE_OUT, scrollTrigger: { trigger: scope, start: "top 62%", once: true } }
      );
      gsap.to(pulses, { scale: 1.7, opacity: 0, duration: 1.7, stagger: 0.36, repeat: -1, ease: "power2.out" });
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
