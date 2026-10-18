export const FULFILLMENT_STAGES = [
  { value: "pending", label: "Order Received" },
  { value: "processing", label: "Processing" },
  { value: "ready_for_pickup", label: "Ready to Ship" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
] as const;

export function fulfillmentStageIndex(status: string, shipmentStatuses: string[] = []): number {
  if (status === "delivered") return 5;
  if (status === "cancelled") return -1;
  // A whole item is not delivered merely because one of its split parcels is delivered.
  if (shipmentStatuses.length && shipmentStatuses.every((s) => s === "out_for_delivery" || s === "delivered")) return 4;
  if (status === "shipped" || shipmentStatuses.some((s) => ["collected", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "exception", "returned"].includes(s))) return 3;
  if (shipmentStatuses.length && shipmentStatuses.every((s) => s === "ready_for_pickup")) return 2;
  if (status === "processing") return 1;
  return status === "pending" ? 0 : -1;
}