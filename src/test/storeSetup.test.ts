import { describe, it, expect } from "vitest";
import { storeSetupChecklist } from "@/lib/storeSetup";

const ready = { store_name: "Mama Shop", store_description: "Fresh produce daily", phone: "4165550100", logo_url: "https://x/logo.webp" };

describe("store setup checklist", () => {
  it("blocks submit while the placeholder store name is kept", () => {
    expect(storeSetupChecklist({ ...ready, store_name: "Pending Store Setup ab12cd34" }).every((i) => i.done)).toBe(false);
  });
  it("blocks submit without a logo", () => {
    expect(storeSetupChecklist({ ...ready, logo_url: null }).every((i) => i.done)).toBe(false);
  });
  it("allows submit when all required details are present", () => {
    expect(storeSetupChecklist(ready).every((i) => i.done)).toBe(true);
  });
});
