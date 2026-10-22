import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Placement = "featured_products_banner" | "sponsored_products_banner" | "category_promotion" | "flash_sale_banner" | "homepage_full_width" | "homepage_secondary";
type Banner = {
  id: string; title: string | null; subtitle: string | null;
  image_url: string | null; desktop_image_url: string | null; mobile_image_url: string | null;
  link_url: string | null; cta_label: string | null; animation_type: string | null;
  transition_duration_ms: number | null; rotation_interval_ms: number | null;
  background_color: string | null; background_gradient: string | null;
  banner_mode: string | null; target_device: string | null;
};

const safeLink = (value: string | null) => {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
  } catch { /* ignore malformed destinations */ }
  return "/";
};

const background = (banner: Banner) => {
  const color = banner.background_color;
  const gradient = banner.background_gradient;
  if (gradient && /^linear-gradient\([\w\s,.%#()\-]+\)$/.test(gradient)) return { background: gradient };
  if (color && /^#[\da-fA-F]{3,8}$/.test(color)) return { backgroundColor: color };
  return {};
};

export default function DynamicBannerPlacement({ placement, compact = false }: { placement: Placement; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [device, setDevice] = useState<"mobile" | "desktop">(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop");
  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const update = () => setDevice(mq.matches ? "mobile" : "desktop"); mq.addEventListener("change", update); return () => mq.removeEventListener("change", update); }, []);
  const { data: banners = [] } = useQuery({
    queryKey: ["dynamic-banner-placement", placement],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase.from("promotions") as any)
        .select("id,title,subtitle,image_url,desktop_image_url,mobile_image_url,link_url,cta_label,animation_type,transition_duration_ms,rotation_interval_ms,background_color,background_gradient,banner_mode,target_device")
        .eq("placement", placement).eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Banner[];
    },
    refetchInterval: 60_000,
  });
  const eligible = banners.filter(b => !b.target_device || b.target_device === "all" || b.target_device === device);
  useEffect(() => { setIndex(0); }, [placement, device, banners.length]);
  const current = eligible[index % Math.max(eligible.length, 1)];
  useEffect(() => {
    if (eligible.length < 2) return;
    const interval = Math.max(2000, Math.min(30000, current?.rotation_interval_ms || 5000));
    const timer = window.setInterval(() => setIndex(i => (i + 1) % eligible.length), interval);
    return () => window.clearInterval(timer);
  }, [eligible.length, current?.rotation_interval_ms]);
  if (!current) return null;
  const animation = ["none", "fade", "slide", "zoom", "float"].includes(current.animation_type || "")
    ? current.animation_type : "fade";
  const duration = Math.max(100, Math.min(3000, current.transition_duration_ms || 700));
  const media = current.banner_mode === "dynamic" ? null : current.desktop_image_url || current.image_url;
  const mobile = current.mobile_image_url || media;
  const visible = "block";
  return (
    <section aria-label={placement.replace(/_/g, " ")} className={`container ${compact ? "pt-3 pb-1" : "py-5"} ${visible}`}>
      <Link to={safeLink(current.link_url)} className="block rounded-2xl overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div key={current.id} className={`relative min-h-44 md:min-h-56 flex items-center overflow-hidden dynamic-banner dynamic-banner--${animation}`}
          style={{ ...background(current), animationDuration: `${duration}ms` }}>
          {media && <picture className="absolute inset-0">
            {mobile && <source media="(max-width: 767px)" srcSet={mobile} />}
            <img src={media} alt={current.title || "Promotion"} loading="lazy" className="w-full h-full object-cover" />
          </picture>}
          {(current.title || current.subtitle || current.cta_label) && <div className="relative z-10 w-full min-w-0 max-w-[72%] md:max-w-xl px-4 py-5 sm:p-6 md:p-10 text-white drop-shadow-lg break-words [overflow-wrap:anywhere]">
            {current.title && <h2 className="text-base leading-tight sm:text-xl md:text-4xl md:leading-tight font-bold">{current.title}</h2>}
            {current.subtitle && <p className="mt-2 text-xs leading-snug sm:text-sm md:text-lg md:leading-normal">{current.subtitle}</p>}
            {current.cta_label && <span className="inline-block max-w-full mt-3 md:mt-4 bg-white text-gray-900 px-3 py-2 md:px-5 rounded-lg font-semibold text-xs sm:text-sm leading-snug drop-shadow-none whitespace-normal break-words">{current.cta_label}</span>}
          </div>}
        </div>
      </Link>
      {eligible.length > 1 && <div className="flex justify-center gap-2 mt-1" aria-label="Banner navigation">
        {eligible.map((banner, i) => <button key={banner.id} type="button" aria-label={`Show banner ${i + 1}`} aria-current={i === index ? "true" : undefined}
          onClick={() => setIndex(i)} className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-primary" : "bg-muted-foreground/30"}`} />)}
      </div>}
    </section>
  );
}
