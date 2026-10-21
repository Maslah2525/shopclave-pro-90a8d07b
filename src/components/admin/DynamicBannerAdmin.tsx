import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, LayoutGrid, Store, Tag, Link2, ImagePlus, X } from "lucide-react";
import { CategoryPicker, useCategoryAncestors } from "@/components/shared/CategoryPicker";
import { toast } from "sonner";

const placements = ["featured_products_banner", "sponsored_products_banner", "category_promotion", "flash_sale_banner", "homepage_full_width", "homepage_secondary"] as const;
const recommendedDimensions = (placement: string) => placement === "homepage_full_width" ? { desktop: { w: 1920, h: 600 }, mobile: { w: 750, h: 900 } } : { desktop: { w: 1600, h: 400 }, mobile: { w: 750, h: 500 } };
const ratio = (w: number, h: number) => { const g = (a: number, b: number): number => b ? g(b, a % b) : a; const d = g(w, h); return `${w / d} : ${h / d}`; };
const defaults = { placement: placements[0] as string, title: "", subtitle: "", cta_label: "Shop now", link_url: "/", image_url: "", desktop_image_url: "", mobile_image_url: "", banner_mode: "image", animation_type: "fade", transition_duration_ms: 700, rotation_interval_ms: 5000, background_color: "#1f2937", background_gradient: "", is_active: false, starts_at: "", ends_at: "", display_order: 0, target_device: "all" };
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

export default function DynamicBannerAdmin() {
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
    queryKey: ["admin-dynamic-banners"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("promotions") as any).select("*").in("placement", [...placements]).order("display_order");
      if (error) throw error;
      return data || [];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-dynamic-banners"] });
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    qc.invalidateQueries({ queryKey: ["dynamic-banner-placement"] });
  };
  const update = (key: keyof Form, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const resetForm = () => { setEditing(null); setForm({ ...defaults }); setLinkType("custom"); setLinkTarget(""); setActiveStep(1); };
  const edit = (row: any) => {
    setEditing(row.id);
    const next = { ...defaults, ...Object.fromEntries(Object.keys(defaults).map(key => [key, row[key] ?? (defaults as any)[key]])), starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) } as Form;
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
      const path = `banners/dynamic/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "webp"}`;
      const { error } = await supabase.storage.from("marketing-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      update(field, supabase.storage.from("marketing-assets").getPublicUrl(path).data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Enter a banner title.");
      if (linkType !== "custom" && form.link_url === "/") throw new Error("Choose what this banner links to.");
      if (!safeLink(form.link_url)) throw new Error("Use a relative path or an HTTPS URL.");
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) throw new Error("End date must be after start date.");
      if (form.banner_mode === "image" && !form.desktop_image_url) throw new Error("Upload a desktop image.");
      const { starts_at, ends_at, ...rest } = form;
      const payload = { ...rest, kind: "brand", image_url: form.banner_mode === "dynamic" ? "/favicon.ico" : form.desktop_image_url, desktop_image_url: form.banner_mode === "dynamic" ? null : form.desktop_image_url || null, mobile_image_url: form.banner_mode === "dynamic" ? null : form.mobile_image_url || null, background_gradient: form.background_gradient?.trim() || null, starts_at: starts_at ? new Date(starts_at).toISOString() : null, ends_at: ends_at ? new Date(ends_at).toISOString() : null };
      const query = editing ? (supabase.from("promotions") as any).update(payload).eq("id", editing) : (supabase.from("promotions") as any).insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setShowForm(false); resetForm(); toast.success("Banner saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await (supabase.from("promotions") as any).update({ is_active: !row.is_active }).eq("id", row.id);
      if (error) throw error;
    }, onSuccess: refresh, onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("promotions") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Banner deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: async (row: any) => {
      const { id, created_at, updated_at, ...rest } = row;
      const { error } = await (supabase.from("promotions") as any).insert({
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
      const { error: firstError } = await (supabase.from("promotions") as any).update({ display_order: nextOrder }).eq("id", row.id);
      if (firstError) throw firstError;
      const { error: secondError } = await (supabase.from("promotions") as any).update({ display_order: firstOrder === secondOrder ? position + direction : firstOrder }).eq("id", other.id);
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
  const dims = recommendedDimensions(form.placement);

  const imageCard = (field: "desktop_image_url" | "mobile_image_url", label: string, dim: { w: number; h: number }, inputRef: React.RefObject<HTMLInputElement | null>) => (
    <div className="rounded-lg border p-4 space-y-3 min-w-0">
      <div className="flex items-center gap-2 text-sm font-medium"><ImagePlus className="h-4 w-4 text-muted-foreground" />{label} <span className="text-muted-foreground font-normal">(Recommended)</span></div>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        <li>Size: {dim.w} × {dim.h} px</li>
        <li>Ratio: {ratio(dim.w, dim.h)}</li>
        <li>Format: JPG, PNG, WebP</li>
        <li>Max size: 2 MB</li>
      </ul>
      {form[field] && <img src={form[field]} alt={`${label} preview`} className="w-full aspect-[3/1] object-cover rounded border" />}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>{form[field] ? "Change Image" : "Choose Image"}</Button>
        {form[field] && <Button type="button" size="sm" variant="destructive" onClick={() => update(field, "")}>Remove</Button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
        onChange={e => { const file = e.target.files?.[0]; if (file) upload(file, field); e.target.value = ""; }} />
    </div>
  );

  return <div className="space-y-5">
    <div className="flex justify-between items-center gap-3">
      <p className="text-sm text-muted-foreground">Manage scheduled promotional banners in the new homepage placements.</p>
      <Button onClick={() => { resetForm(); setShowForm(true); }}>Add dynamic banner</Button>
    </div>
    {showForm && <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-bold">{editing ? "Edit Banner" : "New Banner"}</h3><p className="text-sm text-muted-foreground">Configure your banner and review it before saving.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending ? "Saving..." : "Save Banner"}</Button></div>
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-2" aria-label="Banner setup steps">
        {steps.map(s => (
          <button key={s.n} type="button" onClick={() => goToStep(s.n, s.id)} aria-current={activeStep === s.n ? "step" : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${activeStep === s.n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${activeStep === s.n ? "bg-primary-foreground text-primary" : "bg-muted-foreground/20"}`}>{s.n}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <Card id="db-step-details" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
            <h4 className="font-semibold border-b pb-2">1. Banner Details</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Banner name / title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
              <div className="space-y-2"><Label>Placement</Label><Select value={form.placement} onValueChange={v => update("placement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placements.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Subtitle</Label><Input value={form.subtitle} onChange={e => update("subtitle", e.target.value)} /></div>
              <div className="space-y-2"><Label>CTA button label</Label><Input value={form.cta_label} onChange={e => update("cta_label", e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} /><Label>{form.is_active ? "Active" : "Inactive"}</Label></div>
          </CardContent></Card>
          <Card id="db-step-images" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
            <h4 className="font-semibold border-b pb-2">2. Images</h4>
            <div className="space-y-2"><Label>Banner mode</Label><Select value={form.banner_mode} onValueChange={v => update("banner_mode", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image banner</SelectItem><SelectItem value="dynamic">Text / colour composition</SelectItem></SelectContent></Select></div>
            {form.banner_mode === "image" && <div className="grid sm:grid-cols-2 gap-4">
              {imageCard("desktop_image_url", "Desktop Image", dims.desktop, desktopInput)}
              {imageCard("mobile_image_url", "Mobile Image", dims.mobile, mobileInput)}
            </div>}
          </CardContent></Card>
          <Card id="db-step-link" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
            <h4 className="font-semibold border-b pb-2">3. Link &amp; Targeting</h4>
            <div className="space-y-2">
              <Label>Link type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {linkTypes.map(t => <button key={t.value} type="button" onClick={() => { setLinkType(t.value); setLinkTarget(""); update("link_url", "/"); }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${linkType === t.value ? "border-primary text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}>
                  <t.icon className="h-5 w-5" />{t.label}
                </button>)}
              </div>
            </div>
            {linkType === "product" && <div className="space-y-2"><Label>Search and select product</Label><SearchPicker placeholder="Type a product name…" fetcher={searchProducts} onPick={pickLink} /></div>}
            {linkType === "category" && <div className="space-y-2"><Label>Select category</Label>
              <Select value="" onValueChange={slug => { const cat = categoryOptions.find(c => c.slug === slug); if (cat) pickLink({ id: cat.id, label: cat.name, url: `/category/${cat.slug}` }); }}>
                <SelectTrigger><SelectValue placeholder="Choose a category…" /></SelectTrigger>
                <SelectContent>{categoryOptions.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>}
            {linkType === "store" && <div className="space-y-2"><Label>Search and select store</Label><SearchPicker placeholder="Type a store name…" fetcher={searchStores} onPick={pickLink} /></div>}
            {linkType === "brand" && <div className="space-y-2"><Label>Brand name</Label><Input placeholder="e.g. Samsung" onChange={e => { const v = e.target.value.trim(); setLinkTarget(v); update("link_url", v ? `/search?q=${encodeURIComponent(v)}` : "/"); }} /></div>}
            {linkType === "custom" && <div className="space-y-2"><Label>Destination URL</Label><Input value={form.link_url} onChange={e => update("link_url", e.target.value)} placeholder="/search or https://..." /></div>}
            {linkTarget && <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"><span className="font-medium">{linkTarget}</span><button type="button" aria-label="Clear link target" onClick={() => { setLinkTarget(""); update("link_url", "/"); }}><X className="h-3.5 w-3.5" /></button></div>}
            {linkType !== "custom" && form.link_url !== "/" && <p className="text-xs text-muted-foreground">This banner will link to <span className="font-medium">{form.link_url}</span>.</p>}
            <p className="text-xs text-muted-foreground">Links use existing Barakaz pages or an HTTPS address.</p>
            <div className="space-y-2"><Label>Target device</Label><Select value={form.target_device} onValueChange={v => update("target_device", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All devices</SelectItem><SelectItem value="desktop">Desktop only</SelectItem><SelectItem value="mobile">Mobile only</SelectItem></SelectContent></Select></div>
          </CardContent></Card>
          <Card id="db-step-animation" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
            <h4 className="font-semibold border-b pb-2">4. Animation &amp; Style</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Animation</Label><Select value={form.animation_type} onValueChange={v => update("animation_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["none", "fade", "slide", "zoom", "float"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Background colour</Label><Input type="color" value={form.background_color} onChange={e => update("background_color", e.target.value)} /></div>
              <div className="space-y-2"><Label>Transition speed (ms)</Label><Input type="number" min={100} max={3000} value={form.transition_duration_ms} onChange={e => update("transition_duration_ms", Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Rotation time (ms)</Label><Input type="number" min={2000} max={30000} value={form.rotation_interval_ms} onChange={e => update("rotation_interval_ms", Number(e.target.value))} /></div>
            </div>
          </CardContent></Card>
          <Card id="db-step-scheduling" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
            <h4 className="font-semibold border-b pb-2">5. Scheduling</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start date &amp; time (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={e => update("starts_at", e.target.value)} /></div>
              <div className="space-y-2"><Label>End date &amp; time (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={e => update("ends_at", e.target.value)} /></div>
            </div>
          </CardContent></Card>
        </div>
        <Card id="db-step-preview" className="scroll-mt-4"><CardContent className="p-5 space-y-4">
          <h4 className="font-semibold border-b pb-2">6. Live Preview</h4>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={previewDevice === "desktop" ? "default" : "outline"} onClick={() => setPreviewDevice("desktop")}>Desktop View</Button>
            <Button type="button" size="sm" variant={previewDevice === "mobile" ? "default" : "outline"} onClick={() => setPreviewDevice("mobile")}>Mobile View</Button>
          </div>
          <div className={`mx-auto overflow-hidden rounded-xl border relative min-h-44 flex items-center ${previewDevice === "mobile" ? "max-w-[360px]" : "w-full"}`} style={{ backgroundColor: form.background_color }}>
            {form.banner_mode === "image" && (previewDevice === "mobile" ? form.mobile_image_url || form.desktop_image_url : form.desktop_image_url) && <img className="absolute inset-0 w-full h-full object-cover" src={previewDevice === "mobile" ? form.mobile_image_url || form.desktop_image_url : form.desktop_image_url} alt="Live banner preview" />}
            <div className="relative z-10 p-5 max-w-full text-white drop-shadow-lg break-words [overflow-wrap:anywhere]">
              <h3 className={`font-bold leading-tight ${previewDevice === "mobile" ? "text-base" : "text-2xl"}`}>{form.title || "Banner title"}</h3>
              <p className="text-sm mt-2">{form.subtitle}</p>
              {form.cta_label && <span className="inline-block bg-white text-gray-900 rounded px-3 py-2 mt-3 text-sm font-semibold">{form.cta_label}</span>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Changes appear here before saving. Final cropping depends on screen size.</p>
        </CardContent></Card>
      </div>
    </div>}
    <Card><CardContent className="p-0 overflow-x-auto">
      <table className="w-full min-w-[850px] text-sm">
        <thead className="bg-muted/50"><tr className="text-left border-b">
          {["Thumbnail", "Banner", "Placement", "Device", "Schedule", "Status", "Order", "Actions"].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map((row: any) => <tr key={row.id} className="border-b last:border-0">
          <td className="p-3">{row.banner_mode !== "dynamic" && (row.desktop_image_url || row.image_url) ? <img src={row.desktop_image_url || row.image_url} alt="" className="w-24 h-14 object-cover rounded" /> : <div className="w-24 h-14 rounded" style={{ backgroundColor: row.background_color || "#1f2937" }} />}</td>
          <td className="p-3 font-medium max-w-40 truncate">{row.title}</td>
          <td className="p-3">{row.placement.replace(/_/g, " ")}</td>
          <td className="p-3 capitalize">{row.target_device || "all"}</td>
          <td className="p-3 text-xs">{row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "Any time"} – {row.ends_at ? new Date(row.ends_at).toLocaleDateString() : "No end"}</td>
          <td className="p-3"><span className="font-medium">{bannerStatus(row)}</span><div><Switch checked={row.is_active} onCheckedChange={() => toggle.mutate(row)} aria-label={`Toggle ${row.title}`} /></div></td>
          <td className="p-3">{row.display_order ?? 0} <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => move.mutate({ row, direction: -1 })} aria-label="Move up">↑</Button><Button variant="ghost" size="sm" onClick={() => move.mutate({ row, direction: 1 })} aria-label="Move down">↓</Button></div></td>
          <td className="p-3 whitespace-nowrap"><Button variant="outline" size="sm" onClick={() => edit(row)}>Edit</Button>{" "}<Button variant="outline" size="sm" disabled={duplicate.isPending} onClick={() => duplicate.mutate(row)}>Duplicate</Button>{" "}<Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => { if (window.confirm(`Permanently delete banner "${row.title}"?`)) remove.mutate(row.id); }}>Delete</Button></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-4 text-muted-foreground">No dynamic banners yet.</p>}
    </CardContent></Card>
  </div>;
}
