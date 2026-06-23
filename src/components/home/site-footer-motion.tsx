"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { MARKETING_EASE_OUT } from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

export function SiteFooterMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(() => {
    registerGSAP();
    const scope = ref.current;
    if (!scope) return;
    const word = scope.querySelector("[data-footer-word]");
    const groups = scope.querySelectorAll("[data-footer-group]");
    const base = scope.querySelector("[data-footer-base]");

    if (prefersReducedMotion) {
      gsap.set([scope, word, ...groups, base], { clearProps: "all", opacity: 1 });
      return;
    }

    const timeline = gsap.timeline({ scrollTrigger: { trigger: scope, start: "top 82%", once: true } });
    timeline.fromTo(
      scope,
      { y: 64, opacity: 0, scale: 0.985, clipPath: "inset(0 0 10% 0)" },
      { y: 0, opacity: 1, scale: 1, clipPath: "inset(0 0 0% 0)", duration: 0.88, ease: "power4.out" }
    );
    timeline.fromTo(word, { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.85, ease: MARKETING_EASE_OUT }, 0.1);
    timeline.fromTo(groups, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: MARKETING_EASE_OUT }, 0.32);
    timeline.fromTo(base, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.72);
  }, { scope: ref, dependencies: [prefersReducedMotion] });

  return <footer ref={ref}>{children}</footer>;
}
