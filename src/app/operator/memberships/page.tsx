import { OperatorMembershipTable } from "@/components/operator/operator-membership-table"
import { OperatorShell } from "@/components/operator/operator-shell"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { listMemberships } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function OperatorMembershipsPage() {
  const { context } = await requireOperatorPageAccess()
  const memberships = await listMemberships(context)

  return (
    <OperatorShell title="Memberships" eyebrow="Operator" backHref="/operator">
      <OperatorMembershipTable memberships={memberships} />
    </OperatorShell>
  )
}
