# Audit results and proposed fixes (mobile photo + multi-item checkout)

## What I tested directly (read-only, live site, 360px phone screen, 2026-10-12)
- The live site now runs a newer version than before (main script changed). The old "test payments only" checkout banner is gone.
- Product photo still missing: the main photo loads (1254px source) but is drawn 0px wide; a 240px-tall empty gap appears under the quantity box instead. Title, price, rating, buttons render.
- Price shows in euros (browser located in the Netherlands).

## What I read from saved orders (no orders created)
- 10 newest orders: 6 saved their item line, 4 saved none (newest failures: 6bc77c77 on 10-11 21:00, 63a735d2 on 10-11 19:28). Still happening after the latest deploy.
- Every successful order has exactly 1 line. No order is paid.

## Inferred from code only (not proven)
- The order function now saves item lines one at a time, so my earlier "empty shipping field on multi-line save" theory is weaker. The real error is unknown because the function logs nothing usable.
- The phone photo is lost because its slot in the page layout gets zero width, not because of the image itself.

## Proposed fixes (needs your approval)
1. Product page: make the phone layout truly single-column so the photo slot has full width; verify at 360px before publishing.
2. Order function: log the full database error on item-line failure, set shipping to 0 explicitly on extra lines, and clean up the empty order (already attempted) — then deploy only that function.
3. Retest with a two-product cart only if you authorize one test order (no payment).
4. Nothing published until you say so.
