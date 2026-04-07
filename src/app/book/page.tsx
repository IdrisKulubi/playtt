import { getBookingBootstrapData } from "@/server/bookings/service";
import { BookingConsole } from "@/components/bookings/booking-console";
import { BookPageShell } from "@/components/bookings/book-page-shell";

export default async function BookPage() {
  const { locations } = await getBookingBootstrapData();

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="hero-orb left-[-8rem] top-8 h-72 w-72 bg-primary/16" />
      <div className="hero-orb right-[-9rem] top-48 h-80 w-80 bg-sky-500/10" />
      <div className="playtt-grid absolute inset-0 opacity-25" />

      <div className="app-shell min-h-screen gap-5 sm:gap-6">
        <BookPageShell />

        {locations.length === 0 ? (
          <p className="max-w-md text-sm text-white/50">No venues available yet.</p>
        ) : (
          <BookingConsole locations={locations} />
        )}
      </div>
    </main>
  );
}
