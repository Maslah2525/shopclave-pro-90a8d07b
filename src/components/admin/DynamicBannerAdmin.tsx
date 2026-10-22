import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, LayoutGrid, Store, Tag, Link2, ImagePlus, X, Pencil, Copy, Trash2 } from "lucide-react";
import { CategoryPicker, useCategoryAncestors } from "@/components/shared/CategoryPicker";
import { toast } from "sonner";

const placements = ["featured_products_banner", "sponsored_products_banner", "category_promotion", "flash_sale_banner", "homepage_full_width", "homepage_secondary"] as const;
const recommendedDimensions = (placement: string) => placement === "homepage_full_width" ? { desktop: { w: 1920, h: 600 }, mobile: { w: 750, h: 900 } } : { desktop: { w: 1600, h: 400 }, mobile: { w: 750, h: 500 } };
const ratio = (w: number, h: number) => { const g = (a: number, b: number): number => b ? g(b, a % b) : a; const d = g(w, h); return `${w / d} : ${h / d}`; };
const defaults = { placement: placements[0] as string, title: "", subtitle: "", cta_label: "Shop now", link_url: "/", image_url: "", desktop_image_url: "", mobile_image_url: "", banner_mode: "image", animation_type: "fade", transition_duration_ms: 700, rotation_interval_ms: 5000, background_color: "#1f2937", background_gradient: "", is_active: false, starts_at: "", ends_at: "", display_order: 0, target_device: "all", animation_config: { pause_on_hover: true, show_arrows: true, show_dots: true, enable_swipe: true } as Record<string, boolean> };
type Form = typeof defaults;
const dateInput = (date: string | null) => {
  if (!date) return "";
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const bannerStatus = (row: any) => {
  if (!row.is_active) return "Inactive";
  const now = Date.now();
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return "Expired";
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return "Scheduled";
  return "Active";
};
const safeLink = (link: string) => (link.startsWith("/") && !link.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(link);

const steps = [
  { n: 1, label: "Banner Details", id: "db-step-details" },
  { n: 2, label: "Images", id: "db-step-images" },
  { n: 3, label: "Link & Targeting", id: "db-step-link" },
  { n: 4, label: "Animation & Style", id: "db-step-animation" },
  { n: 5, label: "Scheduling", id: "db-step-scheduling" },
  { n: 6, label: "Preview", id: "db-step-preview" },
];

const linkTypes = [
  { value: "product", label: "Product", icon: ShoppingBag },
  { value: "category", label: "Category", icon: LayoutGrid },
  { value: "store", label: "Store", icon: Store },
  { value: "brand", label: "Brand", icon: Tag },
  { value: "custom", label: "Custom URL", icon: Link2 },
] as const;
type LinkType = typeof linkTypes[number]["value"];
const linkTypeFromUrl = (url: string): LinkType => {
  if (/^\/product\//.test(url)) return "product";
  if (/^\/category\//.test(url)) return "category";
  if (/^\/store\//.test(url)) return "store";
  if (/^\/search\?q=/.test(url)) return "brand";
  return "custom";
};

type PickerItem = { id: string; label: string; sub?: string; url: string };
function SearchPicker({ placeholder, fetcher, onPick }: { placeholder: string; fetcher: (term: string) => Promise<PickerItem[]>; onPick: (item: PickerItem) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    const timer = setTimeout(async () => {
      try { setResults(await fetcher(term.trim())); } catch { setResults([]); } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);
  return <div className="space-y-2">
    <Input value={term} onChange={e => setTerm(e.target.value)} placeholder={placeholder} />
    {busy && <p className="text-xs text-muted-foreground">Searching…</p>}
    {results.length > 0 && <div className="rounded-md border divide-y bg-card max-h-48 overflow-auto">
      {results.map(r => <button key={r.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted" onClick={() => { onPick(r); setTerm(""); setResults([]); }}>
        <span className="block text-sm font-medium">{r.label}</span>
        {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
      </button>)}
    </div>}
  </div>;
}

/** Cascading category picker that resolves the picked leaf to its URL. */
function CategoryLinkPicker({ onPick }: { onPick: (item: PickerItem) => void }) {
  const [id, setId] = useState("");
  const { data: ancestors = [] } = useCategoryAncestors(id || null);
  const lastPicked = useRef("");
  useEffect(() => {
    const leaf = ancestors[ancestors.length - 1];
    if (leaf && lastPicked.current !== leaf.id) {
      lastPicked.current = leaf.id;
      onPick({ id: leaf.id, label: ancestors.map(a => a.name).join(" › "), url: `/category/${leaf.slug}` });
    }
  }, [ancestors, onPick]);
  return <CategoryPicker value={id} onChange={setId} showBreadcrumb={false} />;
}

const Section = ({ n, title, id, children, action }: { n: number; title: string; id: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <Card id={id} className="scroll-mt-4"><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{n}</span>{title}</h4>
        {action}
      </div>
      {children}
    </CardContent></Card>
  );


export default function DynamicBannerAdmin({ variant = "dynamic" }: { variant?: "dynamic" | "hero" } = {}) {
  const isHero = variant === "hero";
  const table = isHero ? "hero_banners" : "promotions";
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...defaults });
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeStep, setActiveStep] = useState(1);
  const [linkType, setLinkType] = useState<LinkType>("custom");
  const [linkTarget, setLinkTarget] = useState("");
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-dynamic-banners", variant],
    queryFn: async () => {
      const base = (supabase.from(table) as any).select("*");
      const { data, error } = await (isHero ? base : base.in("placement", [...placements])).order("display_order");
      if (error) throw error;
      return data || [];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-dynamic-banners"] });
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    qc.invalidateQueries({ queryKey: ["dynamic-banner-placement"] });
    qc.invalidateQueries({ predicate: q => String(q.queryKey[0] ?? "").includes("hero") });
  };
  const update = (key: keyof Form, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const resetForm = () => { setEditing(null); setForm({ ...defaults }); setLinkType("custom"); setLinkTarget(""); setActiveStep(1); };
  const edit = (row: any) => {
    setEditing(row.id);
    const next = { ...defaults, animation_config: { ...defaults.animation_config, ...(row.animation_config || {}) }, ...Object.fromEntries(Object.keys(defaults).map(key => [key, row[key] ?? (defaults as any)[key]]).filter(([k]) => k !== "animation_config")), starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) } as Form;
    setForm(next);
    setLinkType(linkTypeFromUrl(next.link_url || "/"));
    setLinkTarget("");
    setActiveStep(1);
    setShowForm(true);
  };
  const upload = async (file: File, field: "desktop_image_url" | "mobile_image_url") => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error("Upload JPG, PNG or WebP images up to 2 MB."); return;
    }
    setUploading(true);
    try {
      const path = `banners/${isHero ? "hero" : "dynamic"}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "webp"}`;
      const { error } = await supabase.storage.from("marketing-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      update(field, supabase.storage.from("marketing-assets").getPublicUrl(path).data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };
  const save = useMutation({
    mutationFn: async () => {
      const bannerName = String((form.animation_config as any).banner_name ?? "").trim();
      if (!bannerName && !form.title.trim()) throw new Error("Enter a banner name.");
      if (linkType !== "custom" && form.link_url === "/") throw new Error("Choose what this banner links to.");
      if (!safeLink(form.link_url)) throw new Error("Use a relative path or an HTTPS URL.");
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) throw new Error("End date must be after start date.");
      if (form.banner_mode === "image" && !form.desktop_image_url) throw new Error("Upload a desktop image.");
      const { starts_at, ends_at, ...rest } = form;
      const heroPayload = { title: form.title.trim() || null, subtitle: form.subtitle || null, cta_label: form.cta_label || null, link_url: form.link_url, desktop_image_url: form.desktop_image_url, mobile_image_url: form.mobile_image_url || null, banner_mode: "image", animation_type: form.animation_type, transition_duration_ms: form.transition_duration_ms, rotation_interval_ms: form.rotation_interval_ms, background_color: form.background_color, background_gradient: form.background_gradient?.trim() || null, animation_config: form.animation_config, is_active: form.is_active, display_order: form.display_order, target_device: form.target_device, starts_at: starts_at ? new Date(starts_at).toISOString() : null, ends_at: ends_at ? new Date(ends_at).toISOString() : null };
      const payload = isHero ? heroPayload : { ...rest, title: form.title.trim() || bannerName, kind: "brand", image_url: form.banner_mode === "dynamic" ? "/favicon.ico" : form.desktop_image_url, desktop_image_url: form.banner_mode === "dynamic" ? null : form.desktop_image_url || null, mobile_image_url: form.banner_mode === "dynamic" ? null : form.mobile_image_url || null, background_gradient: form.background_gradient?.trim() || null, starts_at: starts_at ? new Date(starts_at).toISOString() : null, ends_at: ends_at ? new Date(ends_at).toISOString() : null };
      const query = editing ? (supabase.from(table) as any).update(payload).eq("id", editing) : (supabase.from(table) as any).insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setShowForm(false); resetForm(); toast.success("Banner saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await (supabase.from(table) as any).update({ is_active: !row.is_active }).eq("id", row.id);
      if (error) throw error;
    }, onSuccess: refresh, onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(table) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Banner deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: async (row: any) => {
      const { id, created_at, updated_at, ...rest } = row;
      const { error } = await (supabase.from(table) as any).insert({
        ...rest, title: `${row.title} (Copy)`, is_active: false,
        starts_at: null, ends_at: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Inactive copy created"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const move = useMutation({
    mutationFn: async ({ row, direction }: { row: any; direction: number }) => {
      const peers = rows.filter((item: any) => item.placement === row.placement);
      const position = peers.findIndex((item: any) => item.id === row.id);
      const other = peers[position + direction];
      if (!other) return;
      const firstOrder = Number(row.display_order ?? 0);
      const secondOrder = Number(other.display_order ?? 0);
      const nextOrder = firstOrder === secondOrder ? position : secondOrder;
      const { error: firstError } = await (supabase.from(table) as any).update({ display_order: nextOrder }).eq("id", row.id);
      if (firstError) throw firstError;
      const { error: secondError } = await (supabase.from(table) as any).update({ display_order: firstOrder === secondOrder ? position + direction : firstOrder }).eq("id", other.id);
      if (secondError) throw secondError;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const searchProducts = async (term: string): Promise<PickerItem[]> => {
    const { data, error } = await (supabase.from("products") as any).select("id,name,slug,price").eq("status", "active").ilike("name", `%${term}%`).limit(6);
    if (error) throw error;
    return (data || []).map((p: any) => ({ id: p.id, label: p.name, sub: p.price != null ? `CA$${p.price}` : undefined, url: `/product/${p.slug}` }));
  };
  const searchStores = async (term: string): Promise<PickerItem[]> => {
    const { data, error } = await (supabase.from("vendors") as any).select("id,store_name,slug").ilike("store_name", `%${term}%`).limit(6);
    if (error) throw error;
    return (data || []).map((v: any) => ({ id: v.id, label: v.store_name || "Unnamed store", url: `/store/${v.slug ?? v.id}` }));
  };
  const pickLink = (item: PickerItem) => { update("link_url", item.url); setLinkTarget(item.label); };
  const goToStep = (n: number, id: string) => { setActiveStep(n); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const dims = isHero ? { desktop: { w: 1920, h: 600 }, mobile: { w: 750, h: 500 } } : recommendedDimensions(form.placement);

  const imageCard = (field: "desktop_image_url" | "mobile_image_url", label: string, required: boolean, dim: { w: number; h: number }, maxMb: number, inputRef: React.RefObject<HTMLInputElement | null>) => (
    <div className="space-y-2 min-w-0">
      <Label>{label} {required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}</Label>
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) upload(file, field); }}
        className="w-full rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 px-3 py-4 text-center transition-colors">
        <ImagePlus className="h-7 w-7 mx-auto text-primary" />
        <p className="mt-1 text-xs"><span className="text-primary font-medium">Click to upload</span> or drag and drop</p>
        <p className="text-[11px] text-muted-foreground">Recommended size: {dim.w} × {dim.h} px</p>
        <p className="text-[11px] text-muted-foreground">Format: JPG, PNG, WebP</p>
        <p className="text-[11px] text-muted-foreground">Max file size: {maxMb} MB</p>
      </button>
      {form[field] && <>
        <img src={form[field]} alt={`${label} preview`} className={`mx-auto object-cover rounded border ${field === "mobile_image_url" ? "w-2/3 aspect-[3/2]" : "w-full aspect-[16/5]"}`} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>Change image</Button>
          <Button type="button" size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => update(field, "")}>Remove</Button>
        </div>
      </>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
        onChange={e => { const file = e.target.files?.[0]; if (file) upload(file, field); e.target.value = ""; }} />
    </div>
  );

  const statusBadge = (row: any) => {
    const s = bannerStatus(row);
    const cls = s === "Active" ? "bg-success/15 text-success" : s === "Scheduled" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground";
    return <button type="button" onClick={() => toggle.mutate(row)} title="Click to toggle active" className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${cls}`}>● {s}</button>;
  };
  const shortDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : null;
  const previewImg = (device: "desktop" | "mobile") => form.banner_mode !== "image" ? "" : device === "mobile" ? form.mobile_image_url || form.desktop_image_url : form.desktop_image_url;
  const textColor = String((form.animation_config as any).text_color || "#ffffff");
  const previewText = (mobile: boolean) => <div style={{ color: /^#[\da-fA-F]{3,8}$/.test(textColor) ? textColor : undefined }} className={`relative z-10 min-w-0 max-w-[60%] text-white drop-shadow-lg break-words [overflow-wrap:anywhere] ${mobile ? "p-3" : "p-6"}`}>
    <h3 className={`font-bold leading-tight ${mobile ? "text-base" : "text-3xl"}`}>{form.title || "Your headline"}</h3>
    {form.subtitle && <p className={`${mobile ? "text-[10px]" : "text-sm"} mt-1`}>{form.subtitle}</p>}
    {form.cta_label && <span className={`inline-block bg-primary text-primary-foreground rounded font-semibold ${mobile ? "mt-2 px-2 py-1 text-[10px]" : "mt-4 px-4 py-2 text-sm"}`}>{form.cta_label} →</span>}
  </div>;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return <div className="space-y-4">
    <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">Marketing <span className="mx-1">›</span> {isHero ? "Hero Banners" : "Dynamic Banners"} <span className="mx-1">›</span> <span className="font-semibold text-foreground">{editing ? "Edit Banner" : isHero ? "New Hero Banner" : "New Banner"}</span></nav>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <Section n={1} title="Banner Details" id="db-step-details">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Banner name <span className="text-destructive">*</span></Label><Input value={(form.animation_config as any).banner_name ?? form.title} onChange={e => update("animation_config", { ...form.animation_config, banner_name: e.target.value })} placeholder="e.g. Fashion Winter Collection Banner" /></div>
            <div className="space-y-1.5"><Label>Placement <span className="text-destructive">*</span></Label>{isHero ? <Input value="Homepage Hero Banner" disabled /> : <Select value={form.placement} onValueChange={v => update("placement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placements.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>}</div>
          </div>
          <div className="space-y-1.5"><Label>Status</Label>
            <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} /><span className="text-sm font-medium">{form.is_active ? "Active" : "Inactive"}</span><span className="text-xs text-muted-foreground">Banner will be visible on the selected placement</span></div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Headline (optional)</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Subtitle (optional)</Label><Input value={form.subtitle} onChange={e => update("subtitle", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>CTA label (optional)</Label><Input value={form.cta_label} onChange={e => update("cta_label", e.target.value)} /></div>
          </div>
        </Section>
        <Section n={2} title="Images" id="db-step-images">
          {!isHero && <div className="space-y-1.5"><Label>Banner mode</Label><Select value={form.banner_mode} onValueChange={v => update("banner_mode", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image banner</SelectItem><SelectItem value="dynamic">Text / colour composition</SelectItem></SelectContent></Select></div>}
          {form.banner_mode === "image" && <div className="grid sm:grid-cols-2 gap-4">
            {imageCard("desktop_image_url", "Desktop image", true, dims.desktop, 2, desktopInput)}
            {imageCard("mobile_image_url", "Mobile image", false, dims.mobile, isHero ? 1 : 2, mobileInput)}
          </div>}
        </Section>
        <Section n={3} title="Link & Targeting" id="db-step-link">
          <div className="space-y-1.5">
            <Label>Link type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {linkTypes.map(t => <button key={t.value} type="button" onClick={() => { setLinkType(t.value); setLinkTarget(""); update("link_url", "/"); }}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors ${linkType === t.value ? "border-primary text-primary bg-primary/5" : "text-foreground hover:bg-muted"}`}>
                <t.icon className="h-4 w-4" />{t.label}
              </button>)}
            </div>
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 items-start">
            <div className="space-y-1.5 min-w-0">
              {linkType === "product" && <><Label>Search and select product <span className="text-destructive">*</span></Label><SearchPicker placeholder="Type a product name…" fetcher={searchProducts} onPick={pickLink} /></>}
              {linkType === "category" && <><Label>Select category <span className="text-destructive">*</span></Label><CategoryLinkPicker key={linkType} onPick={pickLink} /></>}
              {linkType === "store" && <><Label>Search and select store <span className="text-destructive">*</span></Label><SearchPicker placeholder="Type a store name…" fetcher={searchStores} onPick={pickLink} /></>}
              {linkType === "brand" && <><Label>Brand name <span className="text-destructive">*</span></Label><Input placeholder="e.g. Samsung" onChange={e => { const v = e.target.value.trim(); setLinkTarget(v); update("link_url", v ? `/search?q=${encodeURIComponent(v)}` : "/"); }} /></>}
              {linkType === "custom" && <><Label>Destination URL <span className="text-destructive">*</span></Label><Input value={form.link_url} onChange={e => update("link_url", e.target.value)} placeholder="/search or https://..." /></>}
              {linkTarget && <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span className="font-medium truncate">{linkTarget}</span><button type="button" aria-label="Clear link target" onClick={() => { setLinkTarget(""); update("link_url", "/"); }}><X className="h-4 w-4" /></button></div>}
            </div>
            <div className="space-y-1.5"><Label>Target device <span className="text-destructive">*</span></Label><Select value={form.target_device} onValueChange={v => update("target_device", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All devices</SelectItem><SelectItem value="desktop">Desktop only</SelectItem><SelectItem value="mobile">Mobile only</SelectItem></SelectContent></Select></div>
          </div>
          {form.link_url !== "/" && <p className="rounded-md bg-primary/5 px-3 py-2 text-xs">ⓘ This banner will link to the selected {linkTypes.find(t => t.value === linkType)?.label.toLowerCase()} page <span className="text-muted-foreground">({form.link_url})</span>.</p>}
        </Section>
        <Section n={4} title="Animation & Style" id="db-step-animation">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Animation type</Label><Select value={form.animation_type} onValueChange={v => update("animation_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["none", "fade", "slide", "zoom", "float"].map(a => <SelectItem key={a} value={a} className="capitalize">{a[0].toUpperCase() + a.slice(1)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Transition speed (ms)</Label><Input type="number" min={100} max={3000} value={form.transition_duration_ms} onChange={e => update("transition_duration_ms", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Rotation time (ms)</Label><Input type="number" min={2000} max={30000} value={form.rotation_interval_ms} onChange={e => update("rotation_interval_ms", Number(e.target.value))} /></div>
          </div>
          {isHero && <div className="flex flex-wrap gap-x-5 gap-y-2">
            {([["pause_on_hover", "Pause on hover (desktop)"], ["show_arrows", "Show navigation arrows"], ["show_dots", "Show dots indicator"], ["enable_swipe", "Enable swipe (mobile)"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-primary h-4 w-4" checked={!!form.animation_config[k]} onChange={e => update("animation_config", { ...form.animation_config, [k]: e.target.checked })} />{l}</label>)}
          </div>}
          <div className="grid sm:grid-cols-2 gap-4">
            {([["Background colour", form.background_color || "#ffffff", (v: string) => update("background_color", v)], ["Text colour", textColor, (v: string) => update("animation_config", { ...form.animation_config, text_color: v } as any)]] as const).map(([label, value, set]) => (
              <div key={label} className="space-y-2 rounded-lg border p-3">
                <Label>{label}</Label>
                <div className="flex items-center gap-2">
                  <label className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 border-border shadow-sm" style={{ backgroundColor: value }}>
                    <input type="color" aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={/^#[\da-fA-F]{6}$/.test(value) ? value : "#ffffff"} onChange={e => set(e.target.value)} />
                  </label>
                  <Input className="h-10" value={value} onChange={e => set(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["#ffffff", "#000000", "#ff420e", "#dc2626", "#2563eb", "#16a34a", "#facc15", "#7c3aed"].map(c => (
                    <button key={c} type="button" aria-label={`${label} ${c}`} onClick={() => set(c)} className={`h-7 w-7 rounded-full border-2 ${value.toLowerCase() === c ? "border-primary ring-2 ring-primary/40" : "border-border"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section n={5} title="Scheduling" id="db-step-scheduling">
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5"><Label>Start date &amp; time (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={e => update("starts_at", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End date &amp; time (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={e => update("ends_at", e.target.value)} /></div>
            <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">Banner will be active from<br /><b>{form.starts_at ? fmt(form.starts_at) : "now"} to {form.ends_at ? fmt(form.ends_at) : "no end date"}</b></div>
          </div>
        </Section>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => resetForm()}>Cancel</Button>
          <Button disabled={save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending ? "Saving..." : "Save Banner"}</Button>
        </div>
      </div>
      <div className="space-y-4 min-w-0">
        <Section n={6} title="Live Preview" id="db-step-preview">
          <div className="inline-flex rounded-md border overflow-hidden">
            {(["desktop", "mobile"] as const).map(d => <button key={d} type="button" onClick={() => setPreviewDevice(d)} className={`px-10 py-1.5 text-sm font-medium ${previewDevice === d ? "bg-primary text-primary-foreground" : "bg-card"}`}>{d === "desktop" ? "Desktop View" : "Mobile View"}</button>)}
          </div>
          {previewDevice === "desktop" && <>
            <div className="relative overflow-hidden rounded-lg aspect-[16/7] flex items-center" style={{ backgroundColor: form.background_color }}>
              {previewImg("desktop") && <img className="absolute inset-0 w-full h-full object-cover" src={previewImg("desktop")} alt="Desktop banner preview" />}
              {previewText(false)}
            </div>
            <div className="flex items-center justify-between">
              {form.animation_config.show_arrows !== false ? <span className="flex h-7 w-7 items-center justify-center rounded-full border">‹</span> : <span />}
              {form.animation_config.show_dots !== false && <div className="flex gap-1.5">{[0, 1, 2, 3].map(i => <span key={i} className={`h-2 w-2 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />)}</div>}
              {form.animation_config.show_arrows !== false ? <span className="flex h-7 w-7 items-center justify-center rounded-full border">›</span> : <span />}
            </div>
          </>}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium mb-2">Preview on Mobile</p>
            <div className="mx-auto w-56 rounded-[2rem] border-[6px] border-foreground bg-foreground overflow-hidden">
              <div className="relative overflow-hidden rounded-[1.5rem] aspect-[4/5] flex items-center" style={{ backgroundColor: form.background_color }}>
                {previewImg("mobile") && <img className="absolute inset-0 w-full h-full object-cover" src={previewImg("mobile")} alt="Mobile banner preview" />}
                {previewText(true)}
              </div>
            </div>
          </div>
        </Section>
        <Section n={7} title="Existing Banners" id="db-step-existing" action={<Button size="sm" onClick={() => { resetForm(); document.getElementById("db-step-details")?.scrollIntoView({ behavior: "smooth" }); }}>+ Add New Banner</Button>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead><tr className="text-left border-b text-muted-foreground">{["#", "Banner", "Name", "Placement", "Status", "Schedule", "Order", "Actions"].map(l => <th key={l} className="p-2 font-medium">{l}</th>)}</tr></thead>
              <tbody>{rows.map((row: any, i: number) => <tr key={row.id} className="border-b last:border-0">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{row.banner_mode !== "dynamic" && (row.desktop_image_url || row.image_url) ? <img src={row.desktop_image_url || row.image_url} alt="" className="w-12 h-8 object-cover rounded" /> : <div className="w-12 h-8 rounded" style={{ backgroundColor: row.background_color || "#1f2937" }} />}</td>
                <td className="p-2 font-medium max-w-28">{row.animation_config?.banner_name || row.title || "Untitled"}</td>
                <td className="p-2 capitalize">{row.placement ? row.placement.replace(/_/g, " ") : "Homepage Hero"}</td>
                <td className="p-2">{statusBadge(row)}</td>
                <td className="p-2 whitespace-nowrap">{row.starts_at || row.ends_at ? `${shortDate(row.starts_at) ?? "Now"} – ${shortDate(row.ends_at) ?? "No end"}` : "Not set"}</td>
                <td className="p-2 whitespace-nowrap"><button type="button" className="px-1 hover:text-primary" onClick={() => move.mutate({ row, direction: -1 })} aria-label="Move up">↑</button><button type="button" className="px-1 hover:text-primary" onClick={() => move.mutate({ row, direction: 1 })} aria-label="Move down">↓</button></td>
                <td className="p-2 whitespace-nowrap">
                  <button type="button" className="p-1 hover:text-primary" aria-label="Edit" onClick={() => { edit(row); document.getElementById("db-step-details")?.scrollIntoView({ behavior: "smooth" }); }}><Pencil className="h-4 w-4" /></button>
                  <button type="button" className="p-1 hover:text-primary" aria-label="Duplicate" disabled={duplicate.isPending} onClick={() => duplicate.mutate(row)}><Copy className="h-4 w-4" /></button>
                  <button type="button" className="p-1 text-destructive" aria-label="Delete" disabled={remove.isPending} onClick={() => { if (window.confirm(`Permanently delete banner "${row.animation_config?.banner_name || row.title}"?`)) remove.mutate(row.id); }}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <p className="p-3 text-muted-foreground text-sm">{isHero ? "No hero banners yet." : "No dynamic banners yet."}</p>}
          </div>
        </Section>
      </div>
    </div>
  </div>;
}
