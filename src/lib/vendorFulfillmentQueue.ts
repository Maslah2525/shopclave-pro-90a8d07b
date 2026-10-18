export const FULFILLMENT_QUEUES = [
  { value: "packing", label: "To pack" },
  { value: "collection", label: "Ready to ship" },
  { value: "transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
] as const;

export type FulfillmentQueue = (typeof FULFILLMENT_QUEUES)[number]["value"];

export function vendorFulfillmentQueue(status: string, paymentStatus: string, shipmentStatuses: string[] = []): FulfillmentQueue | null {
  if (paymentStatus !== "paid" || status === "cancelled") return null;
  if (status === "delivered") return "delivered";
  if (status === "shipped" || shipmentStatuses.some((s) => ["collected", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "exception", "returned"].includes(s))) return "transit";
  if (shipmentStatuses.length > 0 && shipmentStatuses.every((s) => s === "ready_for_pickup")) return "collection";
  return "packing";
}