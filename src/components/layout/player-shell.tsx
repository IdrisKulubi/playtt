"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ChartBarIcon,
  HouseIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";

type PlayerShellProps = {
  title: string;
  eyebrow?: string;
  backHref?: string;
  children: ReactNode;
};

const navigation = [
  { href: "/dashboard", label: "Home", icon: HouseIcon },
  { href: "/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/activity", label: "Activity", icon: ChartBarIcon },
  { href: "/community", label: "Community", icon: UsersThreeIcon },
  { href: "/account", label: "Account", icon: UserCircleIcon },
] as const;

export function PlayerShell({
  title,
  eyebrow,
  backHref,
  children,
}: PlayerShellProps) {
  const pathname = usePathname();
  const isBookingFlow = pathname === "/book";

  useGSAP(() => {
    if (isBookingFlow) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    gsap.from("[data-player-shell-content]", {
      opacity: 0,
      y: 10,
      duration: 0.35,
      delay: 0.08,
      ease: "power3.out",
    });
  }, [isBookingFlow]);

  return (
    <main className={isBookingFlow ? "player-shell player-shell--booking" : "player-shell"}>
      <aside className="player-shell__sidebar">
        <BrandMark size="compact" tone="light" />
        <nav aria-label="Player navigation" className="player-shell__nav">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "player-shell__nav-link player-shell__nav-link--active"
                    : "player-shell__nav-link"
                }
              >
                <Icon className="size-5" weight={active ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <Link href="/book" className="player-shell__book-link">
          Book a session
        </Link>
      </aside>

      <section
        className={
          isBookingFlow
            ? "player-shell__main player-shell__main--booking"
            : "player-shell__main"
        }
        data-player-shell-content
      >
        <header className="player-shell__header">
          <div className="flex min-w-0 items-center gap-3">
            {backHref ? (
              <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
                <Link href={backHref} aria-label="Back">
                  <ArrowLeftIcon className="size-4" />
                </Link>
              </Button>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="player-shell__eyebrow">{eyebrow}</p> : null}
              <h1>{title}</h1>
            </div>
          </div>
          {!isBookingFlow ? (
            <Link href="/book" className="player-shell__header-action">
              Book
            </Link>
          ) : null}
        </header>

        <div className="player-shell__content">{children}</div>
      </section>

      <nav aria-label="Player navigation" className="player-shell__mobile-nav">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "player-shell__mobile-link player-shell__mobile-link--active"
                  : "player-shell__mobile-link"
              }
            >
              <Icon className="size-5" weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
