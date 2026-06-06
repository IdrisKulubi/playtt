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
      <SheetContent side="bottom" className="rounded-t-[var(--radius-panel)] px-0 pb-8">
        <SheetHeader className="border-b border-border px-4 pb-4 text-center">
          <SheetTitle className="text-base font-semibold">Group size</SheetTitle>
          <SheetDescription className="sr-only">
            Choose how many players will join this session.
          </SheetDescription>
        </SheetHeader>

        <ul className="divide-y divide-border">
          {GROUP_SIZE_OPTIONS.map((size) => {
            const active = size === groupSize;
            const surcharge = Math.max(0, size - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE;

            return (
              <li key={size}>
                <button
                  type="button"
                  onClick={() => onGroupSizeChange(size)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UsersThreeIcon
                      className={`size-5 ${active ? "text-primary-foreground" : "text-muted-foreground"}`}
                      weight={active ? "fill" : "regular"}
                    />
                    <span className="font-medium">{size} players</span>
                  </div>
                  <span
                    className={`text-sm tabular-nums ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {surcharge > 0 ? `+${currency} ${surcharge.toLocaleString()}` : "Included"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="px-4 pt-3 text-center text-xs text-muted-foreground">
          Base rate includes up to {INCLUDED_PLAYERS} players.
        </p>

        <div className="px-4 pt-4">
          <Button onClick={onContinue} size="lg" className="w-full rounded-full">
            Continue for {groupSize} players
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
