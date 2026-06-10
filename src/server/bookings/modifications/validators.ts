import { z } from "zod/v3"

import { GROUP_SIZE_OPTIONS } from "@/server/bookings/constants"

const groupSizeSchema = z.union([
  z.literal(GROUP_SIZE_OPTIONS[0]),
  z.literal(GROUP_SIZE_OPTIONS[1]),
  ...GROUP_SIZE_OPTIONS.slice(2).map((value) => z.literal(value)),
] as const)

export const modificationQuoteBodySchema = z
  .object({
    startTimeIso: z.string().datetime().optional(),
    groupSize: groupSizeSchema.optional(),
    notes: z.string().max(300).optional(),
  })
  .refine(
    (value) =>
      value.startTimeIso !== undefined ||
      value.groupSize !== undefined ||
      value.notes !== undefined,
    { message: "At least one change is required." },
  )

export const modificationApplyBodySchema = modificationQuoteBodySchema
