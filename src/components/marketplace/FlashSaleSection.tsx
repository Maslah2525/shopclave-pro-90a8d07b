import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "./ProductCard";
import { useProductRatings } from "@/hooks/useProductRatings";
import { Zap } from "lucide-react";
import CountdownTimer from "@/components/shared/CountdownTimer";
import barakazIcon from "@/assets/barakaz-icon.webp";

const FlashSaleSection = ({ hideHeading = false }: { hideHeading?: boolean }) => {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["flash-sale-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, vendors(store_name, status), product_images(url, position)")
        .eq("status", "active")
        .gt("deal_ends_at", new Date().toISOString())
        .order("deal_ends_at", { ascending: true })
        .limit(10);
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: ratingsMap = {} } = useProductRatings(products.map((p: any) => p.id));

  if (!isLoading && products.length === 0) return null;

  const soonestEnd = products[0]?.deal_ends_at as string | undefined;

  return (
    <section className="container py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {!hideHeading && <Zap className="h-5 w-5 text-primary fill-primary" />}
          {!hideHeading && <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">Flash Sale</h2>}
        </div>
        {soonestEnd && <CountdownTimer endsAt={soonestEnd} variant="badge" />}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              price={Number(p.price)}
              compareAtPrice={p.compare_at_price ? Number(p.compare_at_price) : null}
              image={p.product_images?.slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || barakazIcon}
              vendorId={p.vendor_id}
              vendorName={p.vendors?.store_name || "Unknown Seller"}
              slug={p.slug}
              rating={ratingsMap[p.id]?.avg ?? 0}
              reviewCount={ratingsMap[p.id]?.count ?? 0}
              soldCount={ratingsMap[p.id]?.sold ?? 0}
              dealEndsAt={p.deal_ends_at}
              stock={p.stock}
              handlingTimeDays={p.handling_time_days}
              verifiedSeller={p.vendors?.status === "approved"}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default FlashSaleSection;
