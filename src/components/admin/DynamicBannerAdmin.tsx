import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const placements = ["featured_products_banner", "sponsored_products_banner", "category_promotion", "flash_sale_banner", "homepage_full_width", "homepage_secondary"] as const;
const recommendedDimensions = (placement: string) => placement === "homepage_full_width" ? { desktop: "1920 × 600", mobile: "750 × 900" } : { desktop: "1600 × 400", mobile: "750 × 500" };
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

export default function DynamicBannerAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...defaults });
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
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
  const edit = (row: any) => {
    setEditing(row.id);
    setForm({ ...defaults, ...Object.fromEntries(Object.keys(defaults).map(key => [key, row[key] ?? (defaults as any)[key]])), starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) } as Form);
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
      if (!safeLink(form.link_url)) throw new Error("Use a relative path or an HTTPS URL.");
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) throw new Error("End date must be after start date.");
      if (form.banner_mode === "image" && !form.desktop_image_url) throw new Error("Upload a desktop image.");
      const { starts_at, ends_at, ...rest } = form;
      const payload = { ...rest, kind: "brand", image_url: form.banner_mode === "dynamic" ? "/favicon.ico" : form.desktop_image_url, desktop_image_url: form.banner_mode === "dynamic" ? null : form.desktop_image_url || null, mobile_image_url: form.banner_mode === "dynamic" ? null : form.mobile_image_url || null, background_gradient: form.background_gradient?.trim() || null, starts_at: starts_at ? new Date(starts_at).toISOString() : null, ends_at: ends_at ? new Date(ends_at).toISOString() : null };
      const query = editing ? (supabase.from("promotions") as any).update(payload).eq("id", editing) : (supabase.from("promotions") as any).insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setShowForm(false); setEditing(null); setForm({ ...defaults }); toast.success("Banner saved"); },
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
  return <div className="space-y-5">
    <div className="flex justify-between items-center gap-3">
      <p className="text-sm text-muted-foreground">Manage scheduled promotional banners in the new homepage placements.</p>
      <Button onClick={() => { setEditing(null); setForm({ ...defaults }); setShowForm(true); }}>Add dynamic banner</Button>
    </div>
    {showForm && <Card><CardContent className="p-5 space-y-4">
      <h3 className="font-semibold">{editing ? "Edit banner" : "New banner"}</h3>
      <h4 className="font-semibold border-b pb-2">1. Banner Details</h4>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Placement</Label><Select value={form.placement} onValueChange={v => update("placement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placements.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Mode</Label><Select value={form.banner_mode} onValueChange={v => update("banner_mode", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image banner</SelectItem><SelectItem value="dynamic">Text / colour composition</SelectItem></SelectContent></Select></div>
        {(["title", "subtitle", "cta_label", "link_url"] as const).map(key => <div key={key} className="space-y-2"><Label>{key.replace(/_/g, " ")}</Label><Input value={form[key]} onChange={e => update(key, e.target.value)} /></div>)}
        {form.banner_mode === "image" && (["desktop_image_url", "mobile_image_url"] as const).map(field => <div key={field} className="space-y-2"><Label>{field === "desktop_image_url" ? "Desktop banner image" : "Mobile banner image"}</Label><p className="text-xs text-muted-foreground">Recommended: {recommendedDimensions(form.placement)[field === "desktop_image_url" ? "desktop" : "mobile"]} px (width × height). JPG, PNG or WebP, maximum 2 MB. {field === "mobile_image_url" ? "Upload separately for the best mobile crop; optional." : "Required for image banners."}</p><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) upload(file, field); }} />{form[field] && <img src={form[field]} alt="Banner preview" className="w-full h-24 object-cover rounded border" />}</div>)}
        <div className="space-y-2"><Label>Target device</Label><Select value={form.target_device} onValueChange={v => update("target_device", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All devices</SelectItem><SelectItem value="desktop">Desktop only</SelectItem><SelectItem value="mobile">Mobile only</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Animation</Label><Select value={form.animation_type} onValueChange={v => update("animation_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["none", "fade", "slide", "zoom", "float"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Background colour</Label><Input type="color" value={form.background_color} onChange={e => update("background_color", e.target.value)} /></div>
        <div className="space-y-2"><Label>Transition (ms)</Label><Input type="number" min={100} max={3000} value={form.transition_duration_ms} onChange={e => update("transition_duration_ms", Number(e.target.value))} /></div>
        <div className="space-y-2"><Label>Rotation (ms)</Label><Input type="number" min={2000} max={30000} value={form.rotation_interval_ms} onChange={e => update("rotation_interval_ms", Number(e.target.value))} /></div>
        <div className="space-y-2"><Label>Start time (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={e => update("starts_at", e.target.value)} /></div>
        <div className="space-y-2"><Label>End time (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={e => update("ends_at", e.target.value)} /></div>
      </div>
      <div className="rounded-xl border p-4 space-y-3">
        <h4 className="font-semibold">6. Live Preview</h4>
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
        <p className="text-xs text-muted-foreground">Preview updates as you edit. Image cropping varies by screen width.</p>
      </div>
      <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} /><Label>Active</Label></div>
      <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending ? "Saving..." : "Save banner"}</Button></div>
    </CardContent></Card>}
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
