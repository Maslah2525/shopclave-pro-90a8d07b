import { describe, expect, it } from "vitest";
import { missingVendorProfileItems } from "@/lib/vendorProfileCompleteness";

const vendor = { store_description: "Store", logo_url: "logo", banner_url: "banner", phone: "phone", warehouse_address: { street1: "street", city: "city", country: "CA", phone: "phone" }, payment_details: { bank: "", account: "" } };

describe("private payout profile completeness", () => {
  it("recognizes saved PayPal details even when legacy bank fields are empty", () => {
    expect(missingVendorProfileItems(vendor, { method: "paypal", paypalEmail: "seller@example.test" })).toEqual([]);
  });
  it("keeps a reminder for an empty or invalid PayPal email", () => {
    for (const paypalEmail of ["", "invalid"]) expect(missingVendorProfileItems(vendor, { method: "paypal", paypalEmail })).toContain("Payout details");
  });
  it("recognizes a complete saved bank preference", () => {
    expect(missingVendorProfileItems(vendor, { method: "bank", bank: "Bank", holderName: "Seller", transitNumber: "12345", institutionNumber: "123", accountNumber: "1234567" })).toEqual([]);
  });
  it("does not count bank selection alone as completed details", () => {
    expect(missingVendorProfileItems(vendor, { method: "bank", bank: "Bank" })).toContain("Payout details");
  });
  it("preserves existing populated legacy payout details", () => {
    expect(missingVendorProfileItems({ ...vendor, payment_details: { paypal: "seller@example.test" } })).toEqual([]);
  });
});