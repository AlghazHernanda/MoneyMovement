import { z } from 'zod';

export const RANGE_MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24 } as const;
export type Range = keyof typeof RANGE_MONTHS;

export const historyQuerySchema = z.object({
  range: z.enum(Object.keys(RANGE_MONTHS) as [Range, ...Range[]]).default('1M'),
});
