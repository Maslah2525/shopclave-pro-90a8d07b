import { describe, expect, it } from "vitest";
import { vendorFulfillmentQueue } from "@/lib/vendorFulfillmentQueue";

describe("paid fulfilment queue", () => {
  it("excludes unpaid and cancelled items", () => {
    expect(vendorFulfillmentQueue("pending", "pending")).toBeNull();
    expect(vendorFulfillmentQueue("processing", "failed")).toBeNull();
    expect(vendorFulfillmentQueue("cancelled", "paid")).toBeNull();
    expect(vendorFulfillmentQueue("pending", "paid")).toBe("packing");
  });
  it("places paid orders by actual item and parcel progress", () => {
    expect(vendorFulfillmentQueue("processing", "paid", ["ready_for_pickup"])).toBe("collection");
    expect(vendorFulfillmentQueue("processing", "paid", ["ready_for_pickup", "preparing"])).toBe("packing");
    expect(vendorFulfillmentQueue("shipped", "paid", ["out_for_delivery"])).toBe("transit");
    expect(vendorFulfillmentQueue("shipped", "paid", ["delivered"])).toBe("transit");
    expect(vendorFulfillmentQueue("delivered", "paid")).toBe("delivered");
  });
});