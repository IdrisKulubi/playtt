import {
  ProductThemes,
  type ProductThemeColors,
} from "@/constants/product-theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

export function useProductTheme(): ProductThemeColors {
  const scheme = useColorScheme() ?? "light"
  return ProductThemes[scheme === "dark" ? "dark" : "light"]
}

export function useSkeletonSurface(): "dark" | "product" {
  const scheme = useColorScheme() ?? "light"
  return scheme === "dark" ? "dark" : "product"
}
