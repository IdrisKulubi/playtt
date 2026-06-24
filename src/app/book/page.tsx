import { getBookingBootstrapData } from "@/server/bookings/service";
import { BookingConsole } from "@/components/bookings/booking-console";
import { PlayerShell } from "@/components/layout/player-shell";

export default async function BookPage() {
  const { locations } = await getBookingBootstrapData();

  return (
    <PlayerShell
      eyebrow="PlayTT Hurlingham"
      title="Book a session"
      backHref="/"
    >
      {locations.length === 0 ? (
        <div className="quiet-panel mx-4 p-8 text-sm text-muted-foreground sm:mx-5">
          No venues are available to book right now. Please check back soon.
        </div>
      ) : (
        <BookingConsole locations={locations} />
      )}
    </PlayerShell>
  );
}
