import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TenantMembershipRole } from "@/server/tenancy/types"

export function AdminSetupBanner({ role }: { role?: TenantMembershipRole }) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">Super Admin setup required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Your account role is <strong className="text-foreground">{role ?? "unknown"}</strong>.
          To add venues, manage vendors, and control the platform, promote your account to{" "}
          <strong className="text-foreground">owner</strong>.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Add <code className="rounded bg-muted px-1">PLAYTT_ADMIN_EMAIL=your@email.com</code>{" "}
            to <code className="rounded bg-muted px-1">.env.local</code>
          </li>
          <li>
            Run{" "}
            <code className="rounded bg-muted px-1">
              node --env-file=.env.local scripts/promote-admin-owner.mjs
            </code>
          </li>
          <li>Sign out and sign back in</li>
        </ol>
      </CardContent>
    </Card>
  )
}
