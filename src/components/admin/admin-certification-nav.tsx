"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"

const phases = [
  { id: "phase-p5", label: "Phase 5" },
  { id: "phase-p7", label: "Phase 7" },
  { id: "phase-p8", label: "Phase 8" },
] as const

export function AdminCertificationNav() {
  return (
    <nav
      aria-label="Certification phases"
      className="admin-dashboard-card flex flex-wrap items-center gap-2 p-3"
    >
      <p className="mr-1 text-sm font-medium text-muted-foreground">Jump to</p>
      {phases.map((phase) => (
        <Button key={phase.id} asChild size="sm" variant="outline">
          <Link href={`#${phase.id}`}>{phase.label}</Link>
        </Button>
      ))}
    </nav>
  )
}

export function runbookHref(runbookPath: string) {
  return `https://github.com/IdrisKulubi/playtt/blob/main/${runbookPath}`
}
