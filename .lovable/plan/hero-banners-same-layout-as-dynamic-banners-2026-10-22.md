# Hero Banners: same layout as Dynamic Banners

Rebuild the Marketing → Hero Banners tab to match the screenshot, reusing the layout already built for Dynamic Banners.

## What you will see
- Numbered step bar: Banner Details, Images, Link & Targeting, Animation & Style, Scheduling, Preview.
- Left column editor:
  1. Banner Details — name, placement fixed to "Homepage Hero Banner", Active switch, headline, subtitle, CTA label.
  2. Images — desktop (1920x600) and mobile (750x500) upload cards with Change / Remove.
  3. Link & Targeting — Product / Category / Store / Brand / Custom URL cards with search pickers, target device.
  4. Animation & Style — animation type, transition speed, rotation time, background colour.
  5. Scheduling — start/end date with "Banner will be active from … to …" note.
- Right column: 6. Live Preview with Desktop / Mobile toggle and phone mockup.
- 7. Existing Banners table: thumbnail, name, status (Active / Scheduled / Inactive), schedule, up/down order, Edit, Duplicate, Delete, plus "Add New Banner".

## Notes
- Uses the hero banner fields already in the database; no database changes, existing hero banners untouched.
- Checkboxes in the screenshot (pause on hover, arrows, dots, swipe) are saved in the banner's animation settings; the homepage carousel keeps its current behaviour for now unless you want those wired up too.
- The extra sidebar items (Coupon Management, Email Campaigns, Ads Management) are not part of this change.

## Technical details
- New `src/components/admin/HeroBannerAdmin.tsx`, modelled on `DynamicBannerAdmin.tsx` (reuse step bar, link-type cards, CategoryLinkPicker, image cards, preview), writing to `hero_banners` (image_url, mobile_image_url, link_url, title/subtitle/cta, banner_mode, animation_type, durations, background_color, target_device, starts_at/ends_at, display_order, is_active).
- Replace `<BannersTab />` in `AdminMarketing.tsx` with `<HeroBannerAdmin />`; keep the old upload/reorder logic semantics (display_order swap, active toggle, delete).
- Payload: optional fields null, never empty strings, to satisfy existing checks.
- Verify in preview as admin: create, edit, reorder, delete a banner and confirm it shows on the homepage carousel.
