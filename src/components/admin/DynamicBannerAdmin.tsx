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
const defaults = { placement: placements[0] as string, title: "", subtitle: "", cta_label: "Shop now", link_url: "/", image_url: "", desktop_image_url: "", mobile_image_url: "", banner_mode: "image", animation_type: "fade", transition_duration_ms: 700, rotation_interval_ms: 5000, background_color: "#1f2937", background_gradient: "", is_active: false, starts_at: "", ends_at: "", display_order: 0 };
type Form = typeof defaults;
const dateInput = (date: string | null) => date ? new Date(date).toISOString().slice(0, 16) : "";
const safeLink = (link: string) => link.startsWith("/") && !link.startsWith("//") || /^https?:\/\//.test(link);

export default function DynamicBannerAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...defaults });
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
    setForm({ ...defaults, ...row, starts_at: dateInput(row.starts_at), ends_at: dateInput(row.ends_at) });
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
      if (!safeLink(form.link_url)) throw new Error("Use a relative path or an HTTP(S) URL.");
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) throw new Error("End date must be after start date.");
      if (form.banner_mode === "image" && !form.desktop_image_url) throw new Error("Upload a desktop image.");
      const { starts_at, ends_at, ...rest } = form;
      const payload = { ...rest, kind: "brand", image_url: form.desktop_image_url || form.image_url || "", starts_at: starts_at ? new Date(starts_at).toISOString() : null, ends_at: ends_at ? new Date(ends_at).toISOString() : null };
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
  return <div className="space-y-5">
    <div className="flex justify-between items-center gap-3">
      <p className="text-sm text-muted-foreground">Manage scheduled promotional banners in the new homepage placements.</p>
      <Button onClick={() => { setEditing(null); setForm({ ...defaults }); setShowForm(true); }}>Add dynamic banner</Button>
    </div>
    {showForm && <Card><CardContent className="p-5 space-y-4">
      <h3 className="font-semibold">{editing ? "Edit banner" : "New banner"}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Placement</Label><Select value={form.placement} onValueChange={v => update("placement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placements.map(p => <SelectItem key={p} value={p}>{p.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Mode</Label><Select value={form.banner_mode} onValueChange={v => update("banner_mode", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Image banner</SelectItem><SelectItem value="dynamic">Text / colour composition</SelectItem></SelectContent></Select></div>
        {(["title", "subtitle", "cta_label", "link_url"] as const).map(key => <div key={key} className="space-y-2"><Label>{key.replaceAll("_", " ")}</Label><Input value={form[key]} onChange={e => update(key, e.target.value)} /></div>)}
        {(["desktop_image_url", "mobile_image_url"] as const).map(field => <div key={field} className="space-y-2"><Label>{field.replaceAll("_", " ")}</Label><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) upload(file, field); }} />{form[field] && <img src={form[field]} alt="Banner preview" className="w-full h-24 object-cover rounded border" />}</div>)}
        <div className="space-y-2"><Label>Animation</Label><Select value={form.animation_type} onValueChange={v => update("animation_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["none", "fade", "slide", "zoom", "float"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Background colour</Label><Input type="color" value={form.background_color} onChange={e => update("background_color", e.target.value)} /></div>
        <div className="space-y-2"><Label>Transition (ms)</Label><Input type="number" min={100} max={3000} value={form.transition_duration_ms} onChange={e => update("transition_duration_ms", Number(e.target.value))} /></div>
        <div className="space-y-2"><Label>Rotation (ms)</Label><Input type="number" min={2000} max={30000} value={form.rotation_interval_ms} onChange={e => update("rotation_interval_ms", Number(e.target.value))} /></div>
        <div className="space-y-2"><Label>Start time (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={e => update("starts_at", e.target.value)} /></div>
        <div className="space-y-2"><Label>End time (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={e => update("ends_at", e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} /><Label>Active</Label></div>
      <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending ? "Saving..." : "Save banner"}</Button></div>
    </CardContent></Card>}
    <div className="grid gap-3">{rows.map((row: any) => <Card key={row.id}><CardContent className="p-4 flex items-center gap-3">
      {row.desktop_image_url || row.image_url ? <img src={row.desktop_image_url || row.image_url} alt="" className="w-24 h-14 object-cover rounded" /> : <div className="w-24 h-14 rounded bg-muted" />}
      <div className="flex-1 min-w-0"><div className="font-semibold truncate">{row.title}</div><div className="text-xs text-muted-foreground">{row.placement.replaceAll("_", " ")} · {row.animation_type || "fade"}</div></div>
      <Switch checked={row.is_active} onCheckedChange={() => toggle.mutate(row)} /><Button variant="outline" onClick={() => edit(row)}>Edit</Button>
    </CardContent></Card>)}{!rows.length && <p className="text-sm text-muted-foreground">No dynamic banners yet.</p>}</div>
  </div>;
}
