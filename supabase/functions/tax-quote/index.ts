// Server-authoritative Canadian sales-tax preview for the checkout review step.
// Read-only: computes tax from server-held prices and server-issued shipping
// quotes. Never trusts client prices. Fails closed with a clear reason.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { calculateTax, type TaxCategory } from "../_shared/tax.ts";
import { loadTaxConfig, taxErrorMessage } from "../_shared/taxConfig.ts";
import { addressFingerprint, itemsFingerprint, validateQuotes } from "../_shared/shipping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });

const Body = z.object({
  shipping_address: z.object({
    addressLine: z.string().min(1), city: z.string().min(1), state: z.string().min(2),
    zip: z.string(), country: z.string().min(2),
  }),
  province: z.string().min(2).max(100),
  country: z.string().min(2).max(100),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    variant_id: z.string().uuid().nullable().optional(),
  })).min(1).max(50),
  shipping_quote_ids: z.array(z.string().uuid()).max(50).optional().default([]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { province, country, items, shipping_quote_ids, shipping_address } = parsed.data;
    if (province.trim().toLowerCase() !== shipping_address.state.trim().toLowerCase() ||
        country.trim().toLowerCase() !== shipping_address.country.trim().toLowerCase())
      return json({ ok: false, error: "Delivery address does not match tax destination" }, 422);
    if (new Set(shipping_quote_ids).size !== shipping_quote_ids.length)
      return json({ ok: false, error: "Duplicate shipping selection" }, 422);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: products } = await admin.from("products")
      .select("id, price, tax_category, vendor_id, is_physical").in("id", items.map((i) => i.product_id));
    const productMap = new Map((products || []).map((p) => [p.id, p]));

    const variantIds = items.filter((i) => i.variant_id).map((i) => i.variant_id!);
    const variantMap = new Map<string, { price: number | null }>();
    if (variantIds.length) {
      const { data: variants } = await admin.from("product_variants").select("id, price").in("id", variantIds);
      for (const v of variants || []) variantMap.set(v.id, v);
    }

    const requiredVendorIds = [...new Set(items.filter(i => productMap.get(i.product_id)?.is_physical !== false).map(i => productMap.get(i.product_id)?.vendor_id).filter(Boolean))] as string[];
    const lines = items.map((i) => {
      const p = productMap.get(i.product_id);
      if (!p) return null;
      const variant = i.variant_id ? variantMap.get(i.variant_id) : null;
      const unit = variant?.price != null ? Number(variant.price) : Number(p.price);
      return {
        id: `${i.product_id}:${i.variant_id ?? ""}`,
        amountCents: Math.round(unit * i.quantity * 100),
        category: (p.tax_category ?? "unknown") as TaxCategory,
      };
    });
    if (lines.some((l) => l === null)) return json({ ok: false, error: "Product not found" }, 400);

    let shippingCents = 0;
    if (requiredVendorIds.length > 0 && shipping_quote_ids.length === 0)
      return json({ ok: false, error: "Select shipping for every seller" }, 422);
    if (shipping_quote_ids.length > 0) {
      const { data: quotes, error: quoteError } = await admin.from("shipping_quotes")
        .select("*").in("id", shipping_quote_ids);
      if (quoteError || !quotes || quotes.length !== shipping_quote_ids.length)
        return json({ ok: false, error: "Shipping quote missing or unavailable" }, 422);
      const checked = validateQuotes(quotes, {
        userId: user.id, requiredVendorIds,
        addressFingerprint: addressFingerprint(shipping_address),
        itemsFingerprint: itemsFingerprint(items),
      });
      if (!checked.ok || quotes.length !== requiredVendorIds.length)
        return json({ ok: false, error: "Shipping selection is invalid or expired. Please reselect delivery." }, 422);
      if (!Number.isFinite(checked.totalCad) || checked.totalCad < 0)
        return json({ ok: false, error: "Invalid shipping amount" }, 422);
      shippingCents = Math.round(checked.totalCad * 100);
    }

    const cfg = await loadTaxConfig(admin);
    const result = calculateTax({
      province, country,
      date: new Date().toISOString().slice(0, 10),
      lines: lines as any,
      shippingCents,
    }, cfg);

    if (!result.ok) return json({ ok: false, reason: result.reason, message: taxErrorMessage(result.reason) }, 200);

    return json({
      ok: true,
      province: result.province,
      total_tax_cad: result.totalTaxCents / 100,
      components: result.components.map((c) => ({
        component: c.component,
        rate_percent: c.ratePpm / 10000,
        tax_cad: c.taxCents / 100,
      })),
    });
  } catch (err) {
    console.error("tax-quote", err);
    return json({ error: "Internal server error" }, 500);
  }
});
