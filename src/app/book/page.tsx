import Link from "next/link";

import { getBookingBootstrapData } from "@/server/bookings/service";
import { BookingConsole } from "@/components/bookings/booking-console";
import { Button } from "@/components/ui/button";

export default async function BookPage() {
  const { locations } = await getBookingBootstrapData();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,183,255,0.14),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.03),_transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              Phase 2
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Booking engine workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/65">
              The booking flow now moves through location, timing, group size,
              and checkout, all backed by modular server code and server actions.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        {locations.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 p-8 text-sm text-white/60">
            No active locations or resources were found. Run the Phase 1 seed or add
            a location/resource first.
          </div>
        ) : (
          <BookingConsole locations={locations} />
        )}
      </div>
    </main>
  );
}
