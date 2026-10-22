# Real delivery prices on the product page + mobile banner text

## 1. Product page: show the actual Standard and Express prices
Today the delivery box on each product page says "Live rate at checkout". Replace that with the real carrier prices.

- When a signed-in shopper has a saved address, the product page asks for live carrier rates for that product (quantity and selected variant) to that address — the same request checkout uses.
- Show only two rows, matching checkout: **Standard Shipping** (cheapest standard rate) and **Express Delivery** (cheapest express rate), each with its CAD price, carrier name and estimated arrival.
- Heading becomes "Delivery to {city, province}" with a "Change" link to the saved address in the account page.
- While loading: small price placeholders. If a tier has no rate for that address, that row says "Not available to this address".
- Shoppers who are signed out or have no saved address: instead of "Live rate at checkout", show "Sign in to see delivery prices" / "Add your address to see delivery prices" (the price service only quotes for signed-in shoppers with a full address — no made-up prices).
- Remove the "The final quote is confirmed at checkout" line. Checkout still re-quotes, so prices always match what's charged.
- The chosen tier is still remembered and preselected at checkout.

## 2. Mobile banner text still stretching
The fix from last time exists only in the preview; the live site (barakaz.com) still has the old layout until published, which is likely what you're seeing. I'll also make it stronger:
- Narrower text block on phones (about 62% of banner width), slightly smaller title/subtitle, guaranteed wrapping on 2–3 lines.
- Apply the same treatment to the top homepage carousel text.
- Check at 360px and 390px phone widths with screenshots of every banner.

## Technical details
- New hook `useProductShippingQuote(productId, variantId, qty)` in ProductDetailPage: reads saved address via existing customer details query, calls `get-shipping-rates`, reduces with `buildDeliveryOptions` + `tierLabelOf` from `src/lib/shippingOptions.ts`; cached via react-query keyed on product/variant/qty/address.
- Replace `"Live rate at checkout"` in `deliveryOptions` (ProductDetailPage ~line 394); pickup row unchanged.
- DynamicBannerPlacement overlay: `max-w-[62%] md:max-w-xl`, `text-sm`/`text-[11px]` on mobile; HeroBanner overlay gets `max-w-[62%]` + `break-words`.
- No database or pricing logic changes; nothing published without your OK.
