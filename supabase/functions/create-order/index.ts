import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { sendOrderEmails, ONLINE_METHODS } from "../_shared/order-emails.ts";
import {
  addressFingerprint,
  itemsFingerprint,
  validateQuotes,
  round2,
} from "../_shared/shipping.ts";
import { calculateTax, type TaxCategory } from "../_shared/tax.ts";
import { loadTaxConfig, taxErrorMessage, TAX_ENGINE_VERSION } from "../_shared/taxConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  variant_id: z.string().uuid().nullable().optional(),
  variant_label: z.string().max(255).nullable().optional(),
});

// The client may only reference server-issued quotes — never prices.

const OrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(50),
  shipping_address: z.object({
    fullName: z.string().min(1).max(255),
    phone: z.string().min(1).max(50),
    addressLine: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    state: z.string().max(100).optional().or(z.literal("")),
    zip: z.string().max(20).optional().or(z.literal("")),
    country: z.string().min(1).max(100),
    email: z.string().email().max(255).optional().or(z.literal("")),
  }),
  payment_method: z.enum(["mpesa", "card", "cod", "vendor_payment"]),
  shipping_quote_ids: z.array(z.string().uuid()).max(50).optional().default([]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const body = await req.json();
    const parsed = OrderSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { items, shipping_address, payment_method, shipping_quote_ids } = parsed.data;

    // International checkout remains disabled until the separate, atomic
    // international order and quote-consumption path has passed review.
    if (!["CA", "CANADA"].includes(shipping_address.country.trim().toUpperCase())) {
      return new Response(JSON.stringify({
        error: "International checkout is not yet enabled. No payment has been initiated.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }



    // Use service role client for trusted operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch product prices server-side
    const productIds = items.map((i) => i.product_id);
    const { data: products, error: prodError } = await adminClient
      .from("products")
      .select("id, price, vendor_id, stock, status, name, is_physical, tax_category")
      .in("id", productIds);

    if (prodError || !products) {
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Fetch variant prices if needed
    const variantIds = items.filter((i) => i.variant_id).map((i) => i.variant_id!);
    let variantMap = new Map<string, { product_id: string; price: number | null; stock: number }>();
    if (variantIds.length > 0) {
      const { data: variants } = await adminClient
        .from("product_variants")
        .select("id, product_id, price, stock")
        .in("id", variantIds);
      if (variants) {
        variantMap = new Map(variants.map((v) => [v.id, v]));
      }
    }

    // Fetch vendor commission rates
    const vendorIds = [...new Set(products.map((p) => p.vendor_id))];
    const { data: vendors } = await adminClient
      .from("vendors")
      .select("id, commission_rate")
      .in("id", vendorIds);
    const vendorMap = new Map((vendors || []).map((v) => [v.id, v]));

    // Validate and calculate. Stock must cover the combined quantity when\n    // a product/variant appears on multiple cart lines.\n    const requestedStock = new Map<string, number>();\n    let total = 0;
    const orderItems: Array<{
      product_id: string;
      vendor_id: string;
      quantity: number;
      price: number;
      commission_amount: number;
      variant_id: string | null;
      variant_options: Record<string, string> | null;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return new Response(
          JSON.stringify({ error: `Product not found: ${item.product_id}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (product.status !== "active") {
        return new Response(
          JSON.stringify({ error: `Product not available: ${product.name}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let unitPrice = product.price;
      let availableStock = product.stock;

      if (item.variant_id) {
        const variant = variantMap.get(item.variant_id);
        if (!variant) {
          return new Response(
            JSON.stringify({ error: `Variant not found: ${item.variant_id}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (variant.product_id !== item.product_id) {\n          return new Response(JSON.stringify({ error: "Selected variant does not belong to this product." }), {\n            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },\n          });\n        }\n        if (variant.price !== null) unitPrice = variant.price;
        availableStock = variant.stock;
      }

      const stockKey = item.variant_id ? `variant:${item.variant_id}` : `product:${item.product_id}`;\n      const combinedQuantity = (requestedStock.get(stockKey) ?? 0) + item.quantity;\n      requestedStock.set(stockKey, combinedQuantity);\n      if (combinedQuantity > availableStock) {
        return new Response(
          JSON.stringify({ error: `Insufficient stock for ${product.name}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vendor = vendorMap.get(product.vendor_id);
      const commissionRate = vendor?.commission_rate ?? 10;
      const lineTotal = unitPrice * item.quantity;
      const commissionAmount = (lineTotal * commissionRate) / 100;

      total += lineTotal;
      orderItems.push({
        product_id: item.product_id,
        vendor_id: product.vendor_id,
        quantity: item.quantity,
        price: unitPrice,
        commission_amount: commissionAmount,
        variant_id: item.variant_id || null,
        variant_options: item.variant_label ? { label: item.variant_label } : null,
      });
    }

    // ---- Shipping: validate server-issued quotes, never client prices ----
    const physicalVendorIds = [
      ...new Set(
        orderItems
          .filter((oi) => (productMap.get(oi.product_id) as any)?.is_physical !== false)
          .map((oi) => oi.vendor_id),
      ),
    ];

    let quotes: any[] = [];
    let shippingTotal = 0;

    if (physicalVendorIds.length > 0) {
      if (!shipping_quote_ids || shipping_quote_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "A shipping option must be selected before checkout." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: quoteRows, error: quoteErr } = await adminClient
        .from("shipping_quotes")
        .select("*")
        .in("id", shipping_quote_ids);

      if (quoteErr || !quoteRows || quoteRows.length !== shipping_quote_ids.length) {
        return new Response(JSON.stringify({ error: "Shipping quote not found. Please re-select delivery." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const check = validateQuotes(quoteRows as any, {
        userId: user.id,
        requiredVendorIds: physicalVendorIds,
        addressFingerprint: addressFingerprint(shipping_address),
        itemsFingerprint: itemsFingerprint(items),
      });

      if (!check.ok) {
        const messages: Record<string, string> = {
          not_owner: "This shipping quote does not belong to you.",
          expired: "Your shipping quote expired. Please re-select a delivery option.",
          already_used: "This shipping quote has already been used.",
          address_changed: "Your delivery address changed. Please re-select a delivery option.",
          items_changed: "Your cart changed. Please re-select a delivery option.",
          vendor_mismatch: "Invalid shipping selection.",
          missing_vendor: "A delivery option is missing for one of the sellers.",
          not_found: "Shipping quote not found.",
        };
        console.error(`create-order shipping rejected: ${check.reason} ${check.detail ?? ""}`);
        return new Response(JSON.stringify({ error: messages[check.reason] ?? "Invalid shipping selection." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      quotes = quoteRows;
      shippingTotal = check.totalCad;
    }

    // ---- Canadian sales tax: server-authoritative, fails closed ----
    const taxPoint = new Date().toISOString().slice(0, 10);
    const taxRequest = {
      province: shipping_address.state || "",
      country: shipping_address.country,
      date: taxPoint,
      lines: orderItems.map((oi, index) => ({
        id: String(index),
        amountCents: Math.round(oi.price * oi.quantity * 100),
        category: ((productMap.get(oi.product_id) as any)?.tax_category ?? "unknown") as TaxCategory,
      })),
      shippingCents: Math.round(shippingTotal * 100),
    };
    const taxConfig = await loadTaxConfig(adminClient);
    const taxResult = calculateTax(taxRequest, taxConfig);
    if (!taxResult.ok) {
      console.error(`create-order tax rejected: ${taxResult.reason}`);
      return new Response(JSON.stringify({ error: taxErrorMessage(taxResult.reason) }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const taxTotal = round2(taxResult.totalTaxCents / 100);

    // Insert order
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        user_id: user.id,
        total: round2(total + shippingTotal + taxTotal),
        shipping_total: shippingTotal,
        tax_amount: taxTotal,
        tax_province: taxResult.province,
        tax_breakdown: { components: taxResult.components, shipping: taxResult.shipping },
        tax_engine_version: TAX_ENGINE_VERSION,
        shipping_address,
        payment_method,
        currency: "CAD",
        status: "pending",
        payment_status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert order items. Shipping cost is recorded once per vendor (on the
    // first line) so payment totals stay correct; the shipment lifecycle lives
    // in public.shipments.
    const quoteByVendor = new Map(quotes.map((q) => [q.vendor_id, q]));
    const usedVendor = new Set<string>();
    const itemsToInsert = orderItems.map((oi, index) => {
      const lineTax = taxResult.lines[index];
      const q = quoteByVendor.get(oi.vendor_id);
      const base: any = {
        ...oi,
        order_id: order.id,
        shipping_amount: 0,
        tax_category: lineTax?.category ?? null,
        tax_amount: lineTax ? round2(lineTax.taxCents / 100) : null,
        tax_breakdown: lineTax ? { components: lineTax.components } : null,
      };
      if (q && !usedVendor.has(oi.vendor_id)) {
        base.shipping_rate_id = q.rate_id;
        base.shipping_amount = Number(q.amount_cad);
        base.carrier = q.provider ?? null;
        usedVendor.add(oi.vendor_id);
      }
      return base;
    });
    // Insert sequentially: the fee trigger reads existing order_items to allocate
    // processing fees. Multi-row inserts make that calculation order-dependent.
    // Roll back the unpaid parent order on failure so it cannot be checked out
    // with an empty or incomplete item set.
    const insertedItems: Array<{ id: string; vendor_id: string; quantity: number }> = [];
    for (const [index, item] of itemsToInsert.entries()) {
      const { data: inserted, error: itemsError } = await adminClient
        .from("order_items")
        .insert(item)
        .select("id, vendor_id, quantity")
        .single();
      if (itemsError || !inserted) {
        console.error("order item insertion failed " + JSON.stringify({
          orderId: order.id, itemIndex: index, itemCount: itemsToInsert.length,
          productId: item.product_id, variantId: item.variant_id,
          errorCode: itemsError?.code, errorMessage: itemsError?.message,
          errorDetails: itemsError?.details, errorHint: itemsError?.hint,
        }));
        const { error: cleanupError } = await adminClient
          .from("orders").delete().eq("id", order.id).eq("payment_status", "pending");
        if (cleanupError) console.error("failed order cleanup", { orderId: order.id, error: cleanupError.message });
        return new Response(JSON.stringify({ error: "Unable to save all cart items. Please retry checkout." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      insertedItems.push(inserted);
    }

    // Immutable audit snapshot of the exact tax calculation (CRA evidence).
    const { error: snapshotErr } = await adminClient.from("order_tax_snapshots").insert({
      order_id: order.id,
      tax_point: taxPoint,
      province: taxResult.province,
      request: taxRequest,
      result: taxResult,
      engine_version: TAX_ENGINE_VERSION,
    });
    if (snapshotErr) console.error(`[order ${order.id}] tax snapshot failed:`, snapshotErr);

    // One fulfilment/shipment per vendor, with its own items.
    if (quotes.length > 0) {
      const { data: shipments, error: shipErr } = await adminClient
        .from("shipments")
        .insert(
          quotes.map((q) => ({
            order_id: order.id,
            vendor_id: q.vendor_id,
            quote_id: q.id,
            status: "preparing",
            carrier: q.provider,
            service: q.service,
            rate_id: q.rate_id,
            is_estimate: q.is_estimate,
            shippo_shipment_id: (q.parcel as any)?.shippo_shipment_id ?? null,
            shipping_amount_original: q.amount_original,
            shipping_currency_original: q.currency_original,
            fx_rate_to_cad: q.fx_rate_to_cad,
            shipping_amount_cad: q.amount_cad,
          })),
        )
        .select("id, vendor_id");

      if (shipErr) {
        console.error(`[order ${order.id}] shipment creation failed:`, shipErr);
      } else if (shipments) {
        const shipmentItems = insertedItems
          .map((oi) => {
            const s = shipments.find((sh) => sh.vendor_id === oi.vendor_id);
            return s ? { shipment_id: s.id, order_item_id: oi.id, quantity: oi.quantity } : null;
          })
          .filter(Boolean) as Array<Record<string, unknown>>;
        if (shipmentItems.length > 0) {
          const { error: siErr } = await adminClient.from("shipment_items").insert(shipmentItems);
          if (siErr) console.error(`[order ${order.id}] shipment_items failed:`, siErr);
        }
        for (const s of shipments) {
          await adminClient.from("tracking_events").insert({
            shipment_id: s.id,
            status: "preparing",
            description: "Order received — vendor is preparing your parcel.",
            provider_event_key: `created-${s.id}`,
          });
        }
      }

      // Burn the quotes so they cannot be replayed on another order.
      await adminClient
        .from("shipping_quotes")
        .update({ consumed_order_id: order.id })
        .in("id", quotes.map((q) => q.id));
    }

    // Emails (best-effort). Online card payments (Stripe/Paystack): NO email
    // here — the customer and sellers are only emailed by the signed webhook
    // after verified payment ("paid" stage). Offline methods (COD, pay vendor
    // directly, M-Pesa) still get the "order received / awaiting payment" note.
    if (!ONLINE_METHODS.has(payment_method)) {
      try {
        await sendOrderEmails(adminClient, order.id, "received", {
          notifyVendors: true,
        });
      } catch (emailErr) {
        console.error("order received email failed:", emailErr);
      }
    }




    return new Response(JSON.stringify({ order_id: order.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-order error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
