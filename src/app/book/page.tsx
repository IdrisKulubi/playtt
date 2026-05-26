import Link from "next/link";
import { HouseLineIcon } from "@phosphor-icons/react/dist/ssr";

import { getBookingBootstrapData } from "@/server/bookings/service";
import { BookingConsole } from "@/components/bookings/booking-console";
import { ProductShell } from "@/components/layout/product-shell";
import { Button } from "@/components/ui/button";

export default async function BookPage() {
  const { locations } = await getBookingBootstrapData();

  return (
    <ProductShell
      variant="compact"
      title="Book a session"
      backHref="/"
      backLabel="Back to home"
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <HouseLineIcon className="mr-1.5 size-4" />
            Home
          </Link>
        </Button>
      }
    >
      {locations.length === 0 ? (
        <div className="quiet-panel mx-4 p-8 text-sm text-muted-foreground sm:mx-5">
          No venues are available to book right now. Please check back soon.
        </div>
      ) : (
        <BookingConsole locations={locations} />
      )}
    </ProductShell>
  );
}
