import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Payment complete | PlayTT",
}

export default function PaymentCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#121212] px-6 py-12 text-center text-white">
      <div className="max-w-md space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#0058FF]">
          PlayTT
        </p>
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="text-base text-white/70">
          Return to the PlayTT app to see your booking confirmation.
        </p>
      </div>
    </main>
  )
}
