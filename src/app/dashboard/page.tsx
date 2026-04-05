import Link from "next/link";

import { SessionPanel } from "@/components/auth/session-panel";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,183,255,0.14),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.03),_transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Auth verification checkpoint
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </div>

        <SessionPanel />
      </div>
    </main>
  );
}
