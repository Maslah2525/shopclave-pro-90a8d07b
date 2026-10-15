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
