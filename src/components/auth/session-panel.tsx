"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LightningIcon, SignOutIcon, TableIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SessionPanel() {
  const router = useRouter();
  const { data: session, isPending, error } = authClient.useSession();

  async function handleSignOut() {
    const result = await authClient.signOut();

    if (result.error) {
      toast.error(result.error.message || "Failed to sign out");
      return;
    }

    toast.success("Signed out");
    router.push("/sign-in");
    router.refresh();
  }

  if (isPending) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle>Checking session</CardTitle>
          <CardDescription>
            Verifying your PlayTT account and loading the app shell.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardHeader>
          <CardTitle>Session unavailable</CardTitle>
          <CardDescription>
            The auth client could not load your session. Check the API route and env
            values, then try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle>Authentication setup ready</CardTitle>
          <CardDescription>
            The UI is connected. Create an account or sign in to verify the full
            flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-white/[0.04] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Badge className="border border-primary/20 bg-primary/10 text-primary">
            Auth connected
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <SignOutIcon className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
        <div>
          <CardTitle className="text-2xl text-white">
            Welcome, {session.user.name || "Player"}
          </CardTitle>
          <CardDescription className="mt-2 text-white/65">
            Your account is active and the initial app shell is working.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
            <LightningIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-sm text-white/55">Signed in email</p>
            <p className="mt-1 break-all text-sm font-medium text-white">
              {session.user.email}
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
            <TableIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-sm text-white/55">User id</p>
            <p className="mt-1 break-all text-sm font-medium text-white">
              {session.user.id}
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm text-white/55">Next build target</p>
            <p className="mt-4 text-lg font-semibold text-white">
              Booking availability
            </p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-primary/15 bg-primary/6 p-5 text-sm leading-7 text-white/72">
          Authentication is now the verified entry point into PlayTT. Once you can
          create an account, verify email, sign in, and sign out here, we can safely
          layer booking flows on top.
        </div>
      </CardContent>
    </Card>
  );
}
