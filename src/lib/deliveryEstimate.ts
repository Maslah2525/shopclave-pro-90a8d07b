// Canadian business-day delivery estimate. Estimates only — never a guarantee.
// Holiday list is explicit and must be maintained yearly. Years not listed fall
// back to a conservative buffer (extra days) instead of pretending coverage.

type Holiday = { date: string; provinces: "ALL" | string[] };

// Statutory/common holidays 2026–2027. National = observed across Canada for
// carrier purposes; provincial ones apply to the destination province only.
export const CANADIAN_HOLIDAYS: Holiday[] = [
  // 2026
  { date: "2026-01-01", provinces: "ALL" },
  { date: "2026-02-16", provinces: ["AB", "BC", "MB", "NB", "ON", "PE", "SK", "NS"] },
  { date: "2026-04-03", provinces: "ALL" },
  { date: "2026-05-18", provinces: "ALL" },
  { date: "2026-06-24", provinces: ["QC"] },
  { date: "2026-07-01", provinces: "ALL" },
  { date: "2026-08-03", provinces: ["AB", "BC", "MB", "NB", "NT", "NU", "ON", "SK", "NS", "PE"] },
  { date: "2026-09-07", provinces: "ALL" },
  { date: "2026-09-30", provinces: ["BC", "MB", "NT", "NU", "PE", "YT"] },
  { date: "2026-10-12", provinces: "ALL" },
  { date: "2026-11-11", provinces: ["AB", "BC", "NB", "NL", "NT", "NU", "PE", "SK", "YT"] },
  { date: "2026-12-25", provinces: "ALL" },
  { date: "2026-12-28", provinces: ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "SK", "YT"] }, // Boxing Day observed
  // 2027
  { date: "2027-01-01", provinces: "ALL" },
  { date: "2027-02-15", provinces: ["AB", "BC", "MB", "NB", "ON", "PE", "SK", "NS"] },
  { date: "2027-03-26", provinces: "ALL" },
  { date: "2027-05-24", provinces: "ALL" },
  { date: "2027-06-24", provinces: ["QC"] },
  { date: "2027-07-01", provinces: "ALL" },
  { date: "2027-08-02", provinces: ["AB", "BC", "MB", "NB", "NT", "NU", "ON", "SK", "NS", "PE"] },
  { date: "2027-09-06", provinces: "ALL" },
  { date: "2027-09-30", provinces: ["BC", "MB", "NT", "NU", "PE", "YT"] },
  { date: "2027-10-11", provinces: "ALL" },
  { date: "2027-11-11", provinces: ["AB", "BC", "NB", "NL", "NT", "NU", "PE", "SK", "YT"] },
  { date: "2027-12-27", provinces: "ALL" }, // Christmas observed
  { date: "2027-12-28", provinces: ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "SK", "YT"] },
];

export const HOLIDAY_YEARS_COVERED = new Set([2026, 2027]);
/** Extra business days added when the calendar year isn't covered. */
export const UNCOVERED_YEAR_BUFFER_DAYS = 2;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function isBusinessDay(d: Date, province?: string): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const key = iso(d);
  const p = (province || "").toUpperCase();
  return !CANADIAN_HOLIDAYS.some(
    (h) => h.date === key && (h.provinces === "ALL" || (p && h.provinces.includes(p))),
  );
}

export function addBusinessDays(start: Date, days: number, province?: string): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0;
  let buffered = false;
  let target = days;
  while (added < target) {
    d.setDate(d.getDate() + 1);
    if (!buffered && !HOLIDAY_YEARS_COVERED.has(d.getFullYear())) {
      target += UNCOVERED_YEAR_BUFFER_DAYS;
      buffered = true;
    }
    if (isBusinessDay(d, province)) added++;
  }
  return d;
}

export type DeliveryWindow = { earliest: Date; latest: Date };
export type DeliveryService = "Standard Shipping" | "Express Shipping" | "Free Shipping" | "Local Pickup";

const DELIVERY_PREFERENCE_KEY = "barakaz_delivery_preferences";

/**
 * @param minDays/maxDays transit business days (e.g. 3–7 Standard, 1–3 Express)
 * @param handlingDays seller processing business days (defaults to 1)
 */
export function estimateDeliveryWindow(opts: {
  from: Date;
  minDays: number;
  maxDays: number;
  handlingDays?: number | null;
  province?: string;
}): DeliveryWindow {
  const handling = Math.max(0, Math.round(opts.handlingDays ?? 1));
  return {
    earliest: addBusinessDays(opts.from, handling + opts.minDays, opts.province),
    latest: addBusinessDays(opts.from, handling + opts.maxDays, opts.province),
  };
}

export function transitDaysForService(service: string): { minDays: number; maxDays: number } {
  return service === "Express Shipping" ? { minDays: 1, maxDays: 3 } : { minDays: 3, maxDays: 7 };
}

/** Quote ETA already includes handling; never substitute a generic tier estimate. */
export function quotedDeliveryWindow(
  rate: { estimated_days?: number | null } | null | undefined,
  from: Date,
  province?: string,
): DeliveryWindow | null {
  const days = Number(rate?.estimated_days);
  if (!Number.isFinite(days) || days <= 0) return null;
  return estimateDeliveryWindow({ from, minDays: days, maxDays: days, handlingDays: 0, province });
}

export function saveDeliveryPreference(vendorId: string, service: DeliveryService): void {
  if (typeof window === "undefined") return;
  try {
    const stored = window.sessionStorage.getItem(DELIVERY_PREFERENCE_KEY);
    const preferences = stored ? JSON.parse(stored) as Record<string, DeliveryService> : {};
    preferences[vendorId] = service;
    window.sessionStorage.setItem(DELIVERY_PREFERENCE_KEY, JSON.stringify(preferences));
  } catch {
    // Checkout remains usable when browser storage is unavailable.
  }
}

export function readDeliveryPreference(vendorId: string): DeliveryService | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(DELIVERY_PREFERENCE_KEY);
    const value = stored ? (JSON.parse(stored) as Record<string, unknown>)[vendorId] : null;
    return value === "Standard Shipping" || value === "Express Shipping" || value === "Free Shipping" || value === "Local Pickup" ? value : null;
  } catch {
    return null;
  }
}

export function formatDeliveryWindow(w: DeliveryWindow, locale = "en-CA"): string {
  const f = (d: Date) => d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  if (iso(w.earliest) === iso(w.latest)) return f(w.earliest);
  return `${f(w.earliest)} – ${f(w.latest)}`;
}

export function deliveryItemsLabel(count: number): string {
  return `Delivery to your address • ${count} ${count === 1 ? "item" : "items"}`;
}
