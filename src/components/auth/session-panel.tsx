"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  LightningIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SignOutIcon,
  TableIcon,
} from "@phosphor-icons/react";
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
      <Card className="glass-panel-strong border-white/10">
        <CardHeader>
          <CardTitle className="text-xl text-white">Checking session</CardTitle>
          <CardDescription>
            Verifying your PlayTT account and loading the app shell.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-panel border-red-500/30 bg-red-500/10">
        <CardHeader>
          <CardTitle className="text-xl text-white">Session unavailable</CardTitle>
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
      <Card className="glass-panel-strong border-white/10">
        <CardHeader className="space-y-4">
          <Badge className="w-fit border border-primary/20 bg-primary/10 text-primary">
            Ready for sign-in
          </Badge>
          <CardTitle className="text-2xl text-white">Authentication setup ready</CardTitle>
          <CardDescription>
            The entry experience is wired. Create an account or sign in to move from landing to booking with a real session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/50">Flow state</p>
              <p className="mt-2 text-base font-medium text-white">Guest browsing</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/50">Next action</p>
              <p className="mt-2 text-base font-medium text-white">Create a player account</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>

          <Button asChild variant="ghost" className="w-full justify-between border border-white/10 bg-white/[0.03]">
            <Link href="/book">
              Preview booking experience
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel-strong border-primary/15">
      <CardHeader className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Badge className="border border-primary/20 bg-primary/10 text-primary">
            Session active
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <SignOutIcon className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
        <div className="space-y-3">
          <CardTitle className="text-3xl leading-tight text-white">
            Welcome back, {session.user.name || "Player"}.
          </CardTitle>
          <CardDescription className="max-w-xl text-sm leading-7 text-white/64">
            Your account is ready for production booking flows. The session is connected,
            the booking journey can attach reservations to your identity, and the next layer
            is payment plus access automation.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
            <LightningIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-sm text-white/50">Signed in email</p>
            <p className="mt-2 break-all text-sm font-medium text-white">
              {session.user.email}
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
            <TableIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-sm text-white/50">Player identity</p>
            <p className="mt-2 break-all text-sm font-medium text-white">
              {session.user.id}
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
            <ShieldCheckIcon className="size-5 text-primary" weight="fill" />
            <p className="mt-4 text-sm text-white/50">Flow status</p>
            <p className="mt-2 text-sm font-medium text-white">
              Account verified for booking
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-primary/15 bg-primary/10 p-5 text-sm leading-7 text-white/76">
            The premium booking path is ready to use: pick a venue, choose an open slot,
            adjust the group size, and review the final summary before reserving.
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-start gap-3">
              <MapPinIcon className="mt-1 size-5 text-primary" />
              <div>
                <p className="text-sm text-white/50">Best next move</p>
                <p className="mt-2 text-base font-medium text-white">
                  Go straight into the booking journey
                </p>
              </div>
            </div>

            <Button asChild className="mt-5 w-full justify-between">
              <Link href="/book">
                Open booking flow
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
