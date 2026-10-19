import { describe, expect, it } from "vitest";
import { customerDetailsError, customerDetailsParams, detailsFromSaved } from "@/lib/customerDetails";

const details = { fullName: " Customer ", phone: " +14165550123 ", addressLine: " 1 Test Street ", city: " Toronto ", country: "Canada", state: "Ontario", zip: "M5V 2T6" };
describe("saved customer details", () => {
  it("roundtrips all contact and address fields including postal code", () => {
    const params = customerDetailsParams(details);
    expect(params).toEqual({ p_full_name: "Customer", p_phone: "+14165550123", p_address_line: "1 Test Street", p_city: "Toronto", p_country: "Canada", p_state: "Ontario", p_postal_code: "M5V 2T6" });
    expect(detailsFromSaved({ full_name: params.p_full_name, phone: params.p_phone, address_line: params.p_address_line, city: params.p_city, country: params.p_country, state: params.p_state, postal_code: params.p_postal_code })).toEqual({ ...details, fullName: "Customer", phone: "+14165550123", addressLine: "1 Test Street", city: "Toronto" });
  });
  it("requires a telephone for saved shopping details", () => {
    expect(customerDetailsError({ ...details, phone: " " })).not.toBeNull();
  });
  it("does not auto-confirm a legacy Canadian address without a postal code", () => {
    expect(customerDetailsError({ ...details, zip: "" })).toBe("Postal Code is required");
    expect(customerDetailsError(details)).toBeNull();
  });
});