"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { MARKETING_EASE_OUT } from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

export function GetStartedMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(() => {
    registerGSAP();
    const scope = ref.current;
    if (!scope) return;
    const surface = scope.querySelector("[data-cta-surface]");
    const content = scope.querySelectorAll("[data-cta-content]");
    const balls = scope.querySelectorAll("[data-cta-ball]");

    if (prefersReducedMotion) {
      gsap.set([surface, ...content, ...balls], { clearProps: "all", opacity: 1 });
      return;
    }

    const timeline = gsap.timeline({ scrollTrigger: { trigger: scope, start: "top 76%", once: true } });
    timeline.fromTo(surface, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.82, ease: MARKETING_EASE_OUT });
    timeline.fromTo(content, { y: 42, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.1, ease: MARKETING_EASE_OUT }, 0.3);
    timeline.fromTo(balls, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.08, ease: MARKETING_EASE_OUT }, 0.38);
  }, { scope: ref, dependencies: [prefersReducedMotion] });

  return <div ref={ref}>{children}</div>;
}
