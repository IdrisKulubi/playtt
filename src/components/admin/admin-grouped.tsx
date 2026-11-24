import type { ReactNode } from "react"

/*
 * Shared Apple-style building blocks for admin pages (see the apple-design skill).
 * Hierarchy comes from type, weight, spacing and order - not from colored chips.
 * Color is reserved for the interactive tint (text-primary) on actions.
 */

export function LargeTitle({ title, subtitle, accessory }: { title: ReactNode; subtitle?: ReactNode; accessory?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-heading text-[34px] leading-[1.1] font-bold tracking-[-0.022em]">{title}</h2>
        {subtitle ? <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {accessory ? <div className="shrink-0">{accessory}</div> : null}
    </header>
  )
}

export function SectionHeader({ children, accessory }: { children: ReactNode; accessory?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pb-1.5">
      <h3 className="text-[13px] font-normal tracking-[0.01em] text-muted-foreground uppercase">{children}</h3>
      {accessory ? <div className="text-[13px] text-muted-foreground">{accessory}</div> : null}
    </div>
  )
}

export function SectionFooter({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-1.5 text-[13px] leading-snug text-muted-foreground">{children}</p>
}

/** iOS inset grouped list: one surface, hairline dividers between rows. */
export function GroupedList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={`overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 [&>li+li]:border-t [&>li+li]:border-border/60 ${className}`}
    >
      {children}
    </ul>
  )
}

export function GroupedSection({
  header,
  headerAccessory,
  footer,
  children,
}: {
  header?: ReactNode
  headerAccessory?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      {header ? <SectionHeader accessory={headerAccessory}>{header}</SectionHeader> : null}
      <GroupedList>{children}</GroupedList>
      {footer ? <SectionFooter>{footer}</SectionFooter> : null}
    </section>
  )
}

/** Settings-style row: label on the left, value on the right, optional detail line. */
export function ValueRow({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4 text-[15px]">
        <span className="min-w-0">{label}</span>
        <span className="min-w-0 truncate text-right text-muted-foreground tabular-nums">{value}</span>
      </div>
      {detail ? <p className="mt-0.5 text-[13px] text-muted-foreground">{detail}</p> : null}
    </li>
  )
}

/** iOS segmented control. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-[8px] px-3 py-1 text-[13px] font-medium transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none ${
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
            {option.count !== undefined ? <span className="ml-1 font-normal tabular-nums opacity-60">{option.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** A quiet text action in the interactive tint. */
export const textActionClass =
  "text-[13px] font-medium text-primary transition-opacity active:opacity-50 disabled:opacity-40"
