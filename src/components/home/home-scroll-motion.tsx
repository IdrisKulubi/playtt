"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

interface HomeScrollMotionProps {
  children: ReactNode;
}

export function HomeScrollMotion({ children }: HomeScrollMotionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();

      const scope = ref.current;
      if (!scope) return;

      const sections = gsap.utils.toArray<HTMLElement>(
        scope.querySelectorAll("[data-home-scroll-section]")
      );

      if (prefersReducedMotion) {
        gsap.set(sections, { clearProps: "all" });
        return;
      }

      sections.forEach((section, index) => {
        const rotate = index === 1 ? -0.7 : index === 2 ? 0.7 : 0;
        const start = index === 0 ? "top 88%" : "top 84%";

        gsap.fromTo(
          section,
          {
            y: 72,
            opacity: 0,
            scale: 0.982,
            rotate,
            clipPath: "inset(0 0 10% 0)",
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            rotate: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.92,
            ease: "power4.out",
            scrollTrigger: {
              trigger: section,
              start,
              once: true,
            },
          }
        );
      });
    },
    { scope: ref, dependencies: [prefersReducedMotion] }
  );

  return (
    <div ref={ref} className="home-scroll-flow">
      {children}
    </div>
  );
}
