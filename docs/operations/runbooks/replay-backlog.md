# Replay backlog recovery

Use when many replay requests are in flight and queue pressure is elevated.

## Check

1. Open the venue detail page and inspect edge capacity metrics.
2. Count in-flight replay requests and active FFmpeg jobs.

## Diagnose

- Burst of replay requests during peak play.
- Edge concurrency limit reached.
- Slow uploads to R2 extending queue time.

## Recover

1. Pause non-essential replay capture if needed.
2. Restart venue edge to clear stuck FFmpeg workers.
3. Stagger retries for failed requests after edge stabilizes.

## Verify

- Queue depth drops below the configured concurrency limit.
- New replay requests progress through capture → upload → ready within expected SLO.
