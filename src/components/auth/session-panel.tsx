"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, SignOutIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <Card className="quiet-panel">
        <CardHeader>
          <CardTitle className="text-lg text-white">Checking session</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("quiet-panel", "border-destructive/30 bg-destructive/10")}>
        <CardHeader>
          <CardTitle className="text-lg text-white">Session unavailable</CardTitle>
          <CardDescription>
            Could not load your session. Check the API route and env values, then try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card className="quiet-panel">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl text-white">Sign in to book</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create an account or sign in to reserve a session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="quiet-panel">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Signed in
          </p>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <SignOutIcon className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl leading-tight text-white">
            Welcome back, {session.user.name || "Player"}.
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {session.user.email}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full justify-between">
          <Link href="/book">
            Book a session
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
