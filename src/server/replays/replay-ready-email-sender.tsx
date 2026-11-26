import ReplayReadyEmail, { replayReadySubject } from "@/emails/replay-ready-email"
import { sendPlayttEmail } from "@/server/email/send-email"

export async function sendReplayReadyEmail(input: {
  email: string
  name: string
  locationName: string
  title: string
  replayUrl: string
  idempotencyKey: string
}) {
  await sendPlayttEmail({
    kind: "replay ready",
    to: input.email,
    subject: replayReadySubject(),
    email: (
      <ReplayReadyEmail
        name={input.name}
        venueName={input.locationName}
        title={input.title}
        replayUrl={input.replayUrl}
      />
    ),
    idempotencyKey: input.idempotencyKey,
  })
}
