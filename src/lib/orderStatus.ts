// Documented multivendor order-status model (mirrors the proposed DB trigger).
// Item flow: pending -> processing -> shipped -> delivered; cancelled is terminal.
// Overall order status is derived from all NON-cancelled items:
//   all delivered            -> delivered
//   all shipped/delivered    -> shipped (partially delivered orders stay "shipped")
//   any processing+          -> processing
//   all cancelled            -> cancelled
//   otherwise                -> pending
export const ITEM_FLOW = ["pending", "processing", "shipped", "delivered"] as const;
export type ItemStatus = (typeof ITEM_FLOW)[number] | "cancelled";

/** Keep the next action visible even when payment has not yet been confirmed. */
export function nextVendorItemStatus(status: string): ItemStatus | null {
  const index = ITEM_FLOW.findIndex((step) => step === status);
  return index >= 0 ? ITEM_FLOW[index + 1] ?? null : null;
}

export function aggregateOrderStatus(items: { status: string }[]): ItemStatus {
  const live = items.filter((i) => i.status !== "cancelled");
  if (items.length && !live.length) return "cancelled";
  if (!live.length) return "pending";
  if (live.every((i) => i.status === "delivered")) return "delivered";
  if (live.every((i) => i.status === "shipped" || i.status === "delivered")) return "shipped";
  if (live.some((i) => ["processing", "shipped", "delivered"].includes(i.status))) return "processing";
  return "pending";
}

/** Vendors may only move one step forward, and only once the order is paid. */
export function canVendorTransition(from: string, to: string, paymentStatus: string): boolean {
  if (paymentStatus !== "paid") return false;
  const a = ITEM_FLOW.indexOf(from as any);
  const b = ITEM_FLOW.indexOf(to as any);
  return a >= 0 && b === a + 1;
}
