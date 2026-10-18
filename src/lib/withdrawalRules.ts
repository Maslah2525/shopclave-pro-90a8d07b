import { z } from "zod";

export const MINIMUM_WITHDRAWAL = 20;
export const withdrawalAmountSchema = z.number().finite().min(MINIMUM_WITHDRAWAL).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use at most two decimal places");
export const canadianBankSchema = z.object({
  bank: z.string().trim().min(1), holderName: z.string().trim().min(1),
  transitNumber: z.string().regex(/^\d{5}$/), institutionNumber: z.string().regex(/^\d{3}$/), accountNumber: z.string().regex(/^\d{5,12}$/),
});