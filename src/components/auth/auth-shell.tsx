import type { ReactNode } from "react";
import Link from "next/link";
import { AuthShellMotion } from "@/components/auth/auth-shell-motion";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  children: ReactNode;
  title: string;
  description: string;
}

const trustSignals = ["Private pods", "Clear pricing", "Mobile booking"] as const;

export function AuthShell({ children, title, description }: AuthShellProps) {
  return (
    <AuthShellMotion>
      <main className="dark auth-experience">
        <div className="auth-home-mark" data-auth-reveal>
          <BrandMark tone="dark" />
        </div>

        <div className="auth-experience__shell">
          <section className="auth-story" aria-labelledby="auth-story-heading">
            <p className="auth-story__eyebrow" data-auth-reveal>
              Your table is waiting
            </p>
            <h1 id="auth-story-heading" className="auth-story__headline" data-auth-reveal>
              Create the account.
              <span>Keep the rally moving.</span>
            </h1>
            <p className="auth-story__copy" data-auth-reveal>
              Save your details once, book faster next time, and keep every
              private PlayTT session in one place.
            </p>
            <ul className="auth-story__trust" data-auth-reveal>
              {trustSignals.map((signal, index) => (
                <li key={signal}>
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  {signal}
                </li>
              ))}
            </ul>
          </section>

          <section className="auth-panel" aria-labelledby="auth-page-title">
            <div className="auth-panel__intro" data-auth-reveal>
              <p>Player account</p>
              <h2 id="auth-page-title">{title}</h2>
              <span>{description}</span>
            </div>

            {children}

            <div className="auth-panel__footer" data-auth-reveal>
              <span>PlayTT account</span>
              <Button asChild variant="link" className="h-auto p-0 text-[#17140f]">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>
    </AuthShellMotion>
  );
}
