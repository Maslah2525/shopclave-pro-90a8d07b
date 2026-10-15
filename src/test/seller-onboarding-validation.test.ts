import { describe, expect, it } from "vitest";
import { INITIAL_SELLER_DRAFT, validateSellerStep } from "@/lib/sellerOnboarding";

const complete = {
  ...INITIAL_SELLER_DRAFT,
  full_name: "Jane Seller",
  phone: "+14165550123",
  country: "CA",
  business_type: "company" as const,
  legal_name: "Seller Company",
  registration_number: "REG-123",
  address: "100 King St W, Toronto, ON M5X 1A9",
  address_line1: "100 King St W",
  city: "Toronto",
  region: "ON",
  postal_code: "M5X 1A9",
  category: "Apparel",
  store_name: "Jane Store",
  store_description: "Genuine products",
  logo_url: "https://example.com/logo.jpg",
  product_categories: ["category-id"],
  ship_from: "100 King St W, Toronto, ON M5X 1A9",
  return_address: "100 King St W, Toronto, ON M5X 1A9",
};

describe("Canadian seller onboarding validation matrix", () => {
  it("requires identity details before leaving account", () =>
    expect(validateSellerStep(1, INITIAL_SELLER_DRAFT)).toBeTruthy());

  it("allows an individual without a registration number", () => {
    const individual = { ...complete, business_type: "individual" as const, registration_number: "" };
    expect(validateSellerStep(2, individual)).toBeNull();
  });

  it("allows an unregistered sole proprietor without a registration number", () => {
    const soleProp = { ...complete, business_type: "sole_proprietor" as const, is_business_registered: false, registration_number: "" };
    expect(validateSellerStep(2, soleProp)).toBeNull();
  });

  it("requires a registration number for a registered sole proprietor", () => {
    const soleProp = { ...complete, business_type: "sole_proprietor" as const, is_business_registered: true, registration_number: "" };
    expect(validateSellerStep(2, soleProp)).toContain("registered");
    expect(validateSellerStep(2, { ...soleProp, registration_number: "SP-123" })).toBeNull();
  });

  it("requires a registration number for a company", () => {
    expect(validateSellerStep(2, { ...complete, registration_number: "" })).toContain("registration");
    expect(validateSellerStep(2, complete)).toBeNull();
  });

  it("requires all store and logistics details", () =>
    expect(validateSellerStep(4, { ...complete, ship_from: "" })).toBeTruthy());

  it("accepts complete required information", () => {
    expect(validateSellerStep(1, complete)).toBeNull();
    expect(validateSellerStep(2, complete)).toBeNull();
    expect(validateSellerStep(4, complete)).toBeNull();
  });
});
