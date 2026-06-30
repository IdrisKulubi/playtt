import {
  CalendarIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

export const MARKETING_USER_LINKS = [
  {
    label: "Account",
    href: "/account",
    icon: UserCircleIcon,
  },
  {
    label: "Book",
    href: "/book",
    icon: CalendarIcon,
  },
] as const;

export const MARKETING_SIGN_OUT_ITEM = {
  label: "Sign out",
  icon: SignOutIcon,
} as const;

export function getMarketingUserLabel(name?: string | null, email?: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.trim()) return email.split("@")[0] ?? "Account";
  return "Account";
}
