"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function useMarketingSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);

    const result = await authClient.signOut();

    if (result.error) {
      setIsSigningOut(false);
      toast.error(result.error.message || "Failed to sign out");
      return;
    }

    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return { signOut, isSigningOut };
}
