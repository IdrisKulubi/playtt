"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type AdminShellContextValue = {
  searchQuery: string
  setSearchQuery: (value: string) => void
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("")

  const value = useMemo(
    () => ({ searchQuery, setSearchQuery }),
    [searchQuery],
  )

  return (
    <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>
  )
}

export function useAdminShell() {
  const context = useContext(AdminShellContext)
  if (!context) {
    throw new Error("useAdminShell must be used within AdminShellProvider")
  }
  return context
}

export function useAdminSearchFilter<T>(
  items: T[],
  getSearchText: (item: T) => string,
) {
  const { searchQuery } = useAdminShell()
  const normalized = searchQuery.trim().toLowerCase()

  if (!normalized) {
    return items
  }

  return items.filter((item) =>
    getSearchText(item).toLowerCase().includes(normalized),
  )
}
