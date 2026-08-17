import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OperatorFeatureFlag } from "@/server/operator/types"

export function OperatorFeatureFlagTable({
  featureFlags,
}: {
  featureFlags: OperatorFeatureFlag[]
}) {
  if (featureFlags.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No feature flags configured for this tenant.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Scope</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featureFlags.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell className="font-mono text-xs">{flag.key}</TableCell>
                <TableCell>
                  <Badge variant={flag.enabled ? "default" : "outline"}>
                    {flag.enabled ? "On" : "Off"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {flag.scope ? JSON.stringify(flag.scope) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
