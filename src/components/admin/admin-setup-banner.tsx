import { GroupedSection } from "@/components/admin/admin-grouped"
import type { TenantMembershipRole } from "@/server/tenancy/types"

export function AdminSetupBanner({ role }: { role?: TenantMembershipRole }) {
  return (
    <GroupedSection
      header="Finish admin setup"
      footer="Then sign out and sign back in."
    >
      <li className="px-4 py-3 text-[15px]">
        <p>
          Your role is <span className="font-semibold">{role ?? "unknown"}</span>. To add venues, manage vendors and
          control the platform, your account needs the <span className="font-semibold">owner</span> role.
        </p>
      </li>
      <li className="px-4 py-3 text-[13px] text-muted-foreground">
        1. Add <code className="font-mono text-foreground">PLAYTT_ADMIN_EMAIL=your@email.com</code> to{" "}
        <code className="font-mono text-foreground">.env.local</code>
      </li>
      <li className="px-4 py-3 text-[13px] text-muted-foreground">
        2. Run <code className="font-mono text-foreground">node --env-file=.env.local scripts/promote-admin-owner.mjs</code>
      </li>
    </GroupedSection>
  )
}
