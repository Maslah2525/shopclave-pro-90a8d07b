import { describe, it, expect } from "vitest";
import {
  buildDeliveryOptions,
  pickAutoSelectedRate,
  tierLabelOf,
  STANDARD_LABEL,
  EXPRESS_LABEL,
} from "@/lib/shippingOptions";

const rate = (over: Record<string, any>) => ({
  quote_id: "q-" + over.service,
  provider: "Carrier",
  service: "Service",
  amount_cad: 10,
  estimated_days: 5,
  ...over,
});

describe("checkout delivery options", () => {
  it("shows only the cheapest Standard and cheapest Express rate — nothing else renders", () => {
    const rates = [
      rate({ service: "Ground", amount_cad: 14.5, estimated_days: 6 }),
      rate({ service: "Ground Saver", amount_cad: 9.25, estimated_days: 8 }),
      rate({ service: "Priority", amount_cad: 30, estimated_days: 2 }),
      rate({ service: "Express Saver", amount_cad: 22, estimated_days: 3 }),
      rate({ service: "Overnight", amount_cad: 60, estimated_days: 1 }),
    ];
    const o = buildDeliveryOptions(rates, 1);
    expect(Object.values(o).filter(Boolean)).toHaveLength(2);
    expect(o.standard?.amount_cad).toBe(9.25);
    expect(o.express?.amount_cad).toBe(22);
  });

  it("classifies by carrier speed, not price", () => {
    const o = buildDeliveryOptions(
      [rate({ service: "Priority Mail", amount_cad: 5, estimated_days: 2 }), rate({ service: "Ground", amount_cad: 12, estimated_days: 7 })],
      1,
    );
    expect(o.standard?.service).toBe("Ground");
    expect(o.express?.service).toBe("Priority Mail");
  });

  it("keeps ground-style services in Standard even when the route is fast", () => {
    const o = buildDeliveryOptions([rate({ service: "UPS Standard", amount_cad: 12, estimated_days: 3 })]);
    expect(o.standard?.service).toBe("UPS Standard");
    expect(o.express).toBeNull();
    const ca = buildDeliveryOptions([rate({ service: "Expedited Parcel", amount_cad: 13, estimated_days: 3 })]);
    expect(ca.standard?.service).toBe("Expedited Parcel");
    expect(ca.express).toBeNull();
  });

  it("treats rates without a carrier ETA as Standard", () => {
    const o = buildDeliveryOptions([rate({ service: "Mystery", estimated_days: null })]);
    expect(o.standard?.service).toBe("Mystery");
    expect(o.express).toBeNull();
  });

  it("omits a tier when the address has no such rate", () => {
    expect(buildDeliveryOptions([rate({ estimated_days: 7 })]).express).toBeNull();
    expect(buildDeliveryOptions([rate({ service: "Overnight", estimated_days: 1 })]).standard).toBeNull();
    expect(buildDeliveryOptions([], 1).standard).toBeNull();
  });

  it("auto-selects Standard by default and honours a saved Express preference", () => {
    const rates = [rate({ service: "Ground", amount_cad: 12, estimated_days: 7 }), rate({ service: "Express", amount_cad: 30, estimated_days: 2 })];
    expect(pickAutoSelectedRate(rates, 1, null)?.service).toBe("Ground");
    expect(pickAutoSelectedRate(rates, 1, "Express Shipping")?.service).toBe("Express");
    expect(pickAutoSelectedRate([], 1, "Standard Shipping")).toBeNull();
  });

  it("labels the chosen rate by its tier", () => {
    expect(tierLabelOf(rate({ estimated_days: 7 }))).toBe(STANDARD_LABEL);
    expect(tierLabelOf(rate({ service: "Overnight", estimated_days: 2 }))).toBe(EXPRESS_LABEL);
  });
});
