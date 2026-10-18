/** Display only address values saved with the order; never infer missing details. */
export function shipmentAddressLines(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const address = value as Record<string, unknown>;
  const text = (key: string) => typeof address[key] === "string" ? address[key].trim() : "";
  return [
    text("fullName"),
    text("phone"),
    text("addressLine"),
    text("addressLine2"),
    [text("city"), text("state"), text("zip")].filter(Boolean).join(", "),
    text("country"),
  ].filter(Boolean);
}

/** A parcel contains its explicitly linked order lines, not every item from its seller. */
export function parcelOrderItems<T extends { id: string }>(
  items: T[],
  links: { order_item_id: string; quantity: number }[],
): (T & { quantity: number })[] {
  return links.flatMap((link) => {
    const item = items.find((candidate) => candidate.id === link.order_item_id);
    return item ? [{ ...item, quantity: link.quantity }] : [];
  });
}