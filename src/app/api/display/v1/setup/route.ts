import { listDisplaySetupVenues } from "@/server/realtime/display-setup"

/**
 * Venues and tables for the PlayTT TV app's setup screen (pick a venue,
 * then a table, with the remote). Read-only names, same as the public pages.
 */
export async function GET() {
  try {
    const venues = await listDisplaySetupVenues()
    return Response.json(
      { data: { venues } },
      { headers: { "Cache-Control": "public, max-age=60" } },
    )
  } catch {
    return Response.json(
      {
        error: {
          code: "DISPLAY_SETUP_UNAVAILABLE",
          message: "Could not load venues. Try again.",
        },
      },
      { status: 503 },
    )
  }
}
