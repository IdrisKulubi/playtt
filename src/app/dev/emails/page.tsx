import Link from "next/link"
import { notFound } from "next/navigation"

import { EMAIL_CATALOG } from "@/emails/catalog"
import { renderEmail } from "@/emails/render"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ email?: string; view?: string }>
}

/** Dev-only preview of every email, rendered exactly as it's sent. */
export default async function EmailPreviewPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production") notFound()

  const { email, view } = await searchParams
  const entry = EMAIL_CATALOG.find((item) => item.id === email) ?? EMAIL_CATALOG[0]
  const { html, text } = await renderEmail(entry.render())
  const showText = view === "text"

  return (
    <div className="flex min-h-screen bg-neutral-100 text-neutral-900">
      <nav className="w-64 shrink-0 border-r border-neutral-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Emails</p>
        <ul className="space-y-1">
          {EMAIL_CATALOG.map((item) => (
            <li key={item.id}>
              <Link
                href={`/dev/emails?email=${item.id}`}
                className={`block rounded-md px-3 py-2 text-sm ${item.id === entry.id ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{entry.subject}</p>
            <p className="text-xs text-neutral-500">From PlayTT · preview data</p>
          </div>
          <div className="flex gap-1 text-sm">
            <Link
              href={`/dev/emails?email=${entry.id}`}
              className={`rounded-md px-3 py-1.5 ${showText ? "hover:bg-neutral-100" : "bg-neutral-900 text-white"}`}
            >
              HTML
            </Link>
            <Link
              href={`/dev/emails?email=${entry.id}&view=text`}
              className={`rounded-md px-3 py-1.5 ${showText ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              Plain text
            </Link>
          </div>
        </header>
        {showText ? (
          <pre className="m-6 overflow-auto rounded-lg bg-white p-6 text-sm whitespace-pre-wrap">{text}</pre>
        ) : (
          <iframe title={entry.name} srcDoc={html} className="h-full min-h-[85vh] w-full flex-1 border-0" />
        )}
      </main>
    </div>
  )
}
