import { describe, expect, it, vi, afterEach } from "vitest";
import { invoiceCurrencyForCountry, invoiceCurrencyPresentation } from "../../supabase/functions/_shared/invoice-currency";
import { sendOrderEmails } from "../../supabase/functions/_shared/order-emails";

afterEach(() => vi.unstubAllGlobals());

describe("customer invoice country currencies", () => {
  it("Canada uses CAD without exchange rates", () => {
    expect(invoiceCurrencyPresentation("Canada", "CAD", null)).toEqual({ currency: "CAD", rate: 1, isEquivalent: false });
    expect(invoiceCurrencyForCountry("CA")).toBe("CAD");
  });
  it.each([["United States", "USD"], ["Kenya", "KES"], ["United Kingdom", "GBP"], ["France", "EUR"], ["Nigeria", "NGN"], ["Japan", "JPY"]])(
    "%s uses %s", (country, currency) => expect(invoiceCurrencyForCountry(country)).toBe(currency),
  );
  it("never relabels amounts if rates are missing or invalid", () => {
    for (const rates of [null, {}, { USD: -1 }, { USD: NaN }]) {
      expect(invoiceCurrencyPresentation("US", "CAD", rates).currency).toBe("CAD");
    }
  });
});

async function dispatch(country: string, stage: "paid" | "received" = "paid", paymentStatus = "paid") {
  const invoke = vi.fn(async () => ({ error: null }));
  const rows: Record<string, unknown> = {
    orders: { id: "order-12345678", created_at: "2026-10-18", currency: "CAD", total: 115,
      shipping_total: 10, tax_amount: 5, payment_status: paymentStatus, payment_method: "card",
      charged_amount: 115, charged_currency: "CAD", shipping_address: { country, email: "customer@example.com" } },
    order_items: [{ product_id: "p1", quantity: 2, price: 50 }],
    products: [{ id: "p1", name: "Product" }],
  };
  const admin = {
    from: (table: string) => {
      const result = { data: rows[table] };
      return { select: () => ({ eq: () => ({ maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }), in: async () => result }) };
    },
    functions: { invoke },
  };
  await sendOrderEmails(admin, "order-12345678", stage);
  return invoke;
}

describe("paid customer email invoice dispatch", () => {
  it("Canadian invoice retains CAD line items, tax, delivery and actual charge", async () => {
    const invoke = await dispatch("Canada");
    expect(invoke.mock.calls[0][1].body.templateData).toMatchObject({ currency: "CAD", subtotal: 100, deliveryFee: 10, tax: 5, total: 115, chargedNote: { currency: "CAD", amount: 115 } });
  });
  it("US invoice converts all amounts consistently without changing actual CAD charge", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rates: { USD: 0.75 } }) })));
    const invoke = await dispatch("United States");
    expect(invoke.mock.calls[0][1].body.templateData).toMatchObject({ currency: "USD", isCurrencyEquivalent: true,
      items: [{ unitPrice: 37.5, quantity: 2, lineTotal: 75 }], subtotal: 75, deliveryFee: 7.5, tax: 3.75, total: 86.25,
      chargedNote: { currency: "CAD", amount: 115 } });
  });
  it("unpaid orders cannot send a paid invoice", async () => {
    expect(await dispatch("Canada", "paid", "pending")).not.toHaveBeenCalled();
  });
});