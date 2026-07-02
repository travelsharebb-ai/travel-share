import { z } from 'zod';

export const uploadBodySchema = z.object({
  idempotencyKey: z.string().min(1).max(120).optional(),
  caption: z.string().max(240).optional().nullable(),
  locationVisibility: z.enum(["exact", "approximate", "city", "hidden"]).optional(),
  latitude: z.preprocess((v) => (v === undefined || v === '' || v === null ? null : Number(v)), z.number().finite().optional().nullable()),
  longitude: z.preprocess((v) => (v === undefined || v === '' || v === null ? null : Number(v)), z.number().finite().optional().nullable()),
  locationName: z.string().max(120).optional().nullable(),
  region: z.string().max(120).optional().nullable()
}).strict();

export const qrTokenParam = z.object({ qrToken: z.string().min(6) });

export const guestTripSchema = z.object({
  title: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  defaultLocationVisibility: z.enum(["exact", "approximate", "city", "hidden"]).optional()
});

export const guestEventSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  coverImageUrl: z.string().url().optional().nullable()
});
