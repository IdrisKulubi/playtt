"use client";

import { SessionPanel } from "@/components/auth/session-panel";
import { authClient } from "@/lib/auth-client";

export function HomeAccountSection() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session?.user) {
    return null;
  }

  return (
    <section aria-labelledby="account-heading" className="mt-16 lg:mt-20">
      <div className="mb-6 space-y-2">
        <p className="section-label">Your account</p>
        <h2 id="account-heading" className="text-2xl font-semibold tracking-[-0.02em] text-white">
          Pick up where you left off
        </h2>
      </div>
      <SessionPanel />
    </section>
  );
}
