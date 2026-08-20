import { redirect } from "next/navigation"

export default function OperatorFeatureFlagsRedirect() {
  redirect("/admin/feature-flags")
}
