// Delivery-option curation for checkout.
// Shippo returns every carrier rate, but checkout only presents two choices:
// the cheapest Standard rate and the cheapest Express rate for the shopper's
// address. Everything else stays server-persisted but never renders.

export const EXPRESS_TRANSIT_MAX_DAYS = 3;

export const STANDARD_LABEL = "Standard Shipping";
export const EXPRESS_LABEL = "Express Delivery";

export type RateLike = {
  quote_id: string;
  provider: string;
  service: string;
  amount_cad: number;
  estimated_days?: number | null;
};

const EXPRESS_NAME_RE = /(overnight|next\s*day|next-day|same\s*day|priority|express|2\s*day|2day|3\s*day|3day)/i;
// Ground-style services stay in Standard regardless of how fast they are
// on a given route (e.g. "UPS Standard", "Expedited Parcel", "Ground").
const STANDARD_NAME_RE = /(standard|ground|economy|expedited|parcel|mail|post|freight|lettermail|letterpost)/i;

/** Carrier transit days for a rate (server estimated_days already includes handling). */
export function carrierTransitDays(rate: RateLike, handlingDays: number): number | null {
  const est = Number(rate.estimated_days ?? 0);
  if (!Number.isFinite(est) || est <= 0) return null;
  const transit = est - Math.max(0, handlingDays);
  return transit > 0 ? transit : 1;
}

export function isExpressRate(rate: RateLike, handlingDays = 0): boolean {
  if (EXPRESS_NAME_RE.test(String(rate.service || ""))) return true;
  if (STANDARD_NAME_RE.test(String(rate.service || ""))) return false;
  const transit = carrierTransitDays(rate, handlingDays);
  return transit !== null && transit <= EXPRESS_TRANSIT_MAX_DAYS;
}

export type DeliveryOptions = { standard: RateLike | null; express: RateLike | null };

/** Cheapest rate per tier; rates without an ETA are treated as Standard. */
export function buildDeliveryOptions(rates: RateLike[] | null | undefined, handlingDays = 0): DeliveryOptions {
  const cheapest = (list: RateLike[]): RateLike | null =>
    list.length ? list.reduce((best, r) => (Number(r.amount_cad) < Number(best.amount_cad) ? r : best)) : null;
  const standard: RateLike[] = [];
  const express: RateLike[] = [];
  for (const r of rates ?? []) {
    (isExpressRate(r, handlingDays) ? express : standard).push(r);
  }
  return { standard: cheapest(standard), express: cheapest(express) };
}

export function tierLabelOf(rate: RateLike, handlingDays = 0): string {
  return isExpressRate(rate, handlingDays) ? EXPRESS_LABEL : STANDARD_LABEL;
}

export function pickAutoSelectedRate(
  rates: RateLike[] | null | undefined,
  handlingDays: number,
  preferred: string | null,
): RateLike | null {
  const options = buildDeliveryOptions(rates, handlingDays);
  if (preferred === "Express Shipping" && options.express) return options.express;
  return options.standard ?? options.express;
}
