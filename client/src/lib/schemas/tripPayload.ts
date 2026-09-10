import { z } from "zod";

export const TripPayloadSchema = z.object({
  schemaVersion: z.string().optional(),
  source: z.string().optional(),
  services: z.array(z.record(z.string(), z.unknown())).optional(),
  travelers: z.array(z.unknown()).optional(),
  documents: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

export function validateTripPayload(raw: unknown) {
  const result = TripPayloadSchema.safeParse(raw);
  return result.success
    ? { ok: true as const, data: result.data, errors: [] as string[] }
    : { ok: false as const, errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) };
}
