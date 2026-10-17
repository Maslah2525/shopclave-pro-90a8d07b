import { describe, expect, it } from "vitest";
import { mergeSettings, publicStoreSettings, restoreSettings, sameSettings } from "@/lib/vendorSettingsPersistence";

describe("store settings persistence", () => {
  it("restores cleared fields and disabled preferences instead of reverting them", () => {
    expect(restoreSettings({ email: "default", enabled: true, categories: ["old"], category: null as string | null }, { email: "", enabled: false, categories: [], category: "new" }))
      .toEqual({ email: "", enabled: false, categories: [], category: "new" });
  });
  it("preserves unrelated settings when saving a section", () => {
    expect(mergeSettings({ other: "keep", nested: { old: 1 } }, { nested: { next: 2 } }))
      .toEqual({ other: "keep", nested: { old: 1, next: 2 } });
  });
  it("keeps private contact and financial fields out of public store settings", () => {
    const result = publicStoreSettings({}, { store_email: "private@example.test", contact_visibility: "all", primary_category_id: "cat", additional_category_ids: [], public_store_address: { city: "Toronto" }, store_language: "en", taxId: "private" }, { welcome: "Hello", color: "color", bank_account: "private" });
    expect(result.profile).not.toHaveProperty("store_email");
    expect(result.profile).not.toHaveProperty("taxId");
    expect(result.branding).not.toHaveProperty("bank_account");
    expect(result.profile).toHaveProperty("primary_category_id", "cat");
  });
  it("verifies readback independently of JSON key order and detects lost edits", () => {
    expect(sameSettings({ a: 1, b: false }, { b: false, a: 1 })).toBe(true);
    expect(sameSettings({ enabled: false }, { enabled: true })).toBe(false);
  });
});