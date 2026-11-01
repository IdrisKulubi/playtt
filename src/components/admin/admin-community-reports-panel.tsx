import {
  CommunityReportActions,
  ExcuseBookingButton,
} from "@/components/admin/admin-community-report-actions"
import { Badge } from "@/components/ui/badge"
import type { listCommunityReportsForAdmin } from "@/server/community/admin-service"

type Report = Awaited<ReturnType<typeof listCommunityReportsForAdmin>>[number]

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  no_show: "No-show",
  other: "Other",
}

function ReportCard({ report }: { report: Report }) {
  const open = report.status === "open"

  return (
    <article className="rounded-xl border border-border/70 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{report.targetName}</h3>
            <Badge variant={report.reason === "harassment" ? "destructive" : "outline"}>
              {REASON_LABELS[report.reason] ?? report.reason}
            </Badge>
            <Badge variant={open ? "default" : "secondary"}>{report.status}</Badge>
            {report.targetMutedUntil ? (
              <Badge variant="outline">Muted until {new Date(report.targetMutedUntil).toLocaleDateString()}</Badge>
            ) : null}
            {!report.targetVisible ? <Badge variant="outline">Card hidden</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {report.targetEmail} · reported by {report.reporterName} on {new Date(report.createdAt).toLocaleString()}
          </p>
          {report.note ? <p className="text-sm">&ldquo;{report.note}&rdquo;</p> : null}

          {report.context.length > 0 ? (
            <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Chat context</p>
              {report.context.map((message) => (
                <p
                  key={message.id}
                  className={message.reported ? "text-sm font-semibold" : "text-sm text-muted-foreground"}
                >
                  <span className="mr-2 text-xs">
                    {message.senderId === report.targetId
                      ? report.targetName
                      : message.senderId === report.reporterId
                        ? report.reporterName
                        : "System"}
                    :
                  </span>
                  {message.body}
                </p>
              ))}
            </div>
          ) : null}

          {report.missedBookings.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/70 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Missed shared bookings (count against REL)</p>
              {report.missedBookings.map((booking) => (
                <div key={booking.bookingId} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {booking.resourceName} · {new Date(booking.startsAt).toLocaleString()}
                  </span>
                  <ExcuseBookingButton bookingId={booking.bookingId} userId={report.targetId} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <CommunityReportActions reportId={report.id} open={open} />
      </div>
    </article>
  )
}

export function AdminCommunityReportsPanel({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <div className="admin-dashboard-card">
        <p className="text-sm text-muted-foreground">No community reports yet.</p>
      </div>
    )
  }

  const openCount = reports.filter((report) => report.status === "open").length

  return (
    <div className="admin-dashboard-card space-y-3">
      <p className="text-sm text-muted-foreground">
        {openCount} open · showing the latest {reports.length}
      </p>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}
