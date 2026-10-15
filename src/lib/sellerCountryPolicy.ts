/** Country-specific seller registration validation.
 * UI validation only; server-side seller_country_requirements and verified
 * payout provider eligibility remain authoritative. Never enable payouts here.
 */
export type SellerEntityType = "individual" | "sole_proprietor" | "company";
export type SellerCountryRule = {
  country: string;
  businessType: SellerEntityType;
  requiredFields: string[];
  requiredDocuments: string[];
  reviewedAt: string | null;
  providerOnboardingEnabled: boolean;
};
export type SellerBusinessData = Record<string, unknown>;

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const COUNTRY_ADDRESS_FIELDS: Record<string, string[]> = {
  CA: ["address_line1", "city", "region", "postal_code"],
  US: ["address_line1", "city", "region", "postal_code"],
  GB: ["address_line1", "city", "postal_code"],
  CN: ["address_line1", "city", "region"],
  KR: ["address_line1", "city"],
  DE: ["address_line1", "city", "postal_code"],
  FR: ["address_line1", "city", "postal_code"],
};
export function sellerRequiredAddressFields(country: string): string[] {
  return COUNTRY_ADDRESS_FIELDS[country.toUpperCase()] ?? ["address_line1", "city"];
}
export function missingSellerBusinessFields(
  country: string,
  businessType: SellerEntityType,
  business: SellerBusinessData,
  rule?: SellerCountryRule | null,
): string[] {
  const required = new Set<string>(["legal_name", ...sellerRequiredAddressFields(country)]);
  if (businessType === "company") required.add("registration_number");
  if (businessType === "sole_proprietor" && business.is_business_registered === true) required.add("registration_number");
  if (rule && rule.country === country.toUpperCase() && rule.businessType === businessType) {
    rule.requiredFields.forEach(field => required.add(field));
  }
  return [...required].filter(field => !hasText(business[field]));
}
export function canOfferSellerPayoutOnboarding(rule?: SellerCountryRule | null): boolean {
  return Boolean(rule?.reviewedAt && rule.providerOnboardingEnabled);
}
