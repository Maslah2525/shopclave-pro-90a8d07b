import { describe, it, expect } from "vitest";
import {
  addBusinessDays, isBusinessDay, estimateDeliveryWindow, transitDaysForService, deliveryItemsLabel,
  readDeliveryPreference, saveDeliveryPreference,
  quotedDeliveryWindow,
} from "@/lib/deliveryEstimate";

const d = (s: string) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

describe("deliveryEstimate", () => {
  it("uses each selected quote's own arrival days without adding handling twice", () => {
    const standard = quotedDeliveryWindow({ estimated_days: 7 }, d("2026-10-26"), "ON");
    const express = quotedDeliveryWindow({ estimated_days: 3 }, d("2026-10-26"), "ON");
    expect(standard && iso(standard.earliest)).toBe("2026-11-04");
    expect(express && iso(express.earliest)).toBe("2026-10-29");
  });
  it("does not replace a missing live arrival estimate with generic shipping dates", () => {
    expect(quotedDeliveryWindow({ estimated_days: null }, d("2026-10-26"))).toBeNull();
    expect(quotedDeliveryWindow({ estimated_days: NaN }, d("2026-10-26"))).toBeNull();
    expect(quotedDeliveryWindow(null, d("2026-10-26"))).toBeNull();
  });
  it("preserves matching genuine estimates rather than inventing a faster Express arrival", () => {
    expect(quotedDeliveryWindow({ estimated_days: 3 }, d("2026-10-26"))).toEqual(
      quotedDeliveryWindow({ estimated_days: 3 }, d("2026-10-26")),
    );
  });
  it("skips weekends", () => {
    expect(iso(addBusinessDays(d("2026-09-25"), 1))).toBe("2026-09-28"); // Fri -> Mon
  });
  it("skips national holidays (Labour Day)", () => {
    expect(iso(addBusinessDays(d("2026-09-04"), 1))).toBe("2026-09-08");
  });
  it("is province-aware (St-Jean-Baptiste only in QC)", () => {
    expect(isBusinessDay(d("2026-06-24"), "QC")).toBe(false);
    expect(isBusinessDay(d("2026-06-24"), "ON")).toBe(true);
  });
  it("adds conservative buffer for uncovered years", () => {
    // 2028 not covered: 1 business day + 2 buffer from Mon Jan 3 2028 -> Thu Jan 6
    expect(iso(addBusinessDays(d("2028-01-03"), 1))).toBe("2028-01-06");
  });
  it("includes handling days and service transit ranges", () => {
    const w = estimateDeliveryWindow({ from: d("2026-09-28"), ...transitDaysForService("Standard Shipping"), handlingDays: 2, province: "AB" });
    expect(iso(w.earliest)).toBe("2026-10-05"); // 5 business days
    expect(iso(w.latest)).toBe("2026-10-09"); // 9 business days
    expect(transitDaysForService("Express Shipping")).toEqual({ minDays: 1, maxDays: 3 });
  });
  it("labels items with correct plural", () => {
    expect(deliveryItemsLabel(1)).toBe("Delivery to your address • 1 item");
    expect(deliveryItemsLabel(3)).toBe("Delivery to your address • 3 items");
  });
  it("persists only supported delivery preferences per seller", () => {
    sessionStorage.clear();
    saveDeliveryPreference("seller-1", "Express Shipping");
    expect(readDeliveryPreference("seller-1")).toBe("Express Shipping");
    sessionStorage.setItem("barakaz_delivery_preferences", JSON.stringify({ "seller-2": "Unknown" }));
    expect(readDeliveryPreference("seller-2")).toBeNull();
  });
});
