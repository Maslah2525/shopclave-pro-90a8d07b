import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import SEO from "@/components/seo/SEO";
import HeroBanner from "@/components/marketplace/HeroBanner";
import DynamicBannerPlacement from "@/components/marketplace/DynamicBannerPlacement";
import "@/components/marketplace/dynamic-banner.css";
import PromoStrip from "@/components/marketplace/PromoStrip";
import NewArrivalsCategories from "@/components/marketplace/NewArrivalsCategories";
import BestDealsSection from "@/components/marketplace/BestDealsSection";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";

const Index = () => {
  const { t } = useTranslation();
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
