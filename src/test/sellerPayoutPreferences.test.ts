import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/countries";
import { sellerPayoutMethod } from "@/lib/sellerPayoutPreferences";

describe("seller payout choices", () => {
  it("offers bank information for Canada", () => {
    expect(sellerPayoutMethod("CA")).toBe("bank");
  });
  it("offers only PayPal for every other country", () => {
    for (const country of COUNTRIES.filter(c => c.code !== "CA")) {
      expect(sellerPayoutMethod(country.code)).toBe("paypal");
    }
    expect(sellerPayoutMethod("")).toBe("paypal");
  });
});