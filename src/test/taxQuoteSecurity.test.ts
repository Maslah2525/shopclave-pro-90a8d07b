import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { addressFingerprint, itemsFingerprint, validateQuotes } from "../../supabase/functions/_shared/shipping";

const endpoint = readFileSync("supabase/functions/tax-quote/index.ts", "utf8");
const checkout = readFileSync("src/pages/CheckoutPage.tsx", "utf8");
const address = { addressLine: "10 Main St", city: "Toronto", state: "ON", zip: "M5V 1A1", country: "Canada" };
const items = [{ product_id: "p1", quantity: 1, variant_id: null }];
const base = {
  id: "q1", user_id: "buyer", vendor_id: "v1",
  expires_at: "2099-01-01T00:00:00.000Z", consumed_order_id: null,
  address_fingerprint: addressFingerprint(address),
  items_fingerprint: itemsFingerprint(items), amount_cad: 12.5,
};
const opts = {
  userId: "buyer", requiredVendorIds: ["v1"],
  addressFingerprint: addressFingerprint(address), itemsFingerprint: itemsFingerprint(items),
  now: new Date("2026-09-28T00:00:00Z"),
};

describe("tax preview shipping security", () => {
  it("uses the same quote validator as order creation", () => {
    expect(endpoint).toContain("validateQuotes(quotes,");
    expect(endpoint).toContain("addressFingerprint(shipping_address)");
    expect(endpoint).toContain("itemsFingerprint(items)");
    expect(endpoint).toContain("quotes.length !== shipping_quote_ids.length");
    expect(endpoint).toContain("quotes.length !== requiredVendorIds.length");
    expect(endpoint).toContain("new Set(shipping_quote_ids).size !== shipping_quote_ids.length");
    expect(checkout).toContain("shipping_address: { addressLine: address.addressLine");
  });
  it("accepts a matching current quote", () => {
    expect(validateQuotes([base], opts)).toEqual({ ok: true, totalCad: 12.5 });
  });
  it("rejects foreign, expired, consumed, address-changed and basket-changed quotes", () => {
    for (const change of [
      { user_id: "other" }, { expires_at: "2020-01-01T00:00:00Z" },
      { consumed_order_id: "order1" }, { address_fingerprint: "wrong" },
      { items_fingerprint: "wrong" },
    ]) expect(validateQuotes([{ ...base, ...change }], opts).ok).toBe(false);
  });
});
