"use client";

import Link from "next/link";
import { CaretDownIcon, UserCircleIcon } from "@phosphor-icons/react";

import {
  getMarketingUserLabel,
  MARKETING_SIGN_OUT_ITEM,
  MARKETING_USER_LINKS,
} from "@/components/layout/marketing-nav-items";
import { useMarketingSignOut } from "@/components/layout/use-marketing-sign-out";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MarketingUserMenuProps {
  name?: string | null;
  email?: string | null;
}

export function MarketingUserMenu({ name, email }: MarketingUserMenuProps) {
  const { signOut, isSigningOut } = useMarketingSignOut();
  const label = getMarketingUserLabel(name, email);
  const SignOutIcon = MARKETING_SIGN_OUT_ITEM.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="marketing-nav__account hidden sm:inline-flex"
          data-nav-action
        >
          <UserCircleIcon className="size-4" weight="fill" />
          <span className="max-w-[8rem] truncate">{label}</span>
          <CaretDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MARKETING_USER_LINKS.map(({ label: itemLabel, href, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon className="size-4" />
              {itemLabel}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <SignOutIcon className="size-4" />
          {isSigningOut ? "Signing out..." : MARKETING_SIGN_OUT_ITEM.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
