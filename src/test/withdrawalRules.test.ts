import { describe, expect, it } from "vitest";
import { canadianBankSchema, withdrawalAmountSchema } from "@/lib/withdrawalRules";
describe("withdrawal requirements", () => {
  it("rejects withdrawals below 20 CAD", () => { expect(withdrawalAmountSchema.safeParse(19.99).success).toBe(false); });
  it("accepts the 20 CAD minimum", () => { expect(withdrawalAmountSchema.safeParse(20).success).toBe(true); });
  it("rejects invalid and fractional-cent amounts", () => { for (const value of [NaN, Infinity, 20.001]) expect(withdrawalAmountSchema.safeParse(value).success).toBe(false); });
  it("requires Canadian bank information without a Stripe account", () => {
    const details = { bank: "TD Canada Trust", holderName: "Test Seller", transitNumber: "12345", institutionNumber: "004", accountNumber: "1234567" };
    expect(canadianBankSchema.safeParse(details).success).toBe(true);
    expect(canadianBankSchema.safeParse({ ...details, accountNumber: "" }).success).toBe(false);
  });
});