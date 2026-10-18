// Order email dispatch. Fail-closed rules:
// - "received": order placed, payment NOT yet verified. Customer only; never says
//   "confirmed"/"paid"; sellers are not notified for online (card) payments.
// - "paid": only call after a provider-verified, signed webhook marked the order paid.
// Idempotency keys are stable so webhook replays never duplicate emails.
// deno-lint-ignore-file no-explicit-any
import { getInvoiceCadRates, invoiceCurrencyForCountry, invoiceCurrencyPresentation } from "./invoice-currency.ts";

type Admin = any;

const PAYMENT_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  card: "Card (online)",
  cod: "Pay on Delivery",
  vendor_payment: "Pay Vendor Directly",
};

export const ONLINE_METHODS = new Set(["card"]);

export async function sendOrderEmails(
  admin: Admin,
  orderId: string,
  stage: "received" | "paid",
  opts: { notifyVendors?: boolean } = {},
): Promise<void> {
  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,created_at,currency,total,shipping_total,tax_amount,tax_province,tax_breakdown,payment_method,payment_status,payment_provider,charged_amount,charged_currency,shipping_address")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  if (stage === "paid" && order.payment_status !== "paid") {
    console.warn(`[order ${orderId}] refusing paid email: payment_status=${order.payment_status}`);
    return;
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id,vendor_id,product_id,quantity,price,variant_options")
    .eq("order_id", orderId);
  if (!items?.length) return;
  const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))];
  const { data: products } = await admin.from("products").select("id,name").in("id", productIds);
  const nameOf = new Map((products || []).map((p: any) => [p.id, p.name]));
  const toEmailItem = (oi: any) => ({
    name: nameOf.get(oi.product_id) ?? "Product",
    variantLabel: oi.variant_options && typeof oi.variant_options === "object" ? oi.variant_options.label ?? null : null,
    quantity: oi.quantity,
    unitPrice: Number(oi.price),
    lineTotal: Number(oi.price) * oi.quantity,
  });

  const currency = String(order.currency || "CAD").toUpperCase();
  const shortId = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const addr = (order.shipping_address || {}) as Record<string, any>;
  const paymentMethodLabel = PAYMENT_LABELS[order.payment_method] ?? order.payment_method ?? "—";
  const paymentStatusLabel = order.payment_status === "paid" ? "Paid" : "Awaiting payment";

  // Customer email
  let recipient: string | null = (addr.email && String(addr.email).trim()) || null;
  if (!recipient && order.user_id) {
    try {
      const { data } = await admin.auth.admin.getUserById(order.user_id);
      recipient = data?.user?.email ?? null;
    } catch (e) { console.error("user lookup failed", e); }
  }
  if (recipient) {
    const targetCurrency = invoiceCurrencyForCountry(addr.country);
    const rates = stage === "paid" && currency === "CAD" && targetCurrency && targetCurrency !== currency
      ? await getInvoiceCadRates() : null;
    const presentation = stage === "paid"
      ? invoiceCurrencyPresentation(addr.country, currency, rates)
      : { currency, rate: 1, isEquivalent: false };
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: presentation.currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    const convert = (amount: number) => Math.round(amount * presentation.rate * factor) / factor;
    const emailItems = items.map(toEmailItem).map((item: any) => {
      const unitPrice = convert(item.unitPrice);
      return { ...item, unitPrice, lineTotal: Math.round(unitPrice * item.quantity * factor) / factor };
    });
    const subtotal = emailItems.reduce((s: number, i: any) => s + i.lineTotal, 0);
    const deliveryFee = convert(Number(order.shipping_total || 0));
    const taxComponents = ((order.tax_breakdown as any)?.components || []).map((c: any) => ({
      component: c.component,
      ratePercent: Number(c.ratePpm) / 10000,
      amount: convert(Number(c.taxCents) / 100),
    }));
    const tax = taxComponents.length
      ? taxComponents.reduce((sum: number, c: any) => sum + c.amount, 0)
      : convert(Number(order.tax_amount || 0));
    // Converted figures are equivalents, never a claim that the provider charged
    // this currency. Preserve the persisted charge separately, including CAD.
    const chargedAmount = Number(order.charged_amount);
    const chargedCurrency = String(order.charged_currency || "").toUpperCase();
    const chargedNote = stage === "paid" && order.charged_amount != null &&
      Number.isFinite(chargedAmount) && chargedAmount >= 0 && /^[A-Z]{3}$/.test(chargedCurrency)
      ? { amount: chargedAmount, currency: chargedCurrency } : null;
    const { error } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "order-confirmation",
        recipientEmail: recipient,
        idempotencyKey: `order-${stage}-${order.id}`,
        templateData: {
          stage,
          currency: presentation.currency,
          isCurrencyEquivalent: presentation.isEquivalent,
          customerName: addr.fullName,
          orderShortId: shortId,
          orderDate,
          items: emailItems,
          subtotal,
          deliveryFee,
          tax,
          taxProvince: order.tax_province ?? null,
          taxComponents,
          total: Math.round((subtotal + deliveryFee + tax) * factor) / factor,
          shippingAddress: addr,
          paymentMethodLabel,
          paymentStatusLabel,
          chargedNote,
          trackUrl: `https://barakaz.com/orders/${order.id}/tracking`,
        },
      },
    });
    if (error) console.error(`[order ${orderId}] ${stage} customer email failed`, error);
    else console.log(`[order ${orderId}] ${stage} customer email enqueued`);
  }

  // Seller emails: only after verified payment, or for offline methods at placement.
  if (!opts.notifyVendors) return;
  const vendorIds = [...new Set(items.map((i: any) => i.vendor_id).filter(Boolean))];
  const { data: vendors } = await admin.from("vendors").select("id,store_name,user_id").in("id", vendorIds);
  for (const v of vendors || []) {
    if (!v.user_id) continue;
    let email: string | null = null;
    let fullName: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(v.user_id);
      email = data?.user?.email ?? null;
      fullName = data?.user?.user_metadata?.full_name ?? null;
    } catch (e) { console.error("vendor lookup failed", e); }
    if (!email) continue;
    const vItems = items.filter((i: any) => i.vendor_id === v.id).map(toEmailItem);
    const { error } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "vendor-new-order",
        recipientEmail: email,
        idempotencyKey: `vendor-new-order-${order.id}-${v.id}`,
        templateData: {
          currency,
          vendorName: fullName,
          storeName: v.store_name,
          orderShortId: shortId,
          orderDate,
          items: vItems,
          vendorSubtotal: vItems.reduce((s: number, i: any) => s + i.lineTotal, 0),
          buyerName: addr.fullName,
          shippingAddress: addr,
          paymentMethodLabel,
          paymentStatusLabel,
          manageUrl: "https://barakaz.com/vendor/orders",
        },
      },
    });
    if (error) console.error(`[order ${orderId}] vendor email failed`, error);
  }
}
