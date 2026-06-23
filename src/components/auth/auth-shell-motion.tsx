"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";

export function AuthShellMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      registerGSAP();

      const scope = ref.current;
      if (!scope) return;

      const reveal = scope.querySelectorAll("[data-auth-reveal]");
      const card = scope.querySelector("[data-auth-form]");
      const fields = scope.querySelectorAll(".field-cluster > *");
      const actions = scope.querySelectorAll("[data-auth-action]");

      if (prefersReducedMotion) {
        gsap.set([card, ...reveal, ...fields], { clearProps: "all", opacity: 1 });
        return;
      }

      const timeline = gsap.timeline({ defaults: { ease: "power4.out" } });
      timeline.fromTo(
        reveal,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.72, stagger: 0.08 },
        0
      );
      timeline.fromTo(
        card,
        { y: 42, opacity: 0, rotate: 1.2, scale: 0.98 },
        { y: 0, opacity: 1, rotate: 0, scale: 1, duration: 0.82 },
        0.14
      );
      timeline.fromTo(
        fields,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.48, stagger: 0.045 },
        0.42
      );

      if (!window.matchMedia("(pointer: fine)").matches) return;

      const cleanups = gsap.utils.toArray<HTMLElement>(actions).map((action) => {
        const moveX = gsap.quickTo(action, "x", { duration: 0.28, ease: "power3.out" });
        const moveY = gsap.quickTo(action, "y", { duration: 0.28, ease: "power3.out" });
        const onMove = (event: PointerEvent) => {
          const rect = action.getBoundingClientRect();
          moveX(((event.clientX - rect.left) / rect.width - 0.5) * 6);
          moveY(((event.clientY - rect.top) / rect.height - 0.5) * 5);
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
    { scope: ref, dependencies: [prefersReducedMotion] }
  );

  return <div ref={ref}>{children}</div>;
}
