import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { ReplayOrchestrator } from "../replay/orchestrator"

export async function resumeUnfinishedJobs(input: {
  repositories: EdgeRepositories
  orchestrator: ReplayOrchestrator
}): Promise<number> {
  const jobs = input.repositories.listUnfinishedReplayJobs()
  let resumed = 0

  for (const job of jobs) {
    safeLog("info", "Resuming unfinished replay job", {
      replayRequestId: job.replayRequestId,
      status: job.status,
    })

    await input.orchestrator.resumeJob(job.replayRequestId)
    resumed += 1
  }

  return resumed
}
