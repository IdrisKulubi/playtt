import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

const footerLinks = {
  Product: [
    { label: "Book", href: "/book" },
    { label: "Locations", href: "#locations" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Create account", href: "/sign-up" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
  ],
  Legal: [
    { label: "Terms", href: "#" },
    { label: "Privacy", href: "#" },
  ],
  Connect: [
    { label: "Twitter", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "TikTok", href: "#" },
  ],
} as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[var(--background)]">
      <div className="section-shell py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="space-y-4 lg:col-span-1">
            <BrandMark caption="Autonomous Table Tennis. Anytime." />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Premium, self-serve table tennis — reserve a pod, play on your
              terms.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <nav key={title} aria-label={title} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="shell-divider mt-10 flex flex-col gap-3 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PlayTT. All rights reserved.</p>
          <p>Built in Nairobi</p>
        </div>
      </div>
    </footer>
  );
}
