# Seller onboarding roadmap

## Store settings persistence
- [ ] Audit all store settings against live storage and save/readback paths.
- [ ] Connect missing editable store preferences without changing payment, tax, or approval safeguards.
- [ ] Run focused persistence checks and verify the signed-in settings flow when an authorized session is available.

- [x] Apply secure seller application schema and server-validated workflow
- [x] Create private KYC storage and deploy seller functions
- [x] Build seven-step draft-first seller application UI
- [x] Complete admin review experience and status handling
- [x] Add and run focused onboarding tests
- [x] Verify database security, types, and server behavior
- [x] Canada-only seller submission, Connect and shipping-origin guards
- [x] Deploy get-shipping-rates, shippo-purchase-label, seller-stripe-connect
- [x] CA eligibility rows exist for all 3 business types (unreviewed, Connect disabled) + eligibility tests
- [ ] Human compliance review of CA rules (set reviewed_at, stripe_connect_enabled) — needs a person
- [ ] Publish 6 seller agreements (ca-v1) — needs legal text from user
- [ ] Stripe: activate Connect Express (CA) + restricted key permissions (Accounts/Account Links: Write) — user, in Stripe
- [ ] Test-mode seller run-through before any live flag

## Product detail page redesign
- [x] Rebuild the product purchase layout, gallery, delivery, seller, trust, tabs, and mobile actions without changing purchase flows.
- [x] Verify desktop and mobile rendering, tests, types, and preview build.
- [x] Add temporary deterministic review/sold fallbacks, real card signals, and default product images.
- [x] Expand product specifications with saved seller data, box contents, and Show more controls for long text.
- [x] Make the delivery heading location-neutral and default product prices to CAD before country-based conversion.
- [x] Keep the title and Reviews tab totals aligned and identify eligible reviewers as verified buyers.

## Desktop marketplace footer
- [x] Add supplied payment marks with conditional checkout wording and expand support, shopping, seller, policy, trust, and account navigation.

## Product trust information
- [x] Expand the four clickable trust icons into detailed same-page panels using verified policies and supplied brand artwork.

## Seller product listing (6 steps)
- [x] Brand/MPN, barcode, cost, inventory rules, 4 shipping options, review with Edit, Save as Draft / Publish
- [x] Product page shows the seller's enabled delivery options and prices
- [ ] Deploy updated checkout shipping function (awaiting owner go-ahead)

## Review presentation
- [x] Complete the review rating distribution and five-card review presentation without fabricating verified customers.

- [x] Seller specifications rows in product form + product page
- [x] Product page price display like reference (large orange CA$ price, strikethrough compare)
- [x] Show matching product thumbnails on every colour choice and all corresponding images in the selected-colour gallery.

## Image performance
- [x] Optimize every new customer-facing image upload as WebP while preserving existing uploads and evidence documents.
- [x] Confirm and clarify category image upload and replacement in the admin dashboard.

## Homepage product sections
- [x] Give sponsored products the same price, ratings, sold count, delivery, stock, seller, wishlist, and cart presentation as other product cards.
- [x] Move Featured Products “View all” to the bottom beside “Load more.”
