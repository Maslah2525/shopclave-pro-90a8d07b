import { describe, expect, it } from "vitest";
import { vendorProductSummary } from "@/lib/vendorProductSummary";

describe("vendor product counts", () => {
  it("counts all products and separates active from inactive including drafts", () => {
    expect(vendorProductSummary([{ status: "active", stock: 5 }, { status: "active", stock: 0 }, { status: "draft", stock: 2 }, { status: "inactive", stock: 0 }, { status: "archived", stock: null }])).toEqual({ total: 5, active: 2, inactive: 3, drafts: 1, outOfStock: 2 });
  });
  it("returns zero counts for an empty catalogue", () => {
    expect(vendorProductSummary([])).toEqual({ total: 0, active: 0, inactive: 0, drafts: 0, outOfStock: 0 });
  });
});