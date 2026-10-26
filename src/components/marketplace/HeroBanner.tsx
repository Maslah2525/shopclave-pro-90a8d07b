import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { categoryBrowsePath } from "@/lib/categoryBrowsing";
import { supabase } from "@/integrations/supabase/client";
import heroBanner1 from "@/assets/hero-banner-1.webp";
import heroBanner2 from "@/assets/hero-banner-2.webp";
import heroBanner3 from "@/assets/hero-banner-3.webp";
import heroBanner4 from "@/assets/hero-banner-4.webp";
import heroBanner5 from "@/assets/hero-banner-5.webp";
import catSmartphones from "@/assets/cat-smartphones.webp";
import catLaptops from "@/assets/cat-laptops.webp";
import catHeadphones from "@/assets/cat-headphones.webp";
import catSmartTvs from "@/assets/cat-smart-tvs.webp";
import catMensFashion from "@/assets/cat-mens-fashion.webp";
import catWomensFashion from "@/assets/cat-womens-fashion.webp";
import catKidsFashion from "@/assets/cat-kids-fashion.webp";
import catShoes from "@/assets/cat-shoes.webp";
import catFurniture from "@/assets/cat-furniture.webp";
import catKitchen from "@/assets/cat-kitchen.webp";
import catDecor from "@/assets/cat-decor.webp";
import catAppliances from "@/assets/cat-appliances.webp";
import catSkincare from "@/assets/cat-skincare.webp";
import catMakeup from "@/assets/cat-makeup.webp";
import catHaircare from "@/assets/cat-haircare.webp";
import catSportswear from "@/assets/cat-sportswear.webp";
import catFootball from "@/assets/cat-football.webp";
import catAccessories from "@/assets/cat-accessories.webp";
import catSmartwatches from "@/assets/cat-smartwatches.webp";
import catTablets from "@/assets/cat-tablets.webp";
import catFragrances from "@/assets/cat-fragrances.webp";
import catNewArrivals from "@/assets/cat-new-arrivals.webp";
import catRegisterStore from "@/assets/cat-register-store.webp";
import catAddProducts from "@/assets/cat-add-products.webp";
import catManageOrders from "@/assets/cat-manage-orders.webp";
import catGrowBusiness from "@/assets/cat-grow-business.webp";
import catClearance from "@/assets/cat-clearance.webp";
import catFlashSales from "@/assets/cat-flash-sales.webp";
import catCycling from "@/assets/cat-cycling.webp";
import catFitnessGear from "@/assets/cat-fitness-gear.webp";

const HERO_SLIDES = [
  { image: heroBanner1, link: "/search?category=fashion" },
  { image: heroBanner2, link: "/search?category=fashion" },
  { image: heroBanner3, link: "/search?category=kids" },
  { image: heroBanner4, link: "/search?category=electronics" },
  { image: heroBanner5, link: "/search?category=smartwatches" },
];

const CATEGORY_CARDS = [
  {
    title: "Top in Electronics",
    items: [
      { name: "Smartphones", slug: "smartphones", image: catSmartphones },
      { name: "Laptops", slug: "laptops", image: catLaptops },
      { name: "Headphones", slug: "headphones", image: catHeadphones },
      { name: "Smart TVs", slug: "smart-tvs", image: catSmartTvs },
    ],
    seeAllLink: "/search?category=electronics",
  },
  {
    title: "Fashion Deals",
    items: [
      { name: "Men's Fashion", slug: "men", image: catMensFashion },
      { name: "Women's Fashion", slug: "women", image: catWomensFashion },
      { name: "Kids' Fashion", slug: "kids", image: catKidsFashion },
      { name: "Shoes", slug: "sneakers", image: catShoes },
    ],
    seeAllLink: "/search?category=fashion",
  },
  {
    title: "Home Essentials",
    items: [
      { name: "Furniture", slug: "furniture", image: catFurniture },
      { name: "Kitchen", slug: "kitchen-dining", image: catKitchen },
      { name: "Decor", slug: "home-decor", image: catDecor },
      { name: "Appliances", slug: "appliances", image: catAppliances },
    ],
    seeAllLink: "/search?category=home-garden",
  },
  {
    title: "Health & Beauty",
    items: [
      { name: "Skincare", slug: "skincare", image: catSkincare },
      { name: "Makeup", slug: "makeup", image: catMakeup },
      { name: "Fragrances", slug: "fragrances", image: catFragrances },
      { name: "Hair Care", slug: "haircare", image: catHaircare },
    ],
    seeAllLink: "/search?category=health-beauty",
  },
  {
    title: "Sports & Fitness",
    items: [
      { name: "Fitness Gear", slug: "fitness-equipment", image: catFitnessGear },
      { name: "Football", slug: "football", image: catFootball },
      { name: "Sportswear", slug: "sportswear", image: catSportswear },
      { name: "Cycling", slug: "cycling", image: catCycling },
    ],
    seeAllLink: "/search?category=sports",
  },
  {
    title: "Phones & Tablets",
    items: [
      { name: "Smartphones", slug: "smartphones-pt", image: catSmartphones },
      { name: "Tablets", slug: "tablets-pt", image: catTablets },
      { name: "Accessories", slug: "phone-accessories", image: catAccessories },
      { name: "Smartwatches", slug: "smartwatches", image: catSmartwatches },
    ],
    seeAllLink: "/search?category=phones-tablets",
  },
  {
    title: "Start Selling",
    items: [
      { name: "Register Store", slug: "_vendor_register", image: catRegisterStore },
      { name: "Add Products", slug: "_vendor_register", image: catAddProducts },
      { name: "Manage Orders", slug: "_vendor_register", image: catManageOrders },
      { name: "Grow Business", slug: "_vendor_register", image: catGrowBusiness },
    ],
    seeAllLink: "/vendor/register",
  },
  {
    title: "Deals of the Day",
    items: [
      { name: "Flash Sales", slug: "flash-sales", image: catFlashSales },
      { name: "Clearance", slug: "clearance", image: catClearance },
      { name: "Bundles", slug: "bundles", image: "https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=200&q=80" },
      { name: "New Arrivals", slug: "new-arrivals", image: catNewArrivals },
    ],
    seeAllLink: "/search?deals=1",
  },
];

// Resolve homepage tiles against real catalogue categories instead of assuming
// every editorial tile label is also a valid category slug.
const normalized = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const categoryAliases: Record<string, string[]> = {
  men: ["mens-fashion", "men-fashion", "mens-clothing", "men-clothing", "men"],
  women: ["womens-fashion", "women-fashion", "womens-clothing", "women-clothing", "women"],
  kids: ["kids-fashion", "kids-clothing", "children-clothing", "children-fashion", "kids"],
  sneakers: ["shoes", "footwear", "sneakers"],
  "smartphones-pt": ["smartphones", "mobile-phones", "phones"],
  "tablets-pt": ["tablets", "tablet-computers"],
  "home-decor": ["home-decor", "decor", "home-decoration"],
  "kitchen-dining": ["kitchen-dining", "kitchen", "kitchen-and-dining"],
  haircare: ["hair-care", "haircare"],
  "fitness-equipment": ["fitness-equipment", "fitness-gear", "gym-equipment"],
  "phone-accessories": ["phone-accessories", "mobile-accessories", "accessories"],
  "smart-tvs": ["smart-tvs", "televisions", "tvs"],
  "health-beauty": ["health-beauty", "health-and-beauty"],
  "home-garden": ["home-garden", "home-and-garden"],
  sports: ["sports", "sports-fitness", "sports-and-fitness"],
  "phones-tablets": ["phones-tablets", "phones-and-tablets"],
};
const categoryDestination = (slug: string, name: string, categories: { slug: string; name: string }[]) => {
  const aliases = categoryAliases[slug] || [slug];
  const category = aliases.map(alias => categories.find(c => normalized(c.slug) === normalized(alias)))
    .find(Boolean) || categories.find(c => normalized(c.name) === normalized(name));
  // The category page handles real categories; missing editorial categories
  // should use a broader keyword that actually appears in product titles.
  const fallbackKeywords: Record<string, string> = {
    men: "men", women: "women", kids: "kids", sneakers: "shoes",
  };
  return category ? categoryBrowsePath(category.slug) : `/search?q=${encodeURIComponent(fallbackKeywords[slug] || name)}`;
};
const tileDestination = (slug: string, name: string, categories: { slug: string; name: string }[]) => {
  if (slug.startsWith("_vendor")) return "/vendor/register";
  if (slug === "flash-sales" || slug === "clearance" || slug === "bundles") return "/search?deals=1";
  if (slug === "new-arrivals") return "/search?arrivals=1";
  return categoryDestination(slug, name, categories);
};

// Per-text colour: the banner's own colour key, falling back to the legacy shared text colour.
const bannerText = (config: any, key: string): string | undefined => {
  const c = config?.[key] ?? config?.text_color;
  return typeof c === "string" && /^#[\da-fA-F]{3,8}$/.test(c) ? c : undefined;
};

const HeroBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { data: catalogueCategories = [] } = useQuery({
    queryKey: ["homepage-card-category-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("slug,name").limit(2000);
      if (error) throw error;
      return data || [];
    },
  });
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  // Load admin-managed banners; fall back to static slides if none
  const { data: dbBanners } = useQuery({
    queryKey: ["public-hero-banners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hero_banners")
        .select("id,title,subtitle,cta_label,link_url,desktop_image_url,mobile_image_url,animation_config,rotation_interval_ms")
        .order("display_order");
      return data || [];
    },
  });

  const slides = (dbBanners && dbBanners.length > 0)
    ? dbBanners.map((b: any) => ({
        image: b.desktop_image_url,
        mobileImage: b.mobile_image_url || b.desktop_image_url,
        link: b.link_url || "/",
        title: b.title,
        subtitle: b.subtitle,
        cta: b.cta_label,
        config: (b.animation_config || {}) as Record<string, boolean>,
        interval: Number(b.rotation_interval_ms) || 5000,
      }))
    : HERO_SLIDES.map((s) => ({ image: s.image, mobileImage: s.image, link: s.link, title: null, subtitle: null, cta: null, config: {} as Record<string, boolean>, interval: 5000 }));

  const safeIdx = slides.length ? currentSlide % slides.length : 0;
  const slide = slides[safeIdx];
  // Per-banner options; anything not explicitly turned off stays on.
  const opt = (k: string) => slide?.config?.[k] !== false;
  const interval = Math.max(1000, slide?.interval || 5000);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = setTimeout(() => setCurrentSlide((prev) => (prev + 1) % slides.length), interval);
    return () => clearTimeout(timer);
  }, [slides.length, paused, interval, currentSlide]);

  if (!slide) return null;

  return (
    <div>
      {/* Hero carousel */}
      <section
        className="relative"
        onMouseEnter={() => opt("pause_on_hover") && setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const start = touchX.current; touchX.current = null;
          if (start === null || !opt("enable_swipe") || slides.length < 2) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) < 40) return;
          setCurrentSlide((prev) => (dx < 0 ? prev + 1 : prev - 1 + slides.length) % slides.length);
        }}
      >
        <Link to={slide.link} className="block">
          <div className="w-full overflow-hidden relative">
            <picture>
              <source media="(max-width: 767px)" srcSet={slide.mobileImage} />
              <img
                src={slide.image}
                alt={slide.title || "Hero banner"}
                className="w-full h-[160px] sm:h-[300px] md:h-[400px] lg:h-[450px] object-contain sm:object-cover bg-secondary transition-all duration-700"
              />
            </picture>
            {(slide.title || slide.cta) && (
              <div className="absolute inset-0 flex items-center">
                <div className="container">
              <div className="max-w-[62%] md:max-w-md min-w-0 break-words [overflow-wrap:anywhere] text-primary-foreground">
                {slide.title && <h2 style={{ color: bannerText((slide.config as any), "title_color") }} className="font-display text-base sm:text-2xl md:text-4xl leading-tight font-bold drop-shadow-md">{slide.title}</h2>}
                {slide.subtitle && <p style={{ color: bannerText((slide.config as any), "subtitle_color") }} className="mt-1.5 text-[11px] sm:text-sm md:text-base leading-snug drop-shadow">{slide.subtitle}</p>}
                {slide.cta && (
                  <span className="inline-block mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-semibold">
                    {slide.cta}
                  </span>
                )}
              </div>
                </div>
              </div>
            )}
          </div>
        </Link>
        {/* Navigation dots */}
        {slides.length > 1 && (
          <>
            {opt("show_dots") && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === safeIdx ? "bg-primary-foreground" : "bg-primary-foreground/40"}`}
                />
              ))}
            </div>}
            {opt("show_arrows") && <>
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/80 hover:bg-card rounded-full p-2 shadow-lg"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/80 hover:bg-card rounded-full p-2 shadow-lg"
            >
              <ChevronRight className="h-6 w-6 text-foreground" />
            </button>
            </>}
          </>
        )}
      </section>

      {/* Category cards grid */}
      <section className="container -mt-8 relative z-10 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_CARDS.map((card) => (
            <div key={card.title} className="bg-card rounded-lg p-5 shadow-sm">
              <h3 className="font-display font-bold text-lg text-foreground mb-4">{card.title}</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {card.items.map((item) => {
                  const to = tileDestination(item.slug, item.name, catalogueCategories);
                  return (
                    <Link key={item.slug + item.name} to={to} className="group">
                      <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-1.5">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors line-clamp-1">{item.name}</p>
                    </Link>
                  );
                })}
              </div>
              <Link to={card.title === "Start Selling" ? "/vendor/register" : card.title === "Deals of the Day" ? "/search?deals=1" : categoryDestination(new URLSearchParams(card.seeAllLink.split("?")[1]).get("category") || "", card.title.replace(/^Top in /, ""), catalogueCategories)} className="text-sm text-primary hover:underline font-medium">
                See all deals
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HeroBanner;
