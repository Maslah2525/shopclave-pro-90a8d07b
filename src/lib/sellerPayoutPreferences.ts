/** Presentation preferences only; never authorizes provider onboarding or payouts. */
export const sellerPayoutMethod = (country: string): "bank" | "paypal" =>
  country.trim().toUpperCase() === "CA" ? "bank" : "paypal";

export const CANADIAN_BANKS = [
  "Bank of Montreal (BMO)",
  "Bank of Nova Scotia (Scotiabank)",
  "Canadian Imperial Bank of Commerce (CIBC)",
  "Canadian Western Bank",
  "Desjardins",
  "EQ Bank / Equitable Bank",
  "Laurentian Bank of Canada",
  "National Bank of Canada",
  "Royal Bank of Canada (RBC)",
  "Simplii Financial",
  "Tangerine Bank",
  "TD Canada Trust",
  "Other Canadian bank or credit union",
] as const;