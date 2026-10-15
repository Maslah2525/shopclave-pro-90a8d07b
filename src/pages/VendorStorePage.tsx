import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import ProductCard from "@/components/marketplace/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, Globe, Users, ShieldCheck, Calendar, Store as StoreIcon, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useProductRatings } from "@/hooks/useProductRatings";
import SEO, { SITE_URL } from "@/components/seo/SEO";
import StoreQRDialog from "@/components/vendor/StoreQRDialog";

type SortOption = "newest" | "price_asc" | "price_desc";

const maskPhone = (p?: string | null) => {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `${digits.slice(0, 3)}••••${digits.slice(-2)}`;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VendorStorePage = () => {
  const { slug: param } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");

  const requireAuth = (fn: () => void) => {
    if (!user) {
      toast.info("Please sign in to contact the seller");
      navigate("/auth");
      return;
    }
    fn();
  };

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-store", param],
    queryFn: async () => {
      if (!param) return null;
      const isUuid = UUID_RE.test(param);
      const { data, error } = await supabase
        .from("vendors")
        .select(
          "id, user_id, store_name, store_description, logo_url, banner_url, status, slug, phone, phone2, whatsapp, website, created_at, updated_at"
        )
        .eq(isUuid ? "id" : "slug", param)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!param,
  });

  const vendorId = vendor?.id;

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["vendor-store-products", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, compare_at_price, deal_ends_at, created_at, vendor_featured, category_id, stock, handling_time_days, categories(id, name, slug), product_images(url, position)")
        .eq("vendor_id", vendorId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ["vendor-followers", vendorId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_vendor_follower_count", { v_id: vendorId! });
      return data || 0;
    },
    enabled: !!vendorId,
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["is-following", vendorId, user?.id],
    queryFn: async () => {
      if (!user || !vendorId) return false;
      const { data } = await supabase
        .from("vendor_follows")
        .select("id")
        .eq("user_id", user.id)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!vendorId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !vendorId) return;
      if (isFollowing) {
        await supabase.from("vendor_follows").delete().eq("user_id", user.id).eq("vendor_id", vendorId);
      } else {
        await supabase.from("vendor_follows").insert({ user_id: user.id, vendor_id: vendorId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-followers", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["is-following", vendorId] });
      toast.success(isFollowing ? "Unfollowed" : "Following!");
    },
  });

  const featuredProducts = useMemo(
    () => (products as any[]).filter((p) => p.vendor_featured).slice(0, 8),
    [products]
  );

  const categoryNav = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    (products as any[]).forEach((p) => {
      if (p.category_id && p.categories?.name) {
        const existing = map.get(p.category_id);
        if (existing) existing.count += 1;
        else map.set(p.category_id, { id: p.category_id, name: p.categories.name, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === "all") return products as any[];
    return (products as any[]).filter((p) => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    if (sort === "price_asc") arr.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") arr.sort((a, b) => b.price - a.price);
    return arr;
  }, [filteredProducts, sort]);

  const allIdsForRatings = useMemo(
    () => Array.from(new Set([...sortedProducts, ...featuredProducts].map((p: any) => p.id))),
    [sortedProducts, featuredProducts]
  );
  const { data: ratingsMap = {} } = useProductRatings(allIdsForRatings);

  if (vendorLoading) {
    return (
      <MarketplaceLayout>
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="aspect-[16/6] w-full rounded-lg" />
          <Skeleton className="h-32 w-full mt-4" />
        </div>
      </MarketplaceLayout>
    );
  }

  if (!vendor) {
    return (
      <MarketplaceLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <StoreIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Store not found</h1>
          <p className="text-muted-foreground mb-6">This vendor doesn't exist or is unavailable.</p>
          <Button onClick={() => navigate("/")}>Back to home</Button>
        </div>
      </MarketplaceLayout>
    );
  }

  const initial = vendor.store_name?.charAt(0).toUpperCase() || "?";
  const memberSince = new Date(vendor.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const storePath = `/store/${vendor.slug ?? vendor.id}`;
  const storeUrl = `${SITE_URL}${storePath}`;
  const seoDescription =
    vendor.store_description ||
    `Shop ${vendor.store_name} on Barakaz — verified vendor with ${products.length} products. Worldwide delivery available.`;

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: vendor.store_name,
    url: storeUrl,
    image: vendor.logo_url || vendor.banner_url || undefined,
    description: vendor.store_description || undefined,
    telephone: vendor.phone || undefined,
    address: (vendor as any).address
      ? { "@type": "PostalAddress", streetAddress: (vendor as any).address }
      : undefined,
  };

  return (
    <MarketplaceLayout>
      <SEO
        title={`${vendor.store_name} — Shop on Barakaz`}
        description={seoDescription}
        canonicalPath={storePath}
        image={vendor.logo_url || vendor.banner_url || undefined}
        type="profile"
        jsonLd={storeJsonLd}
      />
      <div className="bg-background">
        {/* Banner */}
        <div className="relative w-full aspect-[16/6] md:aspect-[16/5] bg-gradient-to-br from-primary/30 via-primary/10 to-secondary overflow-hidden">
          {vendor.banner_url && (
            <img
              src={vendor.banner_url}
              alt={`${vendor.store_name} banner`}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Header card */}
        <div className="container mx-auto px-4">
          <div className="bg-card border border-border rounded-lg shadow-sm -mt-12 md:-mt-16 relative z-10 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Logo */}
              <div className="h-24 w-24 md:h-28 md:w-28 rounded-full border-4 border-card bg-secondary shrink-0 -mt-12 md:-mt-16 overflow-hidden flex items-center justify-center text-3xl font-bold text-primary">
                {vendor.logo_url ? (
                  <img src={vendor.logo_url} alt={vendor.store_name} className="w-full h-full object-cover" />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">{vendor.store_name}</h1>
                  {vendor.status === "approved" && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3 text-primary" /> Verified
                    </Badge>
                  )}
                </div>
                {vendor.store_description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{vendor.store_description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{followerCount} Followers</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Member since {memberSince}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 md:items-end">
                <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                  <Button
                    size="sm"
                    variant={isFollowing ? "outline" : "default"}
                    className="rounded-full px-5"
                    onClick={() => requireAuth(() => followMutation.mutate())}
                    disabled={followMutation.isPending}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Button>
                  <StoreQRDialog
                    storeUrl={storeUrl}
                    storeName={vendor.store_name}
                    logoUrl={vendor.logo_url}
                  />
                  {vendor.website && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => requireAuth(() => {
                        let url = vendor.website!;
                        if (!url.startsWith("http")) url = "https://" + url;
                        window.open(url, "_blank");
                      })}
                    >
                      <Globe className="h-4 w-4" /> Website
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Featured by vendor */}
          {featuredProducts.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-primary fill-primary" />
                <h2 className="text-lg md:text-xl font-bold text-foreground">
                  Featured by {vendor.store_name}
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {featuredProducts.map((p: any) => {
                  const imgs = (p.product_images || []).sort((a: any, b: any) => a.position - b.position);
                  return (
                    <ProductCard
                      key={`feat-${p.id}`}
                      id={p.id}
                      name={p.name}
                      slug={p.slug}
                      price={p.price}
                      compareAtPrice={p.compare_at_price}
                      image={imgs[0]?.url || ""}
                      vendorId={vendor.id}
                      vendorName={vendor.store_name}
                      dealEndsAt={p.deal_ends_at}
                      rating={ratingsMap[p.id]?.avg ?? 0}
                      reviewCount={ratingsMap[p.id]?.count ?? 0}
                      soldCount={ratingsMap[p.id]?.sold ?? 0}
                      stock={p.stock}
                      handlingTimeDays={p.handling_time_days}
                      verifiedSeller={vendor.status === "approved"}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Category nav */}
          {categoryNav.length >= 2 && (
            <div className="mt-8 -mx-4 px-4 md:mx-0 md:px-0">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategoryId("all")}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedCategoryId === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary"
                  }`}
                >
                  All ({products.length})
                </button>
                {categoryNav.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedCategoryId === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary"
                    }`}
                  >
                    {c.name} ({c.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="mt-6 mb-12">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-lg md:text-xl font-bold text-foreground">
                Products ({sortedProducts.length})
              </h2>
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-lg">
                <StoreIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">This vendor has no active products yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {sortedProducts.map((p: any) => {
                  const imgs = (p.product_images || []).sort((a: any, b: any) => a.position - b.position);
                  return (
                    <ProductCard
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      slug={p.slug}
                      price={p.price}
                      compareAtPrice={p.compare_at_price}
                      image={imgs[0]?.url || ""}
                      vendorId={vendor.id}
                      vendorName={vendor.store_name}
                      dealEndsAt={p.deal_ends_at}
                      rating={ratingsMap[p.id]?.avg ?? 0}
                      reviewCount={ratingsMap[p.id]?.count ?? 0}
                      soldCount={ratingsMap[p.id]?.sold ?? 0}
                      stock={p.stock}
                      handlingTimeDays={p.handling_time_days}
                      verifiedSeller={vendor.status === "approved"}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MarketplaceLayout>
  );
};

export default VendorStorePage;
