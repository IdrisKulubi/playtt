"use client";

import { UsersThreeIcon } from "@phosphor-icons/react";

import {
  EXTRA_PLAYER_SURCHARGE,
  GROUP_SIZE_OPTIONS,
  INCLUDED_PLAYERS,
  type GroupSize,
} from "@/components/bookings/booking-utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface GroupSizeSheetProps {
  open: boolean;
  groupSize: GroupSize;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onGroupSizeChange: (size: GroupSize) => void;
  onContinue: () => void;
}

export function GroupSizeSheet({
  open,
  groupSize,
  currency,
  onOpenChange,
  onGroupSizeChange,
  onContinue,
}: GroupSizeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[var(--radius-panel)] px-4 pb-5 sm:!top-1/2 sm:!bottom-auto sm:!left-1/2 sm:!right-auto sm:!max-h-[calc(100svh-3rem)] sm:!w-[min(28rem,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:overflow-y-auto sm:rounded-[var(--radius-panel)]"
      >
        <SheetHeader className="px-0 pb-4 text-left">
          <SheetTitle className="text-lg font-semibold">Who is joining?</SheetTitle>
          <SheetDescription className="text-xs leading-5">
            Choose the number of players for this session.
          </SheetDescription>
        </SheetHeader>

        <ul className="grid grid-cols-3 gap-2">
          {GROUP_SIZE_OPTIONS.map((size) => {
            const active = size === groupSize;
            const surcharge = Math.max(0, size - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE;

            return (
              <li key={size} className="last:col-start-2">
                <button
                  type="button"
                  onClick={() => onGroupSizeChange(size)}
                  className={`flex min-h-[4.9rem] w-full flex-col items-start justify-between rounded-[var(--radius-field)] border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/35 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UsersThreeIcon
                      className={`size-4 ${active ? "text-primary-foreground" : "text-muted-foreground"}`}
                      weight={active ? "fill" : "regular"}
                    />
                    <span className="text-sm font-semibold">{size} players</span>
                  </div>
                  <span
                    className={`text-xs tabular-nums ${active ? "text-primary-foreground/78" : "text-muted-foreground"}`}
                  >
                    {surcharge > 0 ? `+${currency} ${surcharge.toLocaleString()}` : "Included"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="pt-3 text-xs text-muted-foreground">
          Base rate includes up to {INCLUDED_PLAYERS} players.
        </p>

        <div className="pt-4">
          <Button onClick={onContinue} size="lg" className="w-full rounded-full">
            Continue with {groupSize} players
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
