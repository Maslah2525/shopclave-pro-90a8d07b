import { useSearchParams } from "react-router-dom";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import SEO from "@/components/seo/SEO";
import ProductCard from "@/components/marketplace/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/TranslationContext";
import barakazIcon from "@/assets/barakaz-icon.webp";
import { useProductRatings } from "@/hooks/useProductRatings";
import { useLocale } from "@/hooks/useLocale";

type SortKey = "discount_desc" | "price_asc" | "price_desc" | "newest";

interface FiltersProps {
  categories: { id: string; name: string; slug: string }[];
  selectedCategory: string;
  onCategoryChange: (slug: string) => void;
  priceBounds: [number, number];
  priceRange: [number, number];
  onPriceChange: (v: [number, number]) => void;
  minDiscount: number;
  onMinDiscountChange: (v: number) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  showDiscount: boolean;
  onReset: () => void;
}

const FiltersPanel = ({
  categories, selectedCategory, onCategoryChange,
  priceBounds, priceRange, onPriceChange,
  minDiscount, onMinDiscountChange,
  sort, onSortChange, showDiscount, onReset,
}: FiltersProps) => {
  const { formatPrice } = useLocale();
  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="font-display font-semibold">Filters</h3>
      <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs">
        <X className="h-3 w-3 mr-1" /> Reset
      </Button>
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-medium">Sort by</Label>
      <RadioGroup value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
        {showDiscount && (
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="discount_desc" id="s-disc" />
            <Label htmlFor="s-disc" className="text-sm font-normal cursor-pointer">Highest discount</Label>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="price_asc" id="s-pa" />
          <Label htmlFor="s-pa" className="text-sm font-normal cursor-pointer">Price: Low to High</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="price_desc" id="s-pd" />
          <Label htmlFor="s-pd" className="text-sm font-normal cursor-pointer">Price: High to Low</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="newest" id="s-new" />
          <Label htmlFor="s-new" className="text-sm font-normal cursor-pointer">Newest</Label>
        </div>
      </RadioGroup>
    </div>

    <div className="space-y-3">
      <Label className="text-sm font-medium">Price range</Label>
      <Slider
        min={priceBounds[0]}
        max={priceBounds[1]}
        step={Math.max(1, Math.round((priceBounds[1] - priceBounds[0]) / 100))}
        value={priceRange}
        onValueChange={(v) => onPriceChange([v[0], v[1]] as [number, number])}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatPrice(priceRange[0])}</span>
        <span>{formatPrice(priceRange[1])}</span>
      </div>
    </div>

    {showDiscount && (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Minimum discount</Label>
        <Slider
          min={0}
          max={90}
          step={5}
          value={[minDiscount]}
          onValueChange={(v) => onMinDiscountChange(v[0])}
        />
        <p className="text-xs text-muted-foreground">{minDiscount}% off or more</p>
      </div>
    )}

    <div className="space-y-2">
      <Label className="text-sm font-medium">Category</Label>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        <button
          onClick={() => onCategoryChange("")}
          className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted ${selectedCategory === "" ? "bg-muted font-medium text-primary" : ""}`}
        >
          All categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategoryChange(c.slug)}
            className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted ${selectedCategory === c.slug ? "bg-muted font-medium text-primary" : ""}`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  </div>
  );
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const categorySlug = searchParams.get("category") || "";
  const dealsMode = searchParams.get("deals") === "1";
  const [query, setQuery] = useState(initialQuery);
  const { t } = useTranslation();

  // Local filter state
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [minDiscount, setMinDiscount] = useState(0);
  const [sort, setSort] = useState<SortKey>(dealsMode ? "discount_desc" : "newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Top-level categories list for the filter panel
  const { data: topCategories = [] } = useQuery({
    queryKey: ["top-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("parent_id", null)
        .order("name");
      return (data || []) as { id: string; name: string; slug: string }[];
    },
  });

  // Resolve category slug -> category id + descendant ids
  const { data: categoryInfo, isLoading: categoryLoading } = useQuery({
    queryKey: ["category-resolve", categorySlug],
    enabled: !!categorySlug,
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("categories")
        .select("id, name")
        .eq("slug", categorySlug)
        .maybeSingle();
      if (!cat) return { ids: [] as string[], name: "" };

      const { data: children } = await supabase
        .from("categories")
        .select("id")
        .eq("parent_id", cat.id);
      const childIds = (children || []).map((c: any) => c.id);

      let grandIds: string[] = [];
      if (childIds.length) {
        const { data: grand } = await supabase
          .from("categories")
          .select("id")
          .in("parent_id", childIds);
        grandIds = (grand || []).map((g: any) => g.id);
      }

      return { ids: [cat.id, ...childIds, ...grandIds], name: cat.name };
    },
  });

  const categoryIds = categoryInfo?.ids || [];
  const categoryReady = !categorySlug || !categoryLoading;

  const { data: products, isLoading } = useQuery({
    queryKey: ["search-products", query, categorySlug, categoryIds.join(","), dealsMode],
    enabled: categoryReady,
    queryFn: async () => {
      if (categorySlug && categoryIds.length === 0) return [];

      let q = supabase
        .from("products")
        .select("*, vendors(store_name, status), product_images(url, position)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(dealsMode ? 96 : 48);

      if (query.trim()) {
        q = q.ilike("name", `%${query.trim()}%`);
      }

      if (categorySlug && categoryIds.length > 0) {
        q = q.in("category_id", categoryIds);
      }

      if (dealsMode) {
        q = q.not("compare_at_price", "is", null);
      }

      const { data } = await q;
      let list = data || [];

      if (dealsMode) {
        list = list.filter(
          (p: any) => p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
        );
      }

      return list;
    },
  });

  // Compute price bounds from results
  const priceBounds = useMemo<[number, number]>(() => {
    if (!products || products.length === 0) return [0, 100000];
    const prices = products.map((p: any) => Number(p.price));
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return [min, max === min ? max + 1 : max];
  }, [products]);

  const effectivePriceRange: [number, number] = priceRange ?? priceBounds;

  // Apply client-side filters and sort
  const filteredSorted = useMemo(() => {
    const list = (products || []).filter((p: any) => {
      const price = Number(p.price);
      if (price < effectivePriceRange[0] || price > effectivePriceRange[1]) return false;
      if (dealsMode && minDiscount > 0) {
        const cap = Number(p.compare_at_price);
        const disc = cap > 0 ? ((cap - price) / cap) * 100 : 0;
        if (disc < minDiscount) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a: any, b: any) => {
      if (sort === "price_asc") return Number(a.price) - Number(b.price);
      if (sort === "price_desc") return Number(b.price) - Number(a.price);
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      // discount_desc
      const da = a.compare_at_price ? (Number(a.compare_at_price) - Number(a.price)) / Number(a.compare_at_price) : 0;
      const db = b.compare_at_price ? (Number(b.compare_at_price) - Number(b.price)) / Number(b.compare_at_price) : 0;
      return db - da;
    });
    return sorted;
  }, [products, effectivePriceRange, minDiscount, sort, dealsMode]);

  const { data: ratingsMap = {} } = useProductRatings(filteredSorted.map((p: any) => p.id));

  const displayProducts = filteredSorted.map((p: any) => ({
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
  }));

  const headingText = query
    ? `${t("search.resultsFor")} "${query}"`
    : dealsMode
      ? "Today's Deals"
      : categoryInfo?.name
        ? categoryInfo.name
        : t("search.allProducts");

  const handleCategoryChange = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
    setMobileFiltersOpen(false);
  };

  const handleReset = () => {
    setPriceRange(null);
    setMinDiscount(0);
    setSort(dealsMode ? "discount_desc" : "newest");
    handleCategoryChange("");
  };

  const filtersProps: FiltersProps = {
    categories: topCategories,
    selectedCategory: categorySlug,
    onCategoryChange: handleCategoryChange,
    priceBounds,
    priceRange: effectivePriceRange,
    onPriceChange: setPriceRange,
    minDiscount,
    onMinDiscountChange: setMinDiscount,
    sort,
    onSortChange: setSort,
    showDiscount: dealsMode,
    onReset: handleReset,
  };

  const seoTitle = query
    ? `${query} – Search results | Barakaz`
    : dealsMode
      ? "Today's Deals | Barakaz"
      : categoryInfo?.name
        ? `${categoryInfo.name} | Barakaz`
        : "All Products | Barakaz";
  const seoDescription = query
    ? `Shop products matching "${query}" from verified vendors on Barakaz with worldwide delivery.`
    : dealsMode
      ? "Today's best deals and discounts from verified Barakaz vendors. Limited-time prices on top products."
      : categoryInfo?.name
        ? `Browse ${categoryInfo.name} products from verified vendors on Barakaz. Compare prices and order with secure checkout.`
        : "Browse all products on Barakaz from thousands of verified vendors worldwide.";
  const seoCanonical = categorySlug
    ? `/category/${categorySlug}`
    : dealsMode
      ? "/search?deals=1"
      : query
        ? `/search?q=${encodeURIComponent(query)}`
        : "/search";

  return (
    <MarketplaceLayout>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalPath={seoCanonical}
      />
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-xl">
            <Input
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-10 h-12 text-base"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>

          {/* Mobile filter trigger */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="md:hidden gap-2 h-12">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[380px] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FiltersPanel {...filtersProps} />
            </SheetContent>
          </Sheet>
        </div>

        <h1 className="font-display text-xl font-bold mb-6">
          {headingText}
          {displayProducts.length > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">({displayProducts.length})</span>
          )}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-20 bg-card border border-border rounded-lg p-4">
              <FiltersPanel {...filtersProps} />
            </div>
          </aside>

          <div>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
                ))}
              </div>
            ) : displayProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-lg text-muted-foreground">
                  {dealsMode ? "No active deals match your filters." : t("search.noProducts")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {dealsMode ? "Try adjusting filters or check back soon!" : t("search.tryDifferent")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MarketplaceLayout>
  );
};

export default SearchPage;
