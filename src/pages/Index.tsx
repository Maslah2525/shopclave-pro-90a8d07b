import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import SEO from "@/components/seo/SEO";
import HeroBanner from "@/components/marketplace/HeroBanner";
import DynamicBannerPlacement from "@/components/marketplace/DynamicBannerPlacement";
import "@/components/marketplace/dynamic-banner.css";
import PromoStrip from "@/components/marketplace/PromoStrip";
import NewArrivalsCategories from "@/components/marketplace/NewArrivalsCategories";
import BestDealsSection from "@/components/marketplace/BestDealsSection";
import CategoryCard from "@/components/marketplace/CategoryCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";
import barakazIcon from "@/assets/barakaz-icon.webp";
import { readBarakaz } from "@/lib/barakazBridge";

const DEFAULT_CATEGORIES = [
  { name: "Electronics", slug: "electronics", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&q=80" },
  { name: "Fashion", slug: "fashion", image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=80" },
  { name: "Home & Garden", slug: "home-garden", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=80" },
  { name: "Health & Beauty", slug: "health-beauty", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&q=80" },
  { name: "Sports", slug: "sports", image: "https://images.unsplash.com/photo-1461896836934-ber39834eb0b?w=200&q=80" },
  { name: "Phones", slug: "phones-tablets", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&q=80" },
];

const Index = () => {
  const { t } = useTranslation();
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

  return (
    <MarketplaceLayout>
      <SEO
        title="Barakaz | Shop Beyond Borders with Barakaz"
        description="Global Fashion & Lifestyle Marketplace. Shop electronics, fashion, home & beauty from thousands of verified vendors worldwide."
        canonicalPath="/"
      />
      <HeroBanner />
      <DynamicBannerPlacement placement="homepage_full_width" />
      <NewArrivalsCategories />
      <DynamicBannerPlacement placement="category_promotion" />
      <PromoStrip showSponsored={false} />
      <DynamicBannerPlacement placement="sponsored_products_banner" />
      <DynamicBannerPlacement placement="flash_sale_banner" />
      <BestDealsSection />

      <DynamicBannerPlacement placement="featured_products_banner" />
      <DynamicBannerPlacement placement="homepage_secondary" />
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
