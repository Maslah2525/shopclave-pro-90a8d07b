import { canadianBankSchema } from "@/lib/withdrawalRules";

// Lists seller profile details still missing. Reminder only — never blocks selling.
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function missingVendorProfileItems(vendor: any, payoutPreferences?: unknown): string[] {
  if (!vendor) return [];
  const missing: string[] = [];
  const wh = rec(vendor.warehouse_address);
  const pay = rec(vendor.payment_details);
  const payouts = rec(payoutPreferences);
  const configuredPayout = payouts.method === "paypal"
    ? typeof payouts.paypalEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payouts.paypalEmail.trim())
    : payouts.method === "bank" && canadianBankSchema.safeParse(payouts).success;
  if (!has(vendor.store_description)) missing.push("Store description");
  if (!has(vendor.logo_url)) missing.push("Store logo");
  if (!has(vendor.banner_url)) missing.push("Store banner");
  if (!has(vendor.phone)) missing.push("Phone number");
  if (!has(wh.street1) || !has(wh.city) || !has(wh.country) || !has(wh.phone))
    missing.push("Pickup / shipping address");
  if (!configuredPayout && !Object.values(pay).some(has)) missing.push("Payout details");
  return missing;
}
