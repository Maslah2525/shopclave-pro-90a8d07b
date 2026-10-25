import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Star, StarOff, Eye, EyeOff, Pencil, Upload, X, Video, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef } from "react";
import barakazIcon from "@/assets/barakaz-icon.webp";
import CountdownTimer from "@/components/shared/CountdownTimer";
import { convertImageToWebp } from "@/lib/imageToWebp";

interface EditProduct {
  id: string;
  name: string;
  video_url: string | null;
  images: { id: string; url: string; position: number }[];
}

const AdminProducts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [editProduct, setEditProduct] = useState<EditProduct | null>(null);
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dealProduct, setDealProduct] = useState<{ id: string; name: string; deal_ends_at: string | null } | null>(null);
  const [dealDate, setDealDate] = useState("");
  const [dealTime, setDealTime] = useState("");

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, vendors(store_name), product_images(id, url, position)").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<"products"> }) => {
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (p: any) => {
    setEditProduct({
      id: p.id,
      name: p.name,
      video_url: p.video_url,
      images: (p.product_images || []).sort((a: any, b: any) => a.position - b.position),
    });
    setEditVideoUrl(p.video_url || "");
    setNewFiles([]);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExistingImage = async (imageId: string) => {
    if (!editProduct) return;
    await supabase.from("product_images").delete().eq("id", imageId);
    setEditProduct({
      ...editProduct,
      images: editProduct.images.filter(i => i.id !== imageId),
    });
  };

  const removeNewFile = (idx: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async () => {
    if (!editProduct) return;
    setSaving(true);
    try {
      // Update video_url
      await supabase.from("products").update({ video_url: editVideoUrl.trim() || null }).eq("id", editProduct.id);

      // Upload new files
      if (newFiles.length > 0) {
        const startPosition = editProduct.images.length;
        for (let i = 0; i < newFiles.length; i++) {
          const f = newFiles[i];
          const optimized = await convertImageToWebp(f.file);
          const ext = optimized.name.split(".").pop() || "webp";
          const path = `${editProduct.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from("product-images").upload(path, optimized, { contentType: optimized.type });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
          await supabase.from("product_images").insert({
            product_id: editProduct.id,
            url: urlData.publicUrl,
            position: startPosition + i,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product updated");
      setEditProduct(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = products?.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFeatured = !featuredOnly || p.featured === true;
    return matchesSearch && matchesFeatured;
  }) || [];

  const featuredCount = products?.filter((p: any) => p.featured).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div>
          <h2 className="text-xl font-bold">All Products</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {featuredCount} featured on homepage · {products?.length || 0} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={featuredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFeaturedOnly((v) => !v)}
            className="gap-1.5"
          >
            <Star className={`h-3.5 w-3.5 ${featuredOnly ? "fill-current" : ""}`} />
            Featured {featuredOnly ? `(${featuredCount})` : ""}
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left p-3 font-medium">Product</th>
              <th className="text-left p-3 font-medium">Vendor</th>
              <th className="text-left p-3 font-medium">Price</th>
              <th className="text-left p-3 font-medium">Stock</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img src={p.product_images?.[0]?.url || barakazIcon} alt="" className="w-8 h-8 rounded object-cover bg-secondary" />
                    <div className="min-w-0">
                      <span className="font-medium line-clamp-1 block">{p.name}</span>
                      {p.featured && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                          <Star className="h-2.5 w-2.5 fill-current" /> On homepage
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{p.vendors?.store_name || "—"}</td>
                <td className="p-3">${Number(p.price).toLocaleString()}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{p.status}</span>
                  {(p as any).deal_ends_at && new Date((p as any).deal_ends_at).getTime() > Date.now() && (
                    <CountdownTimer endsAt={(p as any).deal_ends_at} variant="badge" />
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7" title="Edit images & video" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" title="Set deal timer"
                      onClick={() => {
                        setDealProduct({ id: p.id, name: p.name, deal_ends_at: (p as any).deal_ends_at || null });
                        const existing = (p as any).deal_ends_at ? new Date((p as any).deal_ends_at) : null;
                        setDealDate(existing ? existing.toISOString().slice(0, 10) : "");
                        setDealTime(existing ? existing.toISOString().slice(11, 16) : "");
                      }}>
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" title={p.featured ? "Unfeature" : "Feature"}
                      onClick={() => updateProduct.mutate({ id: p.id, updates: { featured: !p.featured } })}>
                      {p.featured ? <Star className="h-4 w-4 text-warning fill-warning" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" title={p.status === "active" ? "Deactivate" : "Activate"}
                      onClick={() => updateProduct.mutate({ id: p.id, updates: { status: p.status === "active" ? "draft" : "active" } })}>
                      {p.status === "active" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit: {editProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-semibold mb-2 block">Images</Label>
              <div className="flex flex-wrap gap-3 mb-3">
                {editProduct?.images.map((img, idx) => (
                  <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-secondary group">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-0.5 left-0.5 bg-background/80 text-[10px] px-1 rounded font-medium">{idx + 1}</span>
                  </div>
                ))}
                {newFiles.map((f, idx) => (
                  <div key={`new-${idx}`} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-primary/40 bg-secondary group">
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewFile(idx)}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px]">Upload</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleEditFileSelect}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-4 w-4 text-muted-foreground" />
                <Label>Video URL (YouTube or Vimeo)</Label>
              </div>
              <Input
                value={editVideoUrl}
                onChange={(e) => setEditVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditProduct(null)}>Cancel</Button>
              <Button className="flex-1 font-semibold" disabled={saving} onClick={handleSaveEdit}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deal Timer Dialog */}
      <Dialog open={!!dealProduct} onOpenChange={(open) => !open && setDealProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Deal Timer: {dealProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>End Date</Label>
              <Input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
            </div>
            <div>
              <Label>End Time</Label>
              <Input type="time" value={dealTime} onChange={(e) => setDealTime(e.target.value)} />
            </div>
            {dealProduct?.deal_ends_at && new Date(dealProduct.deal_ends_at).getTime() > Date.now() && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Current timer:</Label>
                <CountdownTimer endsAt={dealProduct.deal_ends_at} variant="badge" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {dealProduct?.deal_ends_at && (
                <Button variant="destructive" size="sm" onClick={async () => {
                  await supabase.from("products").update({ deal_ends_at: null } as any).eq("id", dealProduct!.id);
                  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                  toast.success("Deal timer removed");
                  setDealProduct(null);
                }}>
                  Remove Timer
                </Button>
              )}
              <Button className="flex-1 font-semibold" onClick={async () => {
                if (!dealDate || !dealTime) { toast.error("Please set both date and time"); return; }
                const dealEndsAt = new Date(`${dealDate}T${dealTime}`).toISOString();
                await supabase.from("products").update({ deal_ends_at: dealEndsAt } as any).eq("id", dealProduct!.id);
                queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                toast.success("Deal timer set!");
                setDealProduct(null);
              }}>
                Set Timer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
