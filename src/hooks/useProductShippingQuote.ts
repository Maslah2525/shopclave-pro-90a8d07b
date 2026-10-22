import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildDeliveryOptions, type DeliveryOptions } from "@/lib/shippingOptions";

type SavedAddress = { full_name: string; phone: string | null; address_line: string; city: string; country: string; state: string | null; postal_code: string | null };

/** Live carrier quote for one product to the shopper's saved default address. */
export function useProductShippingQuote(userId: string | undefined, productId: string | undefined, variantId: string | null, qty: number, handlingDays: number) {
  const addressQ = useQuery({
    queryKey: ["user-address", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("addresses").select("*").eq("user_id", userId!).eq("is_default", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as SavedAddress | null;
    },
  });
  const a = addressQ.data;
  const complete = !!a && !!a.full_name && !!a.phone && !!a.address_line && !!a.city && !!a.country;
  const ratesQ = useQuery({
    queryKey: ["product-shipping-quote", productId, variantId, qty, a?.address_line, a?.city, a?.postal_code, a?.country],
    enabled: !!userId && !!productId && complete,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<DeliveryOptions> => {
      const { data, error } = await supabase.functions.invoke("get-shipping-rates", {
        body: {
          items: [{ product_id: productId, quantity: Math.max(1, qty), variant_id: variantId }],
          shipping_address: { fullName: a!.full_name, phone: a!.phone, addressLine: a!.address_line, city: a!.city, state: a!.state ?? "", zip: a!.postal_code ?? "", country: a!.country },
        },
      });
      if (error) throw error;
      const rates = (data?.vendors || []).flatMap((v: any) => (v.blocked ? [] : v.rates || []));
      return buildDeliveryOptions(rates, handlingDays);
    },
  });
  const status: "signed_out" | "no_address" | "loading" | "error" | "ready" =
    !userId ? "signed_out" : addressQ.isLoading ? "loading" : !complete ? "no_address"
      : ratesQ.isLoading ? "loading" : ratesQ.isError ? "error" : "ready";
  return { status, options: ratesQ.data, address: a };
}
