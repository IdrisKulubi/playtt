"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function BookPageShell() {
  return (
    <header className="flex max-w-lg items-center gap-3 sm:max-w-none">
      <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full text-white/70">
        <Link href="/dashboard" aria-label="Back">
          <ArrowLeftIcon className="size-5" />
        </Link>
      </Button>
      <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Book</h1>
    </header>
  );
}