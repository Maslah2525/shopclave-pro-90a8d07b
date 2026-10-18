# Architecture decisions
- Order address rendering uses the saved checkout fields, and tracking parcel contents use shipment_items links rather than seller grouping, so split parcels show their actual products and quantities.
- Seller order delivery/payment reads use an owner-scoped RPC instead of nested orders queries, because buyer-only order RLS must not expose unrelated seller lines or payment identifiers.
- Footer and seller settings share one payment-artwork catalog; country-based payout preferences remain private drafts and never enable providers.

- Seller-private JSON fields are read through the owner-scoped `get_vendor_private_fields_v2` RPC; its JSONB contract matches storage and avoids exposing private columns through public seller queries.
- Hosted payments opened from framed previews use a window created synchronously by the customer's click; delayed parent-frame navigation is blocked by browser sandboxing.
- Product purchase controls share one guarded cart/Buy Now handler across desktop and mobile; this keeps variant and stock enforcement identical at every viewport.
- Product-page delivery choices are stored only as per-seller checkout preferences; server-issued shipping quotes remain authoritative for price and availability.
- Temporary marketplace social-proof fallbacks and rating breakdowns are deterministic presentation-only values that yield to real customer activity and never write fabricated history. The reviews panel shows only the review count and star distribution — no sample or customer review cards.
- Product colour thumbnails and galleries resolve images across every variant sharing that colour, including legacy variant image fields, while purchase selection remains explicit.
- New customer-facing raster uploads are normalized through the shared WebP optimizer; evidence documents and existing uploads remain byte-preserved.
- Store settings drafts and private preferences use owner-only vendor_settings_preferences; only allowlisted storefront fields are copied to vendors.store_settings, and preferences never override payment, tax, verification, staff authorization, or shipping quotes.