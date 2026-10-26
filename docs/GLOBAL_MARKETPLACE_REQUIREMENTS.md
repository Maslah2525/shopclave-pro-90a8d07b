# BARAKAZ INC. — Global marketplace requirements and rollout gates

Status: **approved product direction; implementation incomplete**. BARAKAZ INC. is incorporated in Canada but operates a **global multi-vendor marketplace**. Canadian incorporation must not be conflated with seller-country eligibility or buyer shipping eligibility.

## Country activation contract
Model separately: seller application permitted, seller verification requirements published, payout provider onboarding available, payouts enabled, and sell-to destination/lane operational. No country may be marked trading-enabled solely because it appears in a country dropdown. Country configuration must be server-enforced, versioned, auditable, and backed by provider verification. Unsupported markets may save drafts but must see accurate eligibility messaging. Never promise universal coverage.

## Seven-step seller registration
1. Account — legal name, email, internationally validated phone, account verification.
2. Business — country of establishment, legal entity type (individual / sole proprietor / incorporated company), legal/trading name, registration number when applicable, tax IDs, structured business and registered addresses.
3. Identity and KYB — country/entity-specific requirements, beneficial owners and directors where applicable, secure private document collection, review status and audit trail.
4. Store — public profile, branding, product categories, warehouse and return locations.
5. Payout — provider eligibility by country/entity/currency, hosted bank onboarding, status and retry; no raw bank credentials in Barakaz database.
6. Agreements — jurisdiction-appropriate versioned seller terms, commissions, fulfillment and returns, consent evidence.
7. Review and submit — server validation, saved draft recovery, explicit pending/unsupported states, administrative review and approval.

### Country-specific onboarding
Use a policy matrix keyed by ISO 3166-1 alpha-2 country, legal entity type and rules version. Requirements may include tax identifiers, beneficial-owner identity, business registration evidence, proof of address and provider-specific KYC/KYB. Never assume all of China, South Korea, the UK, the EU, Africa or the US share the same onboarding rules. Country policy must be reviewed before activation.

## Twelve editable seller settings sections
| Section | Minimum validated persistence and workflow |
|---|---|
| Store Profile | Name, slug, description, contacts, visibility |
| Business Information | Legal entity, addresses, registration, tax identifiers; sensitive changes trigger re-verification |
| Shipping Settings | Multiple origin warehouses, shipping zones, service methods, handling time, destinations, tracking |
| Payments & Payouts | Hosted provider onboarding, supported currency selection, payout status, bank details managed by provider |
| Tax Settings | Tax registration jurisdictions, exemption evidence where relevant, configured tax treatment |
| Returns & Refunds | Return windows, locations, conditions, approvals and policy disclosures |
| Store Policies | Versioned shipping, cancellation, privacy and service policies |
| Store Appearance & Branding | Logo, banner, theme, storefront content, preview |
| Notifications | Email and platform notification preferences with verified delivery configuration |
| Team & Staff | Invite, revoke, scoped roles and audit logs |
| Security & Account | Sessions, authentication, MFA where available, credential/security events |
| Account Health & Compliance | Verification state, document expiry, policy violations, holds, remediation and appeal |

Each section requires load/edit/save/validation/authorization, change audit and meaningful error states. Changes to legal identity, payout ownership or sensitive tax fields must use a controlled re-verification workflow.

## Country-aware bank details — provider-hosted only
- Canada: transit, institution and account numbers where required.
- US: routing and account number.
- UK: sort code and account number.
- SEPA/European countries: IBAN, plus BIC/SWIFT where required.
- China and South Korea: provider-specific domestic bank, branch, account-holder and verification requirements; **do not hard-code unsupported assumptions**.
- Other supported countries: render only the payment provider's currently verified country/currency requirements.

Use Stripe Connect hosted onboarding/embedded provider components and additional vetted regulated payout providers only where necessary. Never store account numbers, bank tokens that expose credentials, identity scans in public storage, or raw provider secrets in seller-profile JSON. Store only provider account IDs, capabilities, last-four/masked display where permitted, verification statuses and audit events. Validate provider country and payout-currency support against current official provider capabilities before enablement.

## Seller finance dashboard
Total earnings; available, pending and held balances; BARAKAZ commission; transaction ledger; refund deductions; payout history/status; downloadable dated statements. Balances must come from a reconciled immutable ledger with currency-specific minor units, not client-side subtraction of orders and withdrawal requests. Stripe/payment provider events must be idempotent. No admin or seller may mark a payout settled without provider-confirmed settlement.

## Administrative controls
Country eligibility and rollout rules; identity/KYB review; restricted-document access audit; commission configuration; payout-provider capability mapping; payout holds and reconciliation; refunds/disputes; financial statements and export; role-based authorization; immutable activity history. Admin actions that affect funds or identity require privileged server-side enforcement and audit.

## Global shipping, checkout and currency
Sellers may configure multiple warehouses/return addresses, destinations and services. Customer display currency must be distinguished from actual charge currency and seller payout currency; never promise a currency or conversion rate until supported and quoted. Each shipping lane requires carrier availability, customs data, landed-cost/duties model (DDP/DAP), tax rules, restricted-goods checks, price/weight validation, server-side quote expiry and payment reconciliation. Orders and tracking must support multiple vendors and shipments. Fail closed for unsupported lanes.

## Current code gaps (audit 2026-10-15)
- `drizzle/migrations/0016_canada_only_seller_submission_guard.sql` blocks non-Canadian applications from submission.
- `src/pages/vendor/VendorPayments.tsx` enables Stripe onboarding only when `application.country === "CA"`.
- `src/pages/vendor/VendorSettings.tsx` currently provides a limited store-profile and single warehouse settings form, not 12 complete sections.
- `src/pages/vendor/VendorEarnings.tsx` still accepts full bank account numbers in a withdrawal request inserted into `withdrawal_requests.payment_details`. This violates the target no-sensitive-bank-storage requirement and must be replaced before global rollout.
- `supabase/functions/create-order/index.ts` rejects non-Canadian shipping destinations.
- `docs/INTERNATIONAL_SHIPPING_ROADMAP.md` explicitly identifies customs/tax/carrier activation as pending.
- Stripe-only checkout PR #68 and masked admin withdrawal details PR #69 were open at audit time. Masking display does **not** solve underlying sensitive-bank-data storage.

## Delivery gates
1. Inventory current schema/RLS/Stripe Connect capabilities and provider support countries, reconcile migrations.
2. Replace raw withdrawal bank-detail collection with hosted provider payout setup and server-authoritative financial ledger.
3. Introduce country capability registry and country/entity-specific seller validation; safely retire Canada-only application guard only for verified enabled countries.
4. Implement all 12 settings sections with server-backed persistence, validation, authorization and audit.
5. Build global seller financial dashboard and admin reconciliation/financial exports.
6. Enable individual shipping lanes only after carrier/customs/tax/payment E2E tests.
7. Verify security, webhook idempotency, currency precision, document access, test/live segregation, seller activation and payouts per country.
8. Update README, OpenAPI, runbooks and production checklist; release in controlled country cohorts.

**No production database migration, payout execution, banking-data transfer or country activation is authorized by this requirements document alone.**
