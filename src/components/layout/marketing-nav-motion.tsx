"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

interface MarketingNavMotionProps {
  children: ReactNode;
}

export function MarketingNavMotion({ children }: MarketingNavMotionProps) {
  const navRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();

      const nav = navRef.current;
      if (!nav || prefersReducedMotion) return;

      const items = nav.querySelectorAll("[data-nav-reveal]");
      gsap.set(items, { y: -12, opacity: 0 });
      gsap.to(items, {
        y: 0,
        opacity: 1,
        duration: 0.52,
        stagger: 0.055,
        ease: "power4.out",
        delay: 0.08,
      });

      if (!window.matchMedia("(pointer: fine)").matches) return;

      const cleanups = gsap.utils
        .toArray<HTMLElement>("[data-nav-action]")
        .map((action) => {
          const moveX = gsap.quickTo(action, "x", {
            duration: 0.26,
            ease: "power3.out",
          });
          const moveY = gsap.quickTo(action, "y", {
            duration: 0.26,
            ease: "power3.out",
          });
          const onMove = (event: PointerEvent) => {
            const rect = action.getBoundingClientRect();
            moveX(((event.clientX - rect.left) / rect.width - 0.5) * 5);
            moveY(((event.clientY - rect.top) / rect.height - 0.5) * 4);
          };
          const onLeave = () => {
            moveX(0);
            moveY(0);
          };

          action.addEventListener("pointermove", onMove);
          action.addEventListener("pointerleave", onLeave);

          return () => {
            action.removeEventListener("pointermove", onMove);
            action.removeEventListener("pointerleave", onLeave);
          };
        });

      return () => cleanups.forEach((cleanup) => cleanup());
    },
    { scope: navRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <header ref={navRef} className="marketing-nav" data-marketing-nav>
      {children}
    </header>
  );
}
