# BARAKAZ INC. — Global marketplace implementation contract

**Business definition:** BARAKAZ INC. is a Canada-incorporated **global** multi-vendor marketplace. Canadian incorporation is not a seller-country restriction. Seller, buyer, payment, shipping, tax and payout eligibility must be independently assessed per country and provider.

**Status:** Requirements and gap register, **not** a claim of implementation or production activation. All country expansion defaults to fail-closed until approved by compliance, supported by payout/shipping providers and validated in staging.

## 1. Seller onboarding (seven steps)
1. Account: verified email, full legal name, phone, authentication.
2. Business: country, individual/sole proprietor/incorporated company, legal name, registration and tax IDs as applicable, structured international registered address.
3. Verification: country/entity-specific KYC/KYB documents, beneficial ownership and representative details as required; secure private uploads and reviewed status.
4. Store: name, category, branding, warehouse and return locations.
5. Payout: provider-hosted bank collection, country eligibility, settlement currency, verified payout account. No raw account identifiers, identity documents or bank credentials in public vendor tables.
6. Agreements: published versioned policies with acceptance timestamp and version.
7. Review and submit: server-side eligibility, required-document and agreement validation; autosave/resume; audit trail.

**Current gap:** seller_country_requirements and server-side submission guards are Canada-specific; UI has a seven-step flow but not comprehensive global tax/business/address requirements. Never remove server-side restrictions without replacement eligibility checks.

## 2. Seller settings (12 fully editable, validated sections)
| Section | Minimum deliverables |
|---|---|
| Store Profile | Name, URL, description, contacts, categories |
| Business Information | Entity type, legal and registered addresses, beneficial ownership change review |
| Shipping Settings | Multiple warehouses, supported destinations, zones, rates, carriers, handling time |
| Payments & Payouts | Hosted Connect onboarding, country, provider, currencies, payout status |
| Tax Settings | Tax IDs, registration status, region-specific validation, tax responsibility |
| Returns & Refunds | Return addresses, windows, policies, review controls |
| Store Policies | Published seller policy and seller-authored policy text with version history |
| Store Appearance & Branding | Logo, banner, storefront appearance and preview |
| Notifications | Event-level email/in-app preferences |
| Team & Staff | Scoped invitations, permissions, revocation, audit log |
| Security & Account | Sessions, MFA where supported, security events, sensitive change re-verification |
| Account Health & Compliance | KYC/KYB, provider restrictions, violations, remediation and appeals |

**Current gap:** VendorSettings is a single editable profile/shipping-origin form; the other sections require schemas, permission checks, APIs, tests and UI. A tab without persistence is not considered complete.

## 3. Payout providers and country eligibility
Maintain a reviewed server-side country/provider capability registry with effective date, entity types, onboarding mode, payout currencies, verification requirements, payout support and reason for restriction. Confirm provider support from official provider documentation and the actual BARAKAZ platform account before activating each country. Stripe Connect support varies by platform account country and cross-border program; never infer support from a global Stripe country list.

Collect banking details only via provider-hosted onboarding or tokenized provider components. For display and validation guidance only: CA transit/institution/account; US routing/account; GB sort code/account; IBAN/BIC where applicable; CN/KR and others provider-specific. **Do not persist full account numbers, routing, sort code, IBAN, identity-document secrets or banking credentials in BARAKAZ application tables.** Persist provider account reference, status, supported currencies and safe masked metadata only.

## 4. Earnings and commission
Seller dashboard must reconcile provider-confirmed ledger entries, not compute withdrawable balance solely from gross paid order items. Display gross earnings, available/pending/held balances, commission, fees, refunds/chargebacks, transaction history, payout history/status and downloadable dated statements. Payout settlement statuses change only on verified provider events. Define consistent CAD ledger/base currency and transaction FX snapshots for non-CAD display/payout.

**Current gap:** VendorEarnings includes legacy manual bank-transfer fields and browser withdrawal requests; reconcile and replace with provider-hosted, verified payout flows before global activation.

## 5. Admin
Admin review of entity verification and documents; country/provider eligibility; commission schedules; refund approvals with verified Stripe/provider execution; payout reconciliation; disputes; holds; provider health; tax/shipping settings; auditable financial exports. Use server-side RBAC/RLS and audit logs; no browser-side direct privileged payout completion.

## 6. Shipping, customer currencies and international orders
Multiple seller warehouse/return addresses, international shipping zones and verified carrier coverage; destination-specific restrictions, customs HS/origin data, duties and incoterms; carrier labels/tracking; accurate tax quote; server-computed amount/currency matching payment provider. Distinguish display currency, checkout charge currency and seller settlement currency; disclose FX conversion. Enable only verified lanes after E2E test.

**Current gap:** create-order currently blocks destinations other than CA; international shipping roadmap explicitly describes a fail-closed gate. Do not remove the gate without verified landed-cost, tax and shipping integrations.

## Delivery sequence and acceptance gates
1. Security: eliminate raw bank-account collection/storage in legacy earnings withdrawal workflow; migrate safely and confirm RLS.
2. Server-side country/provider eligibility model + reviewed country requirements, without enabling unsupported sellers.
3. Seven-step country/entity-specific form, save/resume and KYC/KYB verification.
4. Twelve persistent settings modules with authorization, field validation and change audit.
5. Verified Connect/provider payouts, ledger reconciliation and statements.
6. Admin financial/compliance operations and export.
7. International shipping/tax/FX/order creation per verified lane.
8. Staging integration tests for CA, US, GB, EEA, CN, KR and selected African markets; security/privacy review; production rollout with monitoring and rollback.

## Repository evidence / known blockers
- `src/pages/SellerOnboardingV2Page.tsx`, `src/lib/sellerOnboarding.ts`, `src/pages/VendorRegisterPage.tsx`
- `src/pages/vendor/VendorSettings.tsx`, `VendorPayments.tsx`, `VendorEarnings.tsx`
- `src/pages/admin/AdminSellerApplications.tsx`, `AdminWithdrawals.tsx`, `AdminReturns.tsx`
- `supabase/functions/seller-stripe-connect/index.ts`, `seller-stripe-webhook/index.ts`, `create-order/index.ts`
- `docs/INTERNATIONAL_SHIPPING_ROADMAP.md`, `docs/SELLER_ONBOARDING_GLOBAL_SPEC.md`
- Unmerged checkout/payout-security PRs #68 and #69 at the time this plan was written.
- Duplicate numbered `drizzle/migrations/0021_*` and `0023_*` require migration history reconciliation before applying further SQL.

## Definition of done
A feature is complete only when UI, validated server-side persistence, authorization, audit logging, negative-path tests, production-safe migrations, deployment checks and user acceptance all pass. Presence of a page, draft SQL or green frontend build alone is not completion.
