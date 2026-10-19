# Dynamic banner database preparation — completion report

Applied: 19 October 2026. Database-only scope; no homepage, React components, routes or frontend design changed. No publishing or function deployment performed.

## Migration reference

`drizzle/migrations/0036_extend_dynamic_banner_system.sql` was applied successfully to the existing Lovable Cloud database. Generated database types refreshed automatically. No new database or application tables were created; no original columns were removed or renamed.

## Exact schema changes

These nine columns were added to **hero_banners**:

| Column | Type | Default |
|---|---|---|
| banner_mode | text | image |
| animation_type | text | fade |
| transition_duration_ms | integer | 700 |
| rotation_interval_ms | integer | 5000 |
| background_color | text | NULL |
| background_gradient | text | NULL |
| animation_config | jsonb | {} |
| vendor_id | uuid | NULL |
| target_device | text | all |

**promotions** received the same nine columns plus nullable text columns `desktop_image_url`, `mobile_image_url` and `cta_label` (12 columns total). The original required `image_url` remains unchanged, as do all other legacy columns and defaults.

Both `vendor_id` columns reference the inspected UUID primary key `public.vendors(id)` with `ON DELETE SET NULL`. Deleting a vendor does not delete its banners.

The existing `promotions_placement_check` was replaced with a widened check allowing:

- featured_brands — retained
- sponsored_products — retained
- featured_products_banner
- sponsored_products_banner
- category_promotion
- flash_sale_banner
- homepage_full_width
- homepage_secondary

### Validation

Each table now has seven checks for mode, animation, durations, device, configuration, URLs and backgrounds, plus its vendor foreign key. The promotion placement check is validated too.

- Modes: `image`, `dynamic`.
- Animations: `none`, `fade`, `slide`, `zoom`, `float`.
- Devices: `all`, `desktop`, `mobile`.
- Chosen duration limits: transition **0–10,000ms**; rotation **1,000–300,000ms**, at least as long as the transition. These are implementation bounds, not user-specified values.
- Configuration: non-null JSON object, maximum **16KiB** and nesting depth **8**. Nested URL/src/href keys must contain a safe URL; script schemes, markup and prototype-pollution keys are rejected.
- URLs: HTTPS external destinations or single-slash local paths, up to 2,048 characters. Protocol-relative URLs, credentials in URLs, unsafe schemes, control characters, whitespace, backslashes and encoded line breaks are rejected. HTTP-only external URLs are intentionally not accepted.
- Backgrounds: hexadecimal colors and bounded linear/radial/conic gradient strings; URL/expression/script constructs are rejected.
- Added immutable, invoker-rights helpers `banner_url_is_safe(text)` and `banner_json_is_safe(jsonb, integer)`, with execution granted to API roles and no privileged credential exposure.

The future renderer must still escape text and allowlist supported configuration fields; database validation is not an HTML rendering sanitizer. Existing required image fields were deliberately retained, so a future dynamic-banner editor must continue providing legacy required image values unless a separate compatible change is authorized.

## Security and storage

- RLS remains enabled on both tables.
- All **10 existing banner/promotion RLS policies** were preserved unchanged.
- Public reads require active status, start at/before now (or no start), and end strictly after now (or no end).
- Existing writes continue using `has_permission(auth.uid(), 'marketing.manage')` for insert/update/delete. Update retains both USING and WITH CHECK.
- Permission functions and `marketing.manage` were not modified. Super admins without a team assignment retain their existing access; scoped admins need marketing.manage or `*`, exactly as before.
- Removed unnecessary anonymous mutation/table-maintenance grants; anonymous SELECT remains. Authenticated CRUD and service-role access remain.
- Existing `marketing-assets` bucket remains public; its upload/update/delete policies still use `can_manage_marketing(auth.uid())`. All storage policies are unchanged.

## Verification results

| Check | Result |
|---|---|
| Original promotion records | **PASS:** all 15 retained; hash of all original column values remains `1c8869ad6475e4c4db1a404dd2ac123a` |
| Original hero records | **PASS:** table was empty before and remains empty (0 records) |
| Banner and storage policies | **PASS:** combined policy hash unchanged: `4f9e566b9c762b8f62ac51567188eda5` |
| Existing storage objects | **PASS:** marketing-assets retains all 22 objects |
| New columns/defaults/FKs/placements | **PASS:** live schema inspected; checks and foreign keys validated |
| Anonymous live banner reads | **PASS:** existing API queries return 0 heroes and 10 currently eligible promotions, no query errors; every returned promotion meets schedule rules |
| Existing image delivery | **PASS:** all 10 image URLs returned to the public downloaded successfully |
| Existing homepage compatibility | **PASS:** public homepage renders existing static hero fallback; legacy queries succeed, no browser runtime errors |
| Admin create/edit/delete | **PASS in isolated PostgreSQL:** super-admin and marketing.manage accounts can perform all three operations |
| Unauthorized create/edit/delete | **PASS in isolated PostgreSQL:** anonymous, customer and scoped admin without marketing permission denied; anonymous live table write grants are absent |
| Public scheduled filtering | **PASS in isolated PostgreSQL:** inactive, future and expired records hidden on both tables |
| Validation/defaults/legacy placements | **PASS:** 30 migration behavior tests executed against disposable PostgreSQL |
| Current preview diagnostics | **PASS:** latest inspected build entry reports build OK |
| Real authenticated admin writes/uploads | **NOT VERIFIED:** requires an authorized marketing session; no real accounts impersonated and no production test records or files created |

Tests are retained in `src/test/dynamicBannerDatabase.test.ts`; run with `bunx vitest run --config vitest.database.config.ts`. They apply the actual migration to disposable PostgreSQL and exercise inspected permission/policy behavior. These are not claims of production authenticated testing.

## Errors and limitations

The migration completed without errors. One inspection query needed an aggregate ordering correction; the read-only role cannot execute the new validation helpers, so validation execution was tested through isolated PostgreSQL rather than expanding that role's privileges. Initial test runs used the browser test environment; a dedicated database test configuration resolved this and all 30 tests passed.

Existing storage **reads**, objects and policies are verified; a fresh authenticated **upload** is not verified. Existing hero data cannot be tested because the table contains no rows; its current fallback is verified instead. New placements and dynamic animation are database-ready only: the unchanged frontend does not yet render or manage them. Its current editor recognizes only the original placements, so do not add new-placement production records until the separate GitHub frontend implementation is ready.