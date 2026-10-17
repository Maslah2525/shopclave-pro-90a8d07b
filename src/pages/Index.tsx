import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import SEO from "@/components/seo/SEO";
import HeroBanner from "@/components/marketplace/HeroBanner";
import PromoStrip from "@/components/marketplace/PromoStrip";
import NewArrivalsCategories from "@/components/marketplace/NewArrivalsCategories";
import FlashSaleSection from "@/components/marketplace/FlashSaleSection";
import BestDealsSection from "@/components/marketplace/BestDealsSection";
import CategoryCard from "@/components/marketplace/CategoryCard";
import ProductCard from "@/components/marketplace/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";
import barakazIcon from "@/assets/barakaz-icon.webp";
import { useProductRatings } from "@/hooks/useProductRatings";
import { readBarakaz } from "@/lib/barakazBridge";

const DEFAULT_CATEGORIES = [
  { name: "Electronics", slug: "electronics", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&q=80" },
  { name: "Fashion", slug: "fashion", image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=80" },
  { name: "Home & Garden", slug: "home-garden", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=80" },
  { name: "Health & Beauty", slug: "health-beauty", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&q=80" },
  { name: "Sports", slug: "sports", image: "https://images.unsplash.com/photo-1461896836934-ber39834eb0b?w=200&q=80" },
  { name: "Phones", slug: "phones-tablets", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&q=80" },
];

const DEMO_PRODUCTS = Array.from({ length: 8 }).map((_, i) => ({
  id: `demo-${i}`,
  name: ["Wireless Headphones", "Smart Watch Pro", "Running Shoes", "Organic Face Cream", "LED Desk Lamp", "Cotton T-Shirt", "Bluetooth Speaker", "Yoga Mat"][i],
  price: [2499, 8999, 3499, 1299, 1899, 799, 4299, 1599][i],
  compareAtPrice: [3999, 12999, null, 1999, null, 1299, 5999, null][i] as number | null,
  image: [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
    "https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=400&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80",
    "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80",
    "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&q=80",
  ][i],
  vendorId: `vendor-${i % 3}`,
  vendorName: ["TechHub Store", "Fashion Point", "Home Essentials"][i % 3],
  slug: ["wireless-headphones", "smart-watch-pro", "running-shoes", "organic-face-cream", "led-desk-lamp", "cotton-tshirt", "bluetooth-speaker", "yoga-mat"][i],
  rating: 0,
  reviewCount: 0,
  soldCount: 0,
}));

const Index = () => {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(10);
  const isMobile = useIsMobile();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => c + 10);
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, visibleCount]);


  const { data: featuredData, isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      // Featured products marked by admin
      let featuredQ = await supabase
        .from("products")
        .select("*, vendors(store_name, status), product_images(url, position)")
        .eq("status", "active")
        .eq("featured", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!featuredQ.data?.length) {
        try {
          const remote = await readBarakaz<any>("products", [
            { column: "status", op: "eq", value: "active" },
            { column: "featured", op: "eq", value: true },
          ]);
          featuredQ = { ...featuredQ, data: remote.slice(0, 60), error: null } as any;
        } catch (e) { console.warn("Barakaz catalogue fallback unavailable", e); }
      }

      // Determine if any active products exist at all (for first-run demo logic)
      const anyActiveQ = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      return {
        featured: featuredQ.data || [],
        anyActiveCount: anyActiveQ.count || 0,
      };
    },
  });

  const products = featuredData?.featured || [];
  const isFirstRunDemo = (featuredData?.anyActiveCount || 0) === 0;

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .is("parent_id", null)
        .order("name");
      if (data?.length) return data;
      try { return await readBarakaz<any>("categories"); } catch { return data; }
    },
  });

  const displayCategories = categories?.length ? categories.map((c: any) => ({
    name: c.name,
    slug: c.slug,
    image: c.image_url || barakazIcon,
  })) : DEFAULT_CATEGORIES;

  const { data: ratingsMap = {} } = useProductRatings(products.map((p: any) => p.id));

  const displayProducts = products.length
    ? products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
        image: p.product_images?.slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || barakazIcon,
        vendorId: p.vendor_id,
        vendorName: p.vendors?.store_name || "Unknown Seller",
        slug: p.slug,
        rating: ratingsMap[p.id]?.avg ?? 0,
        reviewCount: ratingsMap[p.id]?.count ?? 0,
        soldCount: ratingsMap[p.id]?.sold ?? 0,
        dealEndsAt: p.deal_ends_at || null,
        stock: p.stock,
        handlingTimeDays: p.handling_time_days,
        verifiedSeller: p.vendors?.status === "approved",
      }))
    : isFirstRunDemo
      ? DEMO_PRODUCTS
      : [];

  const showFeaturedSection = isLoading || displayProducts.length > 0;

  return (
    <MarketplaceLayout>
      <SEO
        title="Barakaz | Shop Beyond Borders with Barakaz"
        description="Global Fashion & Lifestyle Marketplace. Shop electronics, fashion, home & beauty from thousands of verified vendors worldwide."
        canonicalPath="/"
      />
      <HeroBanner />
      <NewArrivalsCategories />
      <PromoStrip />
      <FlashSaleSection />
      <BestDealsSection />

      {/* Featured Products */}
      {showFeaturedSection && (
        <section className="container py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">{t("home.featured")}</h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {displayProducts.slice(0, visibleCount).map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
              <div className="mt-6 flex items-center justify-center gap-2">
                {!isFirstRunDemo && displayProducts.length > visibleCount && (
                  isMobile ? (
                    <div ref={sentinelRef} className="h-10 w-4" aria-hidden />
                  ) : (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setVisibleCount((c) => c + 10)}
                      className="text-primary border-primary/30 hover:bg-primary/5"
                    >
                      {t("home.loadMore")}
                    </Button>
                  )
                )}
                <Button asChild variant="ghost" size="lg" className="gap-1 text-primary">
                  <Link to="/search">
                    {t("home.viewAll")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Sell banner */}
      <section className="container py-8">
        <div className="bg-[hsl(var(--nav-dark))] rounded-2xl p-8 md:p-12 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
            {t("home.startSelling")}
          </h2>
          <p className="text-primary-foreground/70 text-sm md:text-base mb-6 max-w-lg mx-auto">
            {t("home.sellDesc")}
          </p>
          <Link to="/vendor/register">
            <Button size="lg" className="font-semibold bg-[hsl(var(--marketplace-orange))] hover:bg-[hsl(var(--marketplace-orange-hover))] text-primary-foreground">
              {t("home.becomeSeller")}
            </Button>
          </Link>
        </div>
      </section>
    </MarketplaceLayout>
  );
};

export default Index;
