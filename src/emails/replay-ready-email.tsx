import {
  EmailButton,
  EmailHero,
  EmailLayout,
  EmailReplayCard,
  EmailText,
  firstName,
} from "@/emails/components"

export interface ReplayReadyEmailProps {
  name: string
  venueName: string
  title: string
  replayUrl: string
}

export const replayReadySubject = () => "Your PlayTT highlight is ready"

export default function ReplayReadyEmail(props: ReplayReadyEmailProps) {
  return (
    <EmailLayout
      preview={`${props.title} at ${props.venueName} is ready to watch and share.`}
      footerNote="You get this because you tapped Replay during your session."
    >
      <EmailHero
        eyebrow="Replay ready"
        title={`Nice rally, ${firstName(props.name)}.`}
        lede="Your highlight is saved to your PlayTT library. Watch it, keep it, share it."
      />
      <EmailReplayCard href={props.replayUrl} title={props.title} subtitle={props.venueName} />
      <EmailButton href={props.replayUrl}>Watch your clip</EmailButton>
      <EmailText muted>This link always opens your clip in PlayTT. It doesn&apos;t expire.</EmailText>
    </EmailLayout>
  )
}

ReplayReadyEmail.PreviewProps = {
  name: "Amina Otieno",
  venueName: "PlayTT Hurlingham",
  title: "Session clip",
  replayUrl: "https://www.theplaytt.com/replays/demo",
} satisfies ReplayReadyEmailProps
