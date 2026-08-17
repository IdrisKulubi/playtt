export const HURLINGHAM_VENUE_ID = "11111111-1111-1111-1111-111111111111"
export const MAIN_POD_RESOURCE_ID = "22222222-2222-2222-2222-222222222222"
export const MAIN_HALL_ZONE_ID = "55555555-5555-5555-5555-555555555555"
export const TABLE_TENNIS_TYPE_ID = "66666666-6666-6666-6666-666666666666"

export const MAIN_HALL_ZONE_SLUG = "main-hall"
export const TABLE_TENNIS_TYPE_CODE = "table_tennis_table"
export const TABLE_01_RESOURCE_CODE = "Table 01"
export const TT_STANDARD_RULESET = "tt_standard_v1"

export const RESOURCE_CAPABILITY_CODES = [
  "scoring",
  "replay",
  "access",
  "lighting",
  "display",
  "camera",
] as const

export type ResourceCapabilityCode = (typeof RESOURCE_CAPABILITY_CODES)[number]

export const RESOURCE_CAPABILITY_CODE_SET = new Set<string>(
  RESOURCE_CAPABILITY_CODES,
)

export function isResourceCapabilityCode(
  code: string,
): code is ResourceCapabilityCode {
  return RESOURCE_CAPABILITY_CODE_SET.has(code)
}
