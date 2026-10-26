import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { normalizeSelection, resolveVariant, isOptionValueAvailable, getPurchaseState, clampQuantity, remainingForCart } from "@/lib/productPurchase";
import { colorChoiceImageUrl, galleryImageUrls } from "@/lib/productVariantImages";

const variants = [
  { id: "a", stock: 3, variant_options: { Color: "Red", Size: "M" } },
  { id: "b", stock: 0, variant_options: { Color: "Red", Size: "L" } },
  { id: "c", stock: 5, variant_options: { Color: "Blue", Size: "L" } },
];
const types = { Color: ["Red", "Blue"], Size: ["M", "L"] };
const keys = Object.keys(types);

describe("variant selection", () => {
  it("never silently defaults multi-value options", () => {
    expect(normalizeSelection(types, {})).toEqual({});
    expect(normalizeSelection({ Size: ["One"] }, {})).toEqual({ Size: "One" });
    expect(normalizeSelection(types, { Color: "Green", Size: "M" })).toEqual({ Size: "M" });
  });
  it("disables unavailable combinations", () => {
    expect(isOptionValueAvailable(variants, { Color: "Red" }, "Size", "L")).toBe(false);
    expect(isOptionValueAvailable(variants, { Color: "Red" }, "Size", "M")).toBe(true);
    expect(isOptionValueAvailable(variants, { Size: "M" }, "Color", "Blue")).toBe(false);
  });
  it("blocks purchase until every option is chosen", () => {
    const s = getPurchaseState({ hasVariants: true, optionKeys: keys, selected: { Color: "Red" }, variant: null, productStock: 99 });
    expect(s).toMatchObject({ canBuy: false, reason: "select_options" });
  });
  it("uses the variant stock, not product stock", () => {
    const sel = { Color: "Red", Size: "L" };
    const v = resolveVariant(variants, keys, sel);
    expect(getPurchaseState({ hasVariants: true, optionKeys: keys, selected: sel, variant: v, productStock: 99 })).toMatchObject({ canBuy: false, reason: "out_of_stock" });
    const sel2 = { Color: "Red", Size: "M" };
    expect(getPurchaseState({ hasVariants: true, optionKeys: keys, selected: sel2, variant: resolveVariant(variants, keys, sel2), productStock: 99 })).toEqual({ canBuy: true, maxQty: 3, reason: null });
  });
});

describe("quantity", () => {
  it("caps by stock and floors at 1", () => {
    expect(clampQuantity(10, 3)).toBe(3);
    expect(clampQuantity(0, 3)).toBe(1);
    expect(clampQuantity(NaN, 3)).toBe(1);
    expect(remainingForCart(3, 2)).toBe(1);
    expect(remainingForCart(3, 5)).toBe(0);
  });
});

describe("variant images", () => {
  const imageVariants = [
    { id: "red-s", variant_options: { Color: "Red", Size: "S" }, image_url: "red-legacy.jpg" },
    { id: "red-m", variant_options: { Color: "Red", Size: "M" } },
    { id: "blue-s", variant_options: { Color: "Blue", Size: "S" }, image_url: "blue-legacy.jpg" },
  ];
  const images = [
    { url: "shared.jpg", position: 0, variant_id: null },
    { url: "red-two.jpg", position: 1, variant_id: "red-m" },
    { url: "red-one.jpg", position: 0, variant_id: "red-s" },
    { url: "red-one.jpg", position: 2, variant_id: "red-m" },
  ];

  it("shows a matching thumbnail for current and legacy colour images", () => {
    expect(colorChoiceImageUrl("Color", "Red", imageVariants, images)).toBe("red-one.jpg");
    expect(colorChoiceImageUrl("Color", "Blue", imageVariants, images)).toBe("blue-legacy.jpg");
    expect(colorChoiceImageUrl("Color", "Green", imageVariants, images)).toBe("shared.jpg");
  });

  it("combines every distinct colour image with shared product photos", () => {
    expect(galleryImageUrls({
      images,
      variants: imageVariants,
      colorName: "Color",
      colorValue: "Red",
    })).toEqual(["red-one.jpg", "red-two.jpg", "red-legacy.jpg", "shared.jpg"]);
  });
});

describe("product page wiring", () => {
  const src = readFileSync("src/pages/ProductDetailPage.tsx", "utf8");
  const gallery = readFileSync("src/components/product/ProductGallery.tsx", "utf8");
  const details = readFileSync("src/components/product/ProductDescriptionTabs.tsx", "utf8");
  it("desktop and mobile actions share one guarded handler with quantity", () => {
    expect(src.match(/handlePurchase\("cart"\)/g)?.length).toBe(2);
    expect(src.match(/handlePurchase\("buy"\)/g)?.length).toBe(2);
    expect(src).toMatch(/\}, qtyToAdd\);/);
    expect(src).not.toMatch(/disabled=\{!purchase\.canBuy\} onClick=\{\(\) => handlePurchase/);
    expect(src).toContain("toast.error(purchaseMessage(purchase))");
  });
  it("removes fabricated social proof and uses CAD schema", () => {
    expect(src).not.toMatch(/seededRandom|getDisplayVendorPerformance|getDisplayProductRating|viewing this right now/);
    expect(src).toContain('priceCurrency: "CAD"');
    expect(src).not.toContain('"KES"');
  });
  it("keeps purchase controls consistent and stock-capped", () => {
    expect(src).toContain('disabled={!purchase.canBuy || qty >= purchase.maxQty}');
    expect(src).toContain('remainingForCart(purchase.maxQty, inCart)');
    expect(src).toContain('variantId: selectedVariant?.id');
  });
  it("offers both dated delivery choices and carries the preference to checkout", () => {
    const checkout = readFileSync("src/pages/CheckoutPage.tsx", "utf8");
    expect(src).toContain('normalizeShippingOptions');
    expect(src).toContain("Delivery to {shipQuote.address?.city");
    expect(src).not.toContain("Delivery in Canada");
    expect(src).toContain("Estimated delivery {option.arrival}");
    expect(src).toContain("saveDeliveryPreference(product.vendor_id, selectedDelivery)");
    expect(checkout).toContain("readDeliveryPreference(v.vendor_id)");
  });
  it("shows catalogue prices in CAD until the visitor country is known", () => {
    const locale = readFileSync("src/hooks/useLocale.ts", "utf8");
    expect(locale).toContain('FALLBACK_LOCALE: CountryInfo = { code: "CA", name: "Canada", currency: "CAD"');
    expect(locale).toContain('target === "CAD" ? amountInCAD : convertFromCAD');
  });
  it("provides accessible gallery controls and mobile swipe", () => {
    expect(gallery).toContain('aria-label="Previous product image"');
    expect(gallery).toContain('aria-label="Next product image"');
    expect(gallery).toContain('onTouchStart');
    expect(gallery).toContain('Gallery position');
    expect(src).toContain("galleryImageUrls");
    expect(src).toContain("colorChoiceImageUrl");
    expect(gallery).toContain("event.currentTarget.src = barakazIcon");
  });
  it("uses real review totals in the content tabs", () => {
    expect(details).toContain('Reviews ({reviewCount})');
    expect(details).toContain('productId={productId}');
    expect(details).toContain('displayReviewCount={reviewCount}');
    expect(src).toContain("reviewCount={displayStats.reviewCount}");
    expect(src).toContain("reviewRating={displayStats.rating}");
    expect(details).not.toContain('Questions');
  });
  it("shows only the review count and rating distribution — no review cards", () => {
    const reviews = readFileSync("src/components/product/ProductReviews.tsx", "utf8");
    expect(reviews).toContain("Customer Reviews");
    expect(reviews).toContain("buildRatingDistribution(summaryRating, summaryReviewCount)");
    expect(reviews).toContain("Write a Review");
    expect(reviews).not.toContain("buildSampleReviews");
    expect(reviews).not.toContain("Sample review");
    expect(reviews).not.toContain("Verified buyer");
    expect(reviews).not.toContain("review.profile");
  });
  it("shows saved product specifications and expands long content", () => {
    expect(details).toContain('Package dimensions');
    expect(details).toContain("meta?.option_values");
    expect(details).toContain("Show more");
    expect(src).toContain("option_values: optionTypes");
    expect(src).toContain("weight_g: product.weight_g");
  });
});

describe("review presentation", () => {
  it("keeps the generated distribution aligned with the displayed total and rating", async () => {
    const { buildRatingDistribution } = await import("@/lib/reviewPresentation");
    const distribution = buildRatingDistribution(4.7, 31);
    expect(distribution.reduce((sum, row) => sum + row.count, 0)).toBe(31);
    expect(distribution.reduce((sum, row) => sum + row.count * row.star, 0)).toBe(Math.round(4.7 * 31));
  });
});

describe("marketplace product card", () => {
  const card = readFileSync("src/components/marketplace/ProductCard.tsx", "utf8");
  it("shows a consistent row under the title: stars, review count and sold", () => {
    expect(card).toContain("displayReviewCount");
    expect(card).toContain("{displaySoldCount} sold");
    expect(card).toMatch(/aria-label=\{`Rated \${displayRating} out of 5/);
  });
  it("uses deterministic temporary fallbacks without writing review or order records", () => {
    const displayStats = readFileSync("src/lib/productDisplayStats.ts", "utf8");
    expect(card).toContain("getProductDisplayStats");
    expect(displayStats).toContain("hasRealReviews ? realRating");
    expect(displayStats).toContain("hasRealSold ? realSoldCount");
    expect(displayStats).not.toMatch(/Math\.random|supabase/);
  });
  it("falls back to the real stats hook when a list omits stats", () => {
    expect(card).toContain("useProductRatings(needsStats ? [id] : [])");
    expect(card).toContain("stats?.[id]?.sold");
  });
  it("shows only real stock, delivery, and seller verification signals", () => {
    expect(card).toContain("stock != null && stock > 0 && stock <= 5");
    expect(card).toContain("handlingTimeDays == null ? null");
    expect(card).toContain("verifiedSeller ?");
  });
});
