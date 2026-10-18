import { normalizeShippingOptions, SHIP_LABELS, type ShipKey } from "@/components/vendor/ProductListingExtras";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  EyeOff,
  Heart,
  LockKeyhole,
  Mail,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Ruler,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  ThumbsUp,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import ProductCard from "@/components/marketplace/ProductCard";
import CountdownTimer from "@/components/shared/CountdownTimer";
import ProductGallery from "@/components/product/ProductGallery";
import ProductDescriptionTabs from "@/components/product/ProductDescriptionTabs";
import SEO, { SITE_URL } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { colorChoiceImageUrl, galleryImageUrls } from "@/lib/productVariantImages";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCart } from "@/contexts/CartContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useLocale } from "@/hooks/useLocale";
import { useProductRatings } from "@/hooks/useProductRatings";
import { useToggleWishlist, useWishlist } from "@/hooks/useWishlist";
import { supabase } from "@/integrations/supabase/client";
import {
  clampQuantity,
  getPurchaseState,
  isOptionValueAvailable,
  normalizeSelection,
  purchaseMessage,
  remainingForCart,
} from "@/lib/productPurchase";
import barakazIcon from "@/assets/barakaz-icon.webp";
import afterpayLogo from "@/assets/payment-methods/afterpay.webp.asset.json";
import applePayLogo from "@/assets/payment-methods/apple-pay.webp.asset.json";
import bankTransferLogo from "@/assets/payment-methods/bank-transfer.webp.asset.json";
import discoverLogo from "@/assets/payment-methods/discover.jpg.asset.json";
import googlePayLogo from "@/assets/payment-methods/google-pay.webp.asset.json";
import klarnaLogo from "@/assets/payment-methods/klarna.webp.asset.json";
import mastercardLogo from "@/assets/payment-methods/mastercard-detail.jpg.asset.json";
import paypalLogo from "@/assets/payment-methods/paypal.webp.asset.json";
import shopPayLogo from "@/assets/payment-methods/shop-pay.webp.asset.json";
import stripeLogo from "@/assets/payment-methods/stripe.webp.asset.json";
import visaLogo from "@/assets/payment-methods/visa.jpg.asset.json";
import returnsBox from "@/assets/product-info/returns-box.jpg.asset.json";
import { cn } from "@/lib/utils";
import { getProductDisplayStats } from "@/lib/productDisplayStats";
import {
  estimateDeliveryWindow,
  formatDeliveryWindow,
  saveDeliveryPreference,
  transitDaysForService,
  type DeliveryService,
} from "@/lib/deliveryEstimate";

const FASHION_CATEGORY_ID = "a0000001-0000-0000-0000-000000000002";

const trackEvent = async (vendorId: string, productId: string, eventType: string) => {
  try {
    await supabase.from("vendor_analytics").insert({ vendor_id: vendorId, product_id: productId, event_type: eventType });
  } catch {
    // Analytics must never interrupt a purchase action.
  }
};

const RatingStars = ({ rating }: { rating: number }) => (
  <span className="flex" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={cn("h-3 w-3 md:h-4 md:w-4", star <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground/25")}
      />
    ))}
  </span>
);

const SellerCard = ({ vendor }: { vendor: any }) => {
  const { data: followerCount = 0 } = useQuery({
    queryKey: ["vendor-followers", vendor.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_vendor_follower_count", { v_id: vendor.id });
      return data || 0;
    },
  });

  const storePath = `/store/${vendor.slug ?? vendor.id}`;

  return (
    <section className="border border-border bg-card px-3 py-2.5" aria-labelledby="seller-heading">
      <div className="flex items-center gap-3">
        {vendor.logo_url ? (
          <img src={vendor.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-sm border border-border object-cover md:h-12 md:w-12 md:rounded-full" loading="lazy" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 font-bold text-primary md:h-12 md:w-12 md:rounded-full">
            {vendor.store_name?.[0]?.toUpperCase() || "B"}
          </span>
        )}
        <div className="min-w-0 flex-1">
           <div className="flex min-w-0 items-center gap-1.5">
             <span className="shrink-0 text-[10px] text-muted-foreground md:text-xs">Sold by</span>
             <Link id="seller-heading" to={storePath} className="truncate text-sm font-bold hover:text-primary md:text-base">
              {vendor.store_name}
            </Link>
            {vendor.status === "approved" ? (
               <span className="flex shrink-0 items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary md:rounded-full md:px-2 md:text-[11px]">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </span>
            ) : null}
          </div>
           <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground md:text-xs">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {followerCount} {followerCount === 1 ? "follower" : "followers"}
            </span>
          </div>
        </div>
        <Link
          to={storePath}
           className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary hover:underline md:text-sm"
        >
          Visit store <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

const paymentLogos = [
  { name: "Visa", url: visaLogo.url },
  { name: "Mastercard", url: mastercardLogo.url },
  { name: "Discover", url: discoverLogo.url },
  { name: "PayPal", url: paypalLogo.url },
  { name: "Apple Pay", url: applePayLogo.url },
  { name: "Google Pay", url: googlePayLogo.url },
  { name: "Klarna", url: klarnaLogo.url },
  { name: "Shop Pay", url: shopPayLogo.url },
  { name: "Afterpay", url: afterpayLogo.url },
  { name: "Stripe", url: stripeLogo.url },
  { name: "Bank transfer", url: bankTransferLogo.url },
];

const TRUST_ITEMS = [
  {
    icon: LockKeyhole,
    title: "Secure payments",
    detail: "Protected checkout",
    intro: "Shop with confidence. Payment information is handled through secure checkout.",
    illustration: "payments",
    points: [
      { icon: ShieldCheck, title: "Encrypted transactions", text: "Checkout uses an encrypted connection and secure payment processing." },
      { icon: CreditCard, title: "Multiple payment options", text: "The methods available for your order are shown and confirmed at checkout." },
      { icon: EyeOff, title: "Card details stay private", text: "Your full card information is not stored by Barakaz or shared with the seller." },
    ],
    link: { to: "/faq", label: "Learn more about payment security" },
  },
  {
    icon: ShieldCheck,
    title: "Buyer protection",
    detail: "Shop with confidence",
    intro: "Eligible orders receive support when an order does not arrive, arrives damaged, or differs significantly from its description.",
    illustration: "shield",
    points: [
      { icon: CircleDollarSign, title: "Eligible refund support", text: "Report a qualifying order issue and request a review from your Orders page." },
      { icon: ClipboardList, title: "Recorded claims process", text: "Keep order communication on Barakaz so the purchase and seller conversation can be reviewed." },
      { icon: ThumbsUp, title: "Safer marketplace shopping", text: "Seller status, order records, and secure checkout help support a fair resolution." },
    ],
    link: { to: "/help", label: "Learn more about Buyer Protection" },
  },
  {
    icon: RotateCcw,
    title: "Returns",
    detail: "7-day policy",
    intro: "Eligible items can be returned within 7 days of delivery under the Barakaz return policy.",
    illustration: "returns",
    points: [
      { icon: CalendarDays, title: "7-day return window", text: "Start an eligible return within 7 days of the delivery date." },
      { icon: PackageCheck, title: "Item condition", text: "Items must be unused, in original packaging, and in the condition received." },
      { icon: CircleDollarSign, title: "Refund process", text: "After inspection, approved refunds are issued to the original payment method within 5–10 business days." },
    ],
    link: { to: "/return-policy", label: "View full Return Policy" },
  },
  {
    icon: MessageCircle,
    title: "Customer support",
    detail: "Help when needed",
    intro: "Our customer support team can help with orders, deliveries, returns, payments, and seller questions.",
    illustration: "support",
    points: [
      { icon: Mail, title: "Email support", text: "Contact support@barakaz.com for customer assistance." },
      { icon: ClipboardList, title: "Order assistance", text: "Have your order number ready so the team can find your purchase faster." },
      { icon: MessageCircle, title: "Help Center", text: "Find answers about orders, shipping, payments, returns, and selling." },
    ],
    link: { to: "/contact", label: "Contact support" },
  },
];

const TrustStrip = () => {
  return (
    <div className="grid grid-cols-4 border border-border bg-card">
      {TRUST_ITEMS.map(({ icon: Icon, title, detail, intro, illustration, points, link }) => (
        <Dialog key={title}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`${title} — ${detail}. Open details`}
              className="flex min-w-0 cursor-pointer flex-col items-center gap-1 border-r border-border px-1 py-2 text-center transition-colors last:border-r-0 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:gap-2 sm:p-2.5 sm:text-left md:p-3"
            >
              <Icon className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold leading-tight text-foreground sm:text-xs">{title}</p>
                <p className="hidden text-[11px] text-muted-foreground sm:block">{detail}</p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto p-0 sm:rounded-lg">
            <DialogHeader className="items-center px-6 pt-7 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Icon className="h-8 w-8 text-success" />
              </span>
              <DialogTitle className="pt-2 text-2xl font-bold">{title}</DialogTitle>
              <p className="text-sm leading-6 text-muted-foreground">{intro}</p>
            </DialogHeader>
            {illustration === "payments" ? (
              <div className="grid grid-cols-4 gap-2 px-6" aria-label="Payment methods that may be available at checkout">
                {paymentLogos.map((method) => (
                  <div key={method.name} className="flex h-10 items-center justify-center rounded border border-border bg-card px-1.5">
                    <img src={method.url} alt={method.name} className="h-7 w-full object-contain" loading="lazy" />
                  </div>
                ))}
              </div>
            ) : illustration === "returns" ? (
              <img src={returnsBox.url} alt="Open delivery box with a return arrow" className="mx-auto h-36 w-56 object-contain" />
            ) : illustration === "shield" ? (
              <div className="mx-auto flex h-28 w-40 items-center justify-center rounded bg-success/10">
                <ShieldCheck className="h-20 w-20 text-success" aria-hidden="true" />
              </div>
            ) : (
              <div className="mx-auto flex h-28 w-40 items-center justify-center rounded bg-success/10">
                <MessageCircle className="h-20 w-20 text-success" aria-hidden="true" />
              </div>
            )}
            <div className="space-y-1 px-6">
              {points.map(({ icon: PointIcon, title: pointTitle, text }) => (
                <div key={pointTitle} className="flex gap-3 border-b border-border py-3 last:border-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                    <PointIcon className="h-5 w-5 text-success" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{pointTitle}</h3>
                    <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="mx-6 mb-6 font-bold">
              <Link to={link.to}>{link.label} <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};

const ProductDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { formatPrice } = useLocale();
  const { addItem, items: cartItems } = useCart();
  const { data: wishlistIds } = useWishlist();
  const toggleWishlist = useToggleWishlist();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryService>("Standard Shipping");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("products")
        .select("*, vendors(id, slug, store_name, logo_url, status), product_images(url, position, variant_id), categories(name, slug, parent_id)")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: Boolean(slug),
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["product-variants", product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", product.id).order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(product?.id),
  });

  const { data: reviewStats = { avg: 0, count: 0 } } = useQuery({
    queryKey: ["review-stats", product?.id],
    queryFn: async () => {
      if (!product?.id) return { avg: 0, count: 0 };
      const { data, error } = await supabase.from("reviews").select("rating").eq("product_id", product.id);
      if (error) throw error;
      if (!data?.length) return { avg: 0, count: 0 };
      return { avg: data.reduce((sum, review) => sum + review.rating, 0) / data.length, count: data.length };
    },
    enabled: Boolean(product?.id),
  });

  const { data: soldStats = {} } = useProductRatings(product?.id ? [product.id] : []);

  useEffect(() => {
    if (product?.id && product.vendor_id) void trackEvent(product.vendor_id, product.id, "view");
  }, [product?.id, product?.vendor_id]);

  const optionTypes = useMemo(() => {
    const types: Record<string, string[]> = {};
    variants.forEach((variant: any) => {
      const options = (variant.variant_options || {}) as Record<string, string>;
      Object.entries(options).forEach(([name, value]) => {
        if (!types[name]) types[name] = [];
        if (!types[name].includes(value)) types[name].push(value);
      });
    });
    return types;
  }, [variants]);
  const hasVariants = Object.keys(optionTypes).length > 0;

  useEffect(() => {
    const next = hasVariants ? normalizeSelection(optionTypes, {}) : {};
    setSelectedOptions(next);
    setQty(1);
  }, [product?.id, hasVariants, optionTypes]);

  const selectedVariant = useMemo(() => {
    const keys = Object.keys(optionTypes);
    if (!hasVariants || !keys.every((key) => selectedOptions[key] != null)) return null;
    return variants.find((variant: any) => {
      const options = (variant.variant_options || {}) as Record<string, string>;
      return keys.every((key) => options[key] === selectedOptions[key]);
    }) || null;
  }, [hasVariants, optionTypes, selectedOptions, variants]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayCompare = selectedVariant?.compare_at_price ?? product?.compare_at_price;
  const displayStock = hasVariants ? selectedVariant?.stock ?? product?.stock : product?.stock;
  const discountPct = displayCompare && Number(displayCompare) > Number(displayPrice)
    ? Math.round(((Number(displayCompare) - Number(displayPrice)) / Number(displayCompare)) * 100)
    : null;
  const deliveryOptions = useMemo(() => {
    const handlingDays = Number(product?.handling_time_days ?? 1);
    const opts = normalizeShippingOptions((product as any)?.shipping_options);
    return (Object.keys(SHIP_LABELS) as ShipKey[]).filter((k) => opts[k].enabled).map((k) => {
      const [lo, hi] = opts[k].days.split("-").map(Number);
      return { service: SHIP_LABELS[k] as any, label: k === "pickup" ? "Local pickup" : `${SHIP_LABELS[k].replace(" Shipping", "")} delivery`,
        price: opts[k].price > 0 ? `CA$${opts[k].price.toFixed(2)}` : "Free", lo, hi };
    }).map((option) => ({
      ...option,
      arrival: formatDeliveryWindow(estimateDeliveryWindow({
        from: new Date(),
        minDays: option.lo, maxDays: option.hi,
        handlingDays,
      })),
    }));
  }, [product?.handling_time_days, (product as any)?.shipping_options]);

  useEffect(() => {
    if (deliveryOptions.length && !deliveryOptions.some((o) => o.service === selectedDelivery)) setSelectedDelivery(deliveryOptions[0].service);
  }, [deliveryOptions, selectedDelivery]);

  const purchase = getPurchaseState({
    hasVariants,
    optionKeys: Object.keys(optionTypes),
    selected: selectedOptions,
    variant: selectedVariant as any,
    productStock: product?.stock,
  });

  useEffect(() => {
    setQty((current) => clampQuantity(current, purchase.maxQty));
  }, [purchase.maxQty]);

  const galleryImages = useMemo(() => {
    if (!product) return [barakazIcon];
    const images = product.product_images || [];
    const colorKey = Object.keys(optionTypes).find((key) => /colou?r/i.test(key));
    const resolved = galleryImageUrls({
      images,
      variants,
      colorName: colorKey,
      colorValue: colorKey ? selectedOptions[colorKey] : undefined,
      selectedVariantId: selectedVariant?.id,
    });
    return resolved.length ? resolved : [barakazIcon];
  }, [optionTypes, product, selectedOptions, selectedVariant, variants]);

  if (isLoading) {
    return (
      <MarketplaceLayout>
        <div className="container py-5">
          <Skeleton className="mb-4 h-4 w-56" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
            <Skeleton className="aspect-square" />
            <div className="space-y-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-48" /><Skeleton className="h-60 w-full" /></div>
          </div>
        </div>
      </MarketplaceLayout>
    );
  }

  if (!product) {
    return <MarketplaceLayout><div className="container py-16 text-center"><h1 className="text-2xl font-bold">{t("product.notFound")}</h1></div></MarketplaceLayout>;
  }

  const vendor = product.vendors as any;
  const displayStats = getProductDisplayStats(
    product.id,
    reviewStats.avg,
    reviewStats.count,
    soldStats[product.id]?.sold ?? 0,
  );
  const selectionLabel = selectedVariant ? Object.values(selectedVariant.variant_options as Record<string, string>).join(" / ") : "";
  const wished = Boolean(wishlistIds?.has(product.id));
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const categoryName = product.categories?.name || "";
  const isClothing = (product.category_id === FASHION_CATEGORY_ID || product.categories?.parent_id === FASHION_CATEGORY_ID)
    && !/bag|shoe|jewelry|jewellery|accessor|luggage|watch|belt|hat|cap|sunglass/i.test(categoryName);

  const handlePurchase = (mode: "cart" | "buy") => {
    if (!purchase.canBuy) {
      toast.error(purchaseMessage(purchase));
      return;
    }
    const inCart = cartItems
      .filter((item) => item.productId === product.id && (item.variantId ?? null) === (selectedVariant?.id ?? null))
      .reduce((sum, item) => sum + item.quantity, 0);
    const room = remainingForCart(purchase.maxQty, inCart);
    if (room <= 0) {
      if (mode === "buy") navigate("/checkout");
      else toast.error("You already have all available stock in your cart");
      return;
    }
    const qtyToAdd = Math.min(qty, room);
    saveDeliveryPreference(product.vendor_id, selectedDelivery);
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(displayPrice),
      image: galleryImages[0] || barakazIcon,
      vendorId: product.vendor_id,
      vendorName: vendor?.store_name || "",
      variantId: selectedVariant?.id,
      variantLabel: selectionLabel || undefined,
    }, qtyToAdd);
    if (mode === "buy") navigate("/checkout");
    else toast.success(qtyToAdd < qty ? `Added ${qtyToAdd} (stock limit)` : "Added to cart");
  };

  const shareProduct = async () => {
    if (navigator.share) {
      await navigator.share({ title: product.name, url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Product link copied");
  };

  const optionImage = (optionName: string, value: string) => {
    if (!/colou?r/i.test(optionName)) return null;
    return colorChoiceImageUrl(optionName, value, variants, product.product_images || []);
  };

  const scrollToReviews = () => {
    const section = document.getElementById("reviews-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <MarketplaceLayout>
      <SEO
        title={`${product.name} — ${vendor?.store_name ?? "Barakaz"}`}
        description={product.description || `Buy ${product.name} on Barakaz.`}
        canonicalPath={`/product/${product.slug}`}
        image={galleryImages[0]}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          image: galleryImages.filter((url: string) => url && !url.includes("barakaz-icon")),
          description: product.description || undefined,
          sku: product.sku || product.id,
          brand: vendor?.store_name ? { "@type": "Brand", name: vendor.store_name } : undefined,
          offers: {
            "@type": "Offer",
            url: `${SITE_URL}/product/${product.slug}`,
            priceCurrency: "CAD",
            price: Number(displayPrice),
            availability: (displayStock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: vendor?.store_name ? { "@type": "Organization", name: vendor.store_name } : undefined,
          },
          aggregateRating: reviewStats.count > 0 ? { "@type": "AggregateRating", ratingValue: reviewStats.avg.toFixed(2), reviewCount: reviewStats.count } : undefined,
        }}
      />

      <div className="border-b border-border bg-card">
        <div className="container py-2.5">
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap overflow-hidden text-xs">
              <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
              {product.categories ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/search?category=${product.categories.slug}`}>{product.categories.name}</Link></BreadcrumbLink></BreadcrumbItem>
                </>
              ) : null}
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="block truncate">{product.name}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

       <main className="bg-card pb-8 md:bg-muted/30 md:pt-4">
         <div className="container space-y-2 px-2 md:space-y-3 md:px-4">
           <section className="grid grid-cols-1 items-start gap-3 bg-card p-2 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] sm:gap-4 md:grid-cols-[minmax(0,1.04fr)_minmax(400px,.96fr)] md:gap-6 md:p-4" aria-label="Product purchase information">
            <ProductGallery
              images={galleryImages}
              videoUrl={product.video_url}
              productName={product.name}
              discountPercent={discountPct}
              wished={wished}
              onToggleWishlist={() => toggleWishlist.mutate(product.id)}
            />

             <div className="min-w-0 space-y-1.5 md:space-y-3">
              {vendor ? (
                <Link to={`/store/${vendor.slug ?? vendor.id}`} className="block truncate text-[10px] font-semibold text-primary hover:underline md:text-sm">
                  Sold by {vendor.store_name}
                </Link>
              ) : null}
               <h1 className="line-clamp-5 text-[11px] font-bold leading-snug text-foreground sm:text-sm md:text-2xl">{product.name}</h1>

              <div className="flex flex-wrap items-center gap-1 text-[10px] md:gap-2 md:text-sm">
                <RatingStars rating={displayStats.rating} />
                <Button type="button" variant="link" className="h-auto p-0" onClick={scrollToReviews}>
                  {displayStats.rating.toFixed(1)} · {displayStats.reviewCount} {displayStats.reviewCount === 1 ? "review" : "reviews"}
                </Button>
                <span className="text-muted-foreground">· {displayStats.soldCount} sold</span>
                <Button type="button" size="sm" variant="ghost" className="ml-auto hidden h-7 px-2 text-xs md:inline-flex" onClick={() => void shareProduct()}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>

              <Separator className="hidden md:block" />

              {product.deal_ends_at && new Date(product.deal_ends_at).getTime() > Date.now() ? <CountdownTimer endsAt={product.deal_ends_at} /> : null}

               <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">{formatPrice(Number(displayPrice))}</p>
                {discountPct && displayCompare ? (
                  <>
                    <span className="text-base font-medium text-muted-foreground line-through md:text-lg">{formatPrice(Number(displayCompare))}</span>
                    <Badge variant="destructive" className="h-6 px-2 text-xs">Save {discountPct}%</Badge>
                  </>
                ) : null}
              </div>

              <p className={cn("flex items-center gap-1 text-[10px] font-semibold md:text-sm", purchase.canBuy ? "text-success" : "text-destructive")}>
                {purchase.canBuy ? <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" /> : null}
                {purchase.canBuy ? "In stock" : purchaseMessage(purchase)}
              </p>

              {hasVariants ? (
                <div className="space-y-2 border-y border-border py-2 md:space-y-3 md:py-3">
                  {Object.entries(optionTypes).map(([optionName, values]) => (
                    <fieldset key={optionName}>
                       <legend className="mb-1 text-[10px] font-bold md:mb-2 md:text-sm">
                        {optionName}: <span className="font-normal text-muted-foreground">{selectedOptions[optionName] ?? "Choose an option"}</span>
                      </legend>
                       <div className="flex flex-wrap gap-1 md:gap-2">
                        {values.map((value) => {
                          const selected = selectedOptions[optionName] === value;
                          const available = isOptionValueAvailable(variants as any, selectedOptions, optionName, value);
                          const image = optionImage(optionName, value);
                          return (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              disabled={!available}
                              aria-pressed={selected}
                              onClick={() => setSelectedOptions((current) => ({ ...current, [optionName]: value }))}
                               className={cn(
                                 "h-auto min-h-7 rounded-sm px-1.5 py-1 text-[9px] md:min-h-9 md:px-2.5 md:py-1.5 md:text-sm",
                                selected && "border-2 border-primary bg-primary/5 text-primary",
                                !available && "line-through",
                              )}
                            >
                               {image ? <img src={image} alt="" className="h-6 w-6 border border-border object-cover md:h-8 md:w-8" /> : null}
                              {value}
                            </Button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  {isClothing ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="link" className="h-auto p-0"><Ruler className="h-4 w-4" /> Size guide <ChevronDown className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xl">
                        <DialogHeader><DialogTitle>Size guide</DialogTitle></DialogHeader>
                        <p className="text-sm text-muted-foreground">Use the seller's listed measurements in the product description and compare them with an item that fits you well. Measurements may vary by product.</p>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center gap-1.5 md:gap-3">
                <span className="text-[10px] font-bold md:text-sm">Quantity</span>
                <div className="flex h-8 items-center border border-border md:h-10" role="group" aria-label="Quantity">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-none md:h-9 md:w-9" aria-label="Decrease quantity" disabled={!purchase.canBuy || qty <= 1} onClick={() => setQty((current) => clampQuantity(current - 1, purchase.maxQty))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center text-[10px] font-bold md:w-10 md:text-sm" aria-live="polite">{qty}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-none md:h-9 md:w-9" aria-label="Increase quantity" disabled={!purchase.canBuy || qty >= purchase.maxQty} onClick={() => setQty((current) => clampQuantity(current + 1, purchase.maxQty))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {purchase.canBuy ? <span className="hidden text-xs text-muted-foreground sm:inline">Maximum {purchase.maxQty}</span> : null}
              </div>
            </div>

             <div className="col-span-full grid grid-cols-2 gap-2 pt-1">
              <Button type="button" size="lg" variant="outline" className="border-primary font-bold text-primary hover:bg-primary/5 hover:text-primary" onClick={() => handlePurchase("cart")}>
                <ShoppingCart className="h-5 w-5" /> Add to cart
              </Button>
              <Button type="button" size="lg" className="font-bold" onClick={() => handlePurchase("buy")}>Buy now</Button>
            </div>

             <section className="col-span-full border border-border bg-card" aria-labelledby="delivery-heading">
                 <div className="border-b border-border px-3 py-2">
                  <h2 id="delivery-heading" className="flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4 text-primary" /> Delivery to your address</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Choose a delivery option. The final quote is confirmed at checkout.</p>
                </div>
                <RadioGroup
                  value={selectedDelivery}
                  onValueChange={(value) => {
                    const service = value as DeliveryService;
                    setSelectedDelivery(service);
                    saveDeliveryPreference(product.vendor_id, service);
                  }}
                  className="divide-y divide-border px-3"
                  aria-label="Delivery option"
                >
                  {deliveryOptions.map((option) => {
                    const selected = selectedDelivery === option.service;
                    return (
                      <label
                        key={option.service}
                        htmlFor={`delivery-${option.service}`}
                        className={cn(
                           "-mx-3 grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors",
                          selected ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/40",
                        )}
                      >
                        <RadioGroupItem id={`delivery-${option.service}`} value={option.service} />
                        <div>
                          <p className="font-semibold">{option.label}</p>
                          <p className="text-xs font-medium text-success">Estimated delivery {option.arrival}</p>
                        </div>
                        <span className="font-bold">{option.price}</span>
                      </label>
                    );
                  })}
                </RadioGroup>
                 <div className="flex gap-4 border-t border-border px-3 py-2 text-xs">
                  <Link to="/delivery" className="font-semibold text-primary hover:underline">Delivery details</Link>
                  <Link to="/return-policy" className="font-semibold text-primary hover:underline">7-day return policy</Link>
                </div>
              </section>

             {vendor ? <div className="col-span-full"><SellerCard vendor={vendor} /></div> : null}
             <div className="col-span-full"><TrustStrip /></div>
          </section>

          <ProductDescriptionTabs
            description={product.description}
            productId={product.id}
            reviewCount={displayStats.reviewCount}
            reviewRating={displayStats.rating}
            meta={{
              name: product.name,
              category: product.categories?.name,
              stock: displayStock,
              low_stock_threshold: product.low_stock_threshold,
              vendor_name: vendor?.store_name,
              sku: product.sku,
              condition: product.condition,
              brand: product.brand,
              mpn: product.mpn,
              weight_g: product.weight_g,
              length_cm: product.length_cm,
              width_cm: product.width_cm,
              height_cm: product.height_cm,
              option_values: optionTypes,
              specifications: (product as any).specifications ?? [],
              key_features: product.key_features,
              whats_in_box: product.whats_in_box,
            }}
          />

          <RelatedProducts categoryId={product.category_id} currentProductId={product.id} />
           <div className="h-20 md:hidden" />
        </div>
      </main>

       <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-border bg-card/95 px-2.5 py-2 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist.mutate(product.id)}>
            <Heart className={cn("h-5 w-5", wished && "fill-primary text-primary")} />
          </Button>
           <Button type="button" variant="outline" className="h-11 flex-1 border-primary font-bold text-primary" onClick={() => handlePurchase("cart")}><ShoppingCart className="h-4 w-4" /> Add to cart</Button>
          <Button type="button" className="h-11 flex-1 font-bold" onClick={() => handlePurchase("buy")}>Buy now</Button>
        </div>
      </div>

    </MarketplaceLayout>
  );
};

const RelatedProducts = ({ categoryId, currentProductId }: { categoryId: string | null; currentProductId: string }) => {
  const { data: related = [] } = useQuery({
    queryKey: ["related-products", categoryId, currentProductId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(url, position), vendors(store_name, status)")
        .eq("status", "active")
        .eq("category_id", categoryId)
        .neq("id", currentProductId)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(categoryId),
  });

  if (!related.length) return null;
  return (
    <section className="bg-card p-4 md:p-5" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-4 text-xl font-bold">Related products</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {related.map((item: any) => {
          const images = (item.product_images || []).sort((a: any, b: any) => a.position - b.position);
          return (
            <ProductCard
              key={item.id}
              id={item.id}
              name={item.name}
              slug={item.slug}
              price={item.price}
              compareAtPrice={item.compare_at_price}
              image={images[0]?.url || "/placeholder.svg"}
              vendorId={item.vendor_id}
              vendorName={item.vendors?.store_name || ""}
              dealEndsAt={item.deal_ends_at}
              stock={item.stock}
              handlingTimeDays={item.handling_time_days}
              verifiedSeller={item.vendors?.status === "approved"}
            />
          );
        })}
      </div>
    </section>
  );
};

export default ProductDetailPage;
