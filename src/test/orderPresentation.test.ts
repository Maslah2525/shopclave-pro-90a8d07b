import { describe, expect, it } from "vitest";
import { parcelOrderItems, shipmentAddressLines } from "@/lib/orderPresentation";

describe("saved shipment address", () => {
  it("includes the recipient, phone, street, unit, province, postal code and country", () => {
    expect(shipmentAddressLines({ fullName: "Test Recipient", phone: "+14165550100", addressLine: "12 King St W", addressLine2: "Unit 4", city: "Toronto", state: "ON", zip: "M5H1A1", country: "Canada" })).toEqual([
      "Test Recipient", "+14165550100", "12 King St W", "Unit 4", "Toronto, ON, M5H1A1", "Canada",
    ]);
  });
  it("does not invent missing address details", () => {
    expect(shipmentAddressLines(null)).toEqual([]);
    expect(shipmentAddressLines({ city: "Toronto" })).toEqual(["Toronto"]);
  });
});

describe("parcel contents", () => {
  it("shows only linked products with the quantity shipped in that parcel", () => {
    const items = [{ id: "first", vendor_id: "same-seller", quantity: 3 }, { id: "second", vendor_id: "same-seller", quantity: 2 }];
    expect(parcelOrderItems(items, [{ order_item_id: "first", quantity: 1 }])).toEqual([{ id: "first", vendor_id: "same-seller", quantity: 1 }]);
    expect(parcelOrderItems(items, [])).toEqual([]);
  });
});