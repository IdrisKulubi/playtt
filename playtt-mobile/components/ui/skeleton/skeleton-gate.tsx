import type { ReactNode } from "react"

export type SkeletonGateProps = {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
}

export function SkeletonGate({ loading, skeleton, children }: SkeletonGateProps) {
  if (loading) {
    return <>{skeleton}</>
  }

  return <>{children}</>
}
