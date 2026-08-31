import type { Phase8CertificationStep } from "./types.ts"

export interface ResourceSelectionEvidence {
  resourceId: string
  selectedSourceId: string | null
  candidateSourceIds: string[]
}

export function assertResourceSourceIsolation(
  selections: ResourceSelectionEvidence[],
): Phase8CertificationStep {
  const byResource = new Map(
    selections.map((entry) => [entry.resourceId, entry]),
  )

  for (const selection of selections) {
    for (const other of selections) {
      if (other.resourceId === selection.resourceId) {
        continue
      }

      if (
        selection.selectedSourceId &&
        other.candidateSourceIds.includes(selection.selectedSourceId) &&
        !selection.candidateSourceIds.includes(selection.selectedSourceId)
      ) {
        return {
          id: "resource_source_isolation",
          title: "Approved sources stay scoped to their resource",
          passed: false,
          details: {
            resourceId: selection.resourceId,
            leakedSourceId: selection.selectedSourceId,
            otherResourceId: other.resourceId,
          },
        }
      }
    }

    if (
      selection.selectedSourceId &&
      !selection.candidateSourceIds.includes(selection.selectedSourceId)
    ) {
      return {
        id: "resource_source_isolation",
        title: "Approved sources stay scoped to their resource",
        passed: false,
        details: {
          resourceId: selection.resourceId,
          selectedSourceId: selection.selectedSourceId,
          candidateSourceIds: selection.candidateSourceIds,
        },
      }
    }

    if (!byResource.has(selection.resourceId)) {
      return {
        id: "resource_source_isolation",
        title: "Approved sources stay scoped to their resource",
        passed: false,
        details: {
          resourceId: selection.resourceId,
        },
      }
    }
  }

  return {
    id: "resource_source_isolation",
    title: "Approved sources stay scoped to their resource",
    passed: true,
    details: {
      resourceCount: selections.length,
    },
  }
}

export function assertCommandResourceBinding(input: {
  accepted: boolean
  reason?: string
  expectedReason?: string
}): Phase8CertificationStep {
  const passed =
    input.accepted === false &&
    (input.expectedReason ? input.reason === input.expectedReason : Boolean(input.reason))

  return {
    id: "command_resource_binding",
    title: "Replay commands reject mismatched resources locally",
    passed,
    details: {
      reason: input.reason ?? null,
      expectedReason: input.expectedReason ?? null,
    },
  }
}
