import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { useProductRatings } from "@/hooks/useProductRatings";

interface Promo {
  id: string;
  kind: "brand" | "product";
  placement: "featured_brands" | "sponsored_products";
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string;
}

const productSlugFromLink = (link: string) => {
  const match = link.match(/^\/product\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const PromoStrip = ({ hideSectionHeadings = false }: { hideSectionHeadings?: boolean }) => {
  const { data } = useQuery({
    queryKey: ["public-promotions"],
    queryFn: async () => {
      const { data: promotions } = await supabase
        .from("promotions")
        .select("*")
        .order("display_order");
      const promos = (promotions || []) as Promo[];
      const sponsoredSlugs = promos
        .filter((promo) => promo.placement === "sponsored_products")
        .map((promo) => productSlugFromLink(promo.link_url))
        .filter((slug): slug is string => Boolean(slug));

      if (sponsoredSlugs.length === 0) return { promos, products: [] };

      const { data: products } = await supabase
        .from("products")
        .select("*, vendors(store_name, status), product_images(url, position)")
        .eq("status", "active")
        .in("slug", sponsoredSlugs);

      return { promos, products: products || [] };
    },
  });

  const promos = data?.promos || [];
  const catalogueProducts = data?.products || [];
  const { data: ratingsMap = {} } = useProductRatings(catalogueProducts.map((product: any) => product.id));

  if (!promos.length) return null;

  const brands = promos.filter((promo) => promo.placement === "featured_brands");
  const sponsoredProducts = promos
    .filter((promo) => promo.placement === "sponsored_products")
    .map((promo) => {
      const slug = productSlugFromLink(promo.link_url);
      const product = catalogueProducts.find((item: any) => item.slug === slug);
      return product ? { promo, product } : null;
    })
    .filter((entry): entry is { promo: Promo; product: any } => Boolean(entry));

  return (
    <div className="container py-6 space-y-8">
      {brands.length > 0 && (
        <section>
          <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-4">Featured Brands</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {brands.map((b) => (
              <Link key={b.id} to={b.link_url} className="group bg-card rounded-lg p-3 border hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="aspect-square w-full overflow-hidden rounded-md bg-muted mb-2">
                  <img src={b.image_url} alt={b.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" />
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-1">{b.title}</p>
                {b.subtitle && <p className="text-[10px] text-muted-foreground line-clamp-1">{b.subtitle}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {sponsoredProducts.length > 0 && (
        <section>
          {!hideSectionHeadings && <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-4">Sponsored Products</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {sponsoredProducts.slice(0, 10).map(({ promo, product }) => (
              <ProductCard
                key={promo.id}
                id={product.id}
                name={product.name}
                price={Number(product.price)}
                compareAtPrice={product.compare_at_price ? Number(product.compare_at_price) : null}
                image={promo.image_url}
                vendorId={product.vendor_id}
                vendorName={product.vendors?.store_name || "Unknown Seller"}
                slug={product.slug}
                rating={ratingsMap[product.id]?.avg ?? 0}
                reviewCount={ratingsMap[product.id]?.count ?? 0}
                soldCount={ratingsMap[product.id]?.sold ?? 0}
                dealEndsAt={product.deal_ends_at}
                stock={product.stock}
                handlingTimeDays={product.handling_time_days}
                verifiedSeller={product.vendors?.status === "approved"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PromoStrip;
