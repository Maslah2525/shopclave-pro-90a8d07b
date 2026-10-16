/** Presentation-only seller banking guidance.
 * Never use this file to authorize onboarding, payouts, or countries.
 * Provider capabilities must be checked by a reviewed server-side policy.
 */
export function sellerBankingGuidance(country: string): string {
  switch (country.toUpperCase()) {
    case "CA": return "Canadian banks commonly require a transit number, institution number and account number.";
    case "US": return "US banks commonly require a routing number and account number.";
    case "GB": return "UK banks commonly require a sort code and account number.";
    case "CN": return "Banking and verification requirements for China depend on the approved payout provider and seller entity.";
    case "KR": return "Banking and verification requirements for South Korea depend on the approved payout provider and seller entity.";
    default: return "IBAN, BIC/SWIFT or local banking identifiers may be required, depending on the country and payout provider.";
  }
}

/** Bank detail fields a seller in the given country should expect to provide
 * during secure provider onboarding. Presentation only — the payout provider
 * collects these details directly; Barakaz never stores them here. */
export function sellerBankFields(country: string): string[] {
  switch (country.toUpperCase()) {
    case "CA": return ["Transit number (5 digits)", "Institution number (3 digits)", "Account number"];
    case "US": return ["Routing number (9 digits)", "Account number"];
    case "CN": return ["Bank name", "Account number", "SWIFT/BIC code"];
    case "KR": return ["Bank name", "Account number"];
    default: return ["IBAN or local account number", "BIC/SWIFT or local bank code"];
  }
}
