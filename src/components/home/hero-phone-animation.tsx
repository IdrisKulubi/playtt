"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
  HERO_PHONE_SCREENS,
  HeroPhoneScreenContent,
} from "@/components/home/hero-phone-screens";
import {
  MARKETING_EASE_OUT,
  MARKETING_SCREEN_HOLD,
} from "@/components/home/motion/marketing-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerGSAP } from "@/lib/gsap/register-gsap";
import { cn } from "@/lib/utils";

interface HeroPhoneAnimationProps {
  locationName: string | null;
}

export function HeroPhoneAnimation({ locationName }: HeroPhoneAnimationProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      registerGSAP();

      const slides = gsap.utils.toArray<HTMLElement>("[data-phone-slide]");
      if (slides.length === 0) return;

      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(slides[0], { autoAlpha: 1 });

      if (prefersReducedMotion) {
        setActiveIndex(0);
        return;
      }

      const timeline = gsap.timeline({ repeat: -1 });

      slides.forEach((slide, index) => {
        const nextIndex = (index + 1) % slides.length;

        timeline.to(slide, {
          autoAlpha: 0,
          duration: 0.45,
          ease: MARKETING_EASE_OUT,
          delay: MARKETING_SCREEN_HOLD,
          onStart: () => setActiveIndex(nextIndex),
        });
        timeline.to(
          slides[nextIndex],
          {
            autoAlpha: 1,
            duration: 0.45,
            ease: MARKETING_EASE_OUT,
          },
          "<"
        );
      });

      return () => {
        timeline.kill();
      };
    },
    { scope: stageRef, dependencies: [prefersReducedMotion, locationName] }
  );

  return (
    <div ref={stageRef} className="hero-phone-stage" aria-hidden>
      <div className="hero-phone-frame" data-hero-phone>
        <div className="hero-phone-frame__notch" />
        <div className="hero-phone-frame__screen">
          {HERO_PHONE_SCREENS.map((screen) => (
            <div
              key={screen}
              data-phone-slide
              className="hero-phone-frame__slide"
            >
              <HeroPhoneScreenContent
                screen={screen}
                locationName={locationName}
              />
            </div>
          ))}
        </div>
      </div>
      <ol className="hero-phone-dots">
        {HERO_PHONE_SCREENS.map((screen, index) => (
          <li
            key={screen}
            className={cn(
              "hero-phone-dots__dot",
              index === activeIndex && "hero-phone-dots__dot--active"
            )}
          />
        ))}
      </ol>
    </div>
  );
}
