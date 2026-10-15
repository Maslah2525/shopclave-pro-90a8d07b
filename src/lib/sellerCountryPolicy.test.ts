import { describe, expect, it } from "vitest";
import { canOfferSellerPayoutOnboarding, missingSellerBusinessFields, sellerRequiredAddressFields } from "./sellerCountryPolicy";

describe("seller country rules", () => {
  const base = { legal_name: "Example Trading", address_line1: "1 Market St", city: "London" };
  it("requires Canadian province and postal code", () => {
    expect(missingSellerBusinessFields("CA", "individual", base)).toEqual(["region", "postal_code"]);
  });
  it("requires registration number for companies", () => {
    expect(missingSellerBusinessFields("GB", "company", { ...base, postal_code: "SW1A 1AA" })).toEqual(["registration_number"]);
  });
  it("requires registered sole proprietor number only when registered", () => {
    expect(missingSellerBusinessFields("KE", "sole_proprietor", { ...base, is_business_registered: false })).toEqual([]);
    expect(missingSellerBusinessFields("KE", "sole_proprietor", { ...base, is_business_registered: true })).toEqual(["registration_number"]);
  });
  it("honors reviewed country requirements for tax identifiers", () => {
    const rule = { country: "KR", businessType: "company" as const, requiredFields: ["tax_identifier"], requiredDocuments: [], reviewedAt: "2026-10-15", providerOnboardingEnabled: false };
    expect(missingSellerBusinessFields("KR", "company", base, rule)).toEqual(["registration_number", "tax_identifier"]);
  });
  it("fails closed on missing or unreviewed payout rules", () => {
    expect(canOfferSellerPayoutOnboarding()).toBe(false);
    expect(canOfferSellerPayoutOnboarding({country:"US",businessType:"individual",requiredFields:[],requiredDocuments:[],reviewedAt:null,providerOnboardingEnabled:true})).toBe(false);
  });
  it("keeps international address rules independent of payout enablement", () => {
    expect(sellerRequiredAddressFields("CN")).toContain("region");
    expect(sellerRequiredAddressFields("US")).toContain("postal_code");
  });
});
