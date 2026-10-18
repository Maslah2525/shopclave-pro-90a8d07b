import { describe, it, expect } from "vitest";
import { FULFILLMENT_STAGES, fulfillmentStageIndex } from "@/lib/fulfillmentProgress";
import { nextVendorItemStatus, canVendorTransition } from "@/lib/orderStatus";

describe("seller and customer fulfillment", () => {
  it("shares all six stages and places delivered last", () => {
    expect(FULFILLMENT_STAGES.map((s) => s.value)).toEqual(["pending", "processing", "ready_for_pickup", "shipped", "out_for_delivery", "delivered"]);
    expect(fulfillmentStageIndex("delivered")).toBe(5);
  });
  it("offers Delivered after Shipped without bypassing paid confirmation", () => {
    expect(nextVendorItemStatus("shipped")).toBe("delivered");
    expect(canVendorTransition("shipped", "delivered", "paid")).toBe(true);
    expect(canVendorTransition("shipped", "delivered", "pending")).toBe(false);
    expect(nextVendorItemStatus("delivered")).toBeNull();
    expect(nextVendorItemStatus("cancelled")).toBeNull();
  });
  it("shows ready and out-for-delivery only with actual parcel statuses", () => {
    expect(fulfillmentStageIndex("processing")).toBe(1);
    expect(fulfillmentStageIndex("processing", ["ready_for_pickup"])).toBe(2);
    expect(fulfillmentStageIndex("shipped")).toBe(3);
    expect(fulfillmentStageIndex("shipped", ["out_for_delivery"])).toBe(4);
  });
  it("does not claim delivery from just one parcel of a split item", () => {
    expect(fulfillmentStageIndex("shipped", ["delivered", "preparing"])).toBe(3);
    expect(fulfillmentStageIndex("shipped", ["delivered", "out_for_delivery"])).toBe(4);
    expect(fulfillmentStageIndex("cancelled", ["delivered"])).toBe(-1);
  });
});