import { PackageMeasurementsFields, emptyPackageDims, validatePackageDims, packageDimsToColumns, packageDimsFromProduct, type PackageDims } from "@/components/vendor/PackageMeasurementsFields";
import { useState, useRef, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convertImageToWebp } from "@/lib/imageToWebp";
import { useQuery } from "@tanstack/react-query";
import { Plus, X, Layers, Upload, Video, ImageIcon, ChevronRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { isAdminUnlimited } from "@/lib/subscriptionPlans";
import { ShippingOptionsFields, DEFAULT_SHIPPING_OPTIONS, validateShippingOptions, InventoryExtrasFields, emptyInventoryExtras, validateInventoryExtras, inventoryExtrasToColumns, SHIP_LABELS, shipDaysLabel, type ShippingOptions, type InventoryExtras, type ShipKey } from "@/components/vendor/ProductListingExtras";
import { SpecificationsFields, normalizeSpecifications, validateSpecifications, type SpecRowInput } from "@/components/vendor/ProductListingExtras";
import { CategoryPicker, useCategoryAncestors } from "@/components/shared/CategoryPicker";

const STEPS = [
  { label: "Category", icon: "1" },
  { label: "Details", icon: "2" },
  { label: "Pricing", icon: "3" },
  { label: "Media", icon: "4" },
  { label: "Variants", icon: "5" },
  { label: "Review", icon: "6" },
];

const MAX_DESC = 850;

interface OptionType { name: string; values: string[]; }
interface VariantRow { options: Record<string, string>; price: string; compareAtPrice: string; stock: string; sku: string; imageFiles: File[]; imagePreviews: string[]; }
interface ImageFile { file?: File; url: string; preview: string; }

function generateCombinations(optionTypes: OptionType[]): Record<string, string>[] {
  const filtered = optionTypes.filter(o => o.name && o.values.length > 0);
  if (!filtered.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const opt of filtered) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) for (const val of opt.values) next.push({ ...combo, [opt.name]: val });
    combos = next;
  }
  return combos;
}

const AddProductPage = () => {
  const { user, userRoles } = useAuth();
  const navigate = useNavigate();
  const { vendor } = useOutletContext<{ vendor: any }>();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const isAdmin = isAdminUnlimited(userRoles);

  // Category state — single selected leaf id, picker is variable depth.
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "", description: "", price: "", compareAtPrice: "", bulkPrice: "",
    stock: "0", sku: "", status: "active", condition: "new", delivery: "",
    dealEndsAt: "", brand: "", mpn: "",
  });
  const [shipping, setShipping] = useState<ShippingOptions>(DEFAULT_SHIPPING_OPTIONS);
  const [inv, setInv] = useState<InventoryExtras>(emptyInventoryExtras);
  const [pkg, setPkg] = useState<PackageDims>(emptyPackageDims);
  const [keyFeatures, setKeyFeatures] = useState<string[]>([""]);
  const [specs, setSpecs] = useState<SpecRowInput[]>([]);
  const [whatsInBoxItems, setWhatsInBoxItems] = useState<string[]>([""]);
  const [showBulkPrice, setShowBulkPrice] = useState(false);

  // Media state
  const [images, setImages] = useState<ImageFile[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variants state
  const [hasVariants, setHasVariants] = useState(false);
  const [optionTypes, setOptionTypes] = useState<OptionType[]>([{ name: "", values: [] }]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({});
  const variantFileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const { data: ancestors = [] } = useCategoryAncestors(selectedCategoryId);
  const categoryPath = useMemo(() => ancestors.map((a) => a.name), [ancestors]);

  // Image handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files.map(f => ({ file: f, url: "", preview: URL.createObjectURL(f) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const uploadImages = async (productId: string): Promise<string[]> => {
    const results = await Promise.all(images.map(async (img) => {
      if (img.file) {
        const optimized = await convertImageToWebp(img.file);
        const ext = optimized.name.split(".").pop() || "webp";
        const path = `vendors/${vendor.id}/products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, optimized, { contentType: optimized.type });
        if (error) throw error;
        return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      return img.url || null;
    }));
    return results.filter((u): u is string => !!u);
  };

  // Variant handlers
  const regenerateVariants = (opts: OptionType[]) => {
    setVariantRows(generateCombinations(opts).map(options => ({ options, price: "", compareAtPrice: "", stock: "0", sku: "", imageFiles: [], imagePreviews: [] })));
  };
  const addOptionType = () => setOptionTypes([...optionTypes, { name: "", values: [] }]);
  const removeOptionType = (idx: number) => { const next = optionTypes.filter((_, i) => i !== idx); setOptionTypes(next); regenerateVariants(next); };
  const updateOptionName = (idx: number, name: string) => { const next = [...optionTypes]; next[idx] = { ...next[idx], name }; setOptionTypes(next); regenerateVariants(next); };
  const addOptionValue = (idx: number) => {
    const val = (newValueInputs[idx] || "").trim();
    if (!val) return;
    const next = [...optionTypes];
    if (next[idx].values.includes(val)) return;
    next[idx] = { ...next[idx], values: [...next[idx].values, val] };
    setOptionTypes(next); setNewValueInputs({ ...newValueInputs, [idx]: "" }); regenerateVariants(next);
  };
  const removeOptionValue = (optIdx: number, valIdx: number) => { const next = [...optionTypes]; next[optIdx] = { ...next[optIdx], values: next[optIdx].values.filter((_, i) => i !== valIdx) }; setOptionTypes(next); regenerateVariants(next); };
  const updateVariantRow = (idx: number, field: keyof VariantRow, value: string) => { const next = [...variantRows]; next[idx] = { ...next[idx], [field]: value }; setVariantRows(next); };
  const handleVariantImageSelect = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = [...variantRows];
    next[idx] = { ...next[idx], imageFiles: [...next[idx].imageFiles, ...files], imagePreviews: [...next[idx].imagePreviews, ...files.map(f => URL.createObjectURL(f))] };
    setVariantRows(next);
    if (variantFileRefs.current[idx]) variantFileRefs.current[idx]!.value = "";
  };
  const removeVariantImage = (vi: number, ii: number) => { const next = [...variantRows]; next[vi] = { ...next[vi], imageFiles: next[vi].imageFiles.filter((_, i) => i !== ii), imagePreviews: next[vi].imagePreviews.filter((_, i) => i !== ii) }; setVariantRows(next); };
  const uploadVariantImages = async (files: File[], productId: string): Promise<string[]> => {
    return Promise.all(files.map(async (raw) => {
      const file = await convertImageToWebp(raw);
      const ext = file.name.split(".").pop() || "webp";
      const path = `vendors/${vendor.id}/products/${productId}/variant-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }));
  };

  // Validation per step
  const validateStep = (): boolean => {
    switch (step) {
      case 0: if (!selectedCategoryId) { toast.error("Please select a category"); return false; } return true;
      case 1: if (!form.name.trim()) { toast.error("Product name is required"); return false; } if (!form.description.trim()) { toast.error("Description is required"); return false; } { const se = validateSpecifications(specs); if (se) { toast.error(se); return false; } } return true;
      case 2: { if (!form.price || parseFloat(form.price) <= 0) { toast.error("Price is required"); return false; } const pkgErr = validatePackageDims(pkg) || validateInventoryExtras(inv) || validateShippingOptions(shipping); if (pkgErr) { toast.error(pkgErr); return false; } return true; }
      case 3: return true;
      case 4: if (hasVariants && variantRows.length === 0) { toast.error("Add at least one variant option with values"); return false; } return true;
      default: return true;
    }
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  // Submit
  const handleSubmit = async (publishStatus: "active" | "draft") => {
    if (publishStatus === "active") {
      if (!selectedCategoryId) { toast.error("Please select a category"); setStep(0); return; }
      if (!form.name.trim() || !form.description.trim()) { toast.error("Name and description are required"); setStep(1); return; }
      const e2 = (!(parseFloat(form.price) > 0) && "Price is required") || validatePackageDims(pkg) || validateInventoryExtras(inv) || validateShippingOptions(shipping);
      if (e2) { toast.error(e2); setStep(2); return; }
    } else if (!form.name.trim()) { toast.error("Add a product name before saving a draft"); setStep(1); return; }
    if (!vendor) { toast.error("Vendor account not found"); return; }
    setLoading(true);
    try {
      // Enforce listing limit (admins are unlimited)
      if (!isAdmin && publishStatus === "active") {
        const { data: sub } = await supabase
          .from("vendor_subscriptions")
          .select("max_listings, plan_name")
          .eq("vendor_id", vendor.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const maxListings = sub?.max_listings ?? 5;
        const planName = sub?.plan_name ?? "free";
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", vendor.id)
          .eq("status", "active");
        if ((count ?? 0) >= maxListings) {
          toast.error(`You've reached your ${planName} plan limit (${maxListings} listings). Upgrade to add more.`);
          setLoading(false);
          return;
        }
      }

      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
      const autoSku = form.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const cleanFeatures = keyFeatures.map(f => f.trim()).filter(Boolean);
      const { data: product, error } = await supabase.from("products").insert({
        vendor_id: vendor.id, name: form.name.trim(), slug,
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        compare_at_price: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
        stock: hasVariants ? variantRows.reduce((s, v) => s + (parseInt(v.stock) || 0), 0) : parseInt(form.stock) || 0,
        category_id: selectedCategoryId || null, status: "draft",
        brand: form.brand.trim() || null, mpn: form.mpn.trim() || null, shipping_options: shipping, ...inventoryExtrasToColumns(inv),
        video_url: videoUrl.trim() || null,
        sku: autoSku,
        key_features: cleanFeatures.length > 0 ? cleanFeatures : null,
        specifications: normalizeSpecifications(specs) as any,
        condition: form.condition,
        whats_in_box: (() => { const clean = whatsInBoxItems.map(s => s.trim()).filter(Boolean); return clean.length > 0 ? clean : null; })(),
        deal_ends_at: form.dealEndsAt ? new Date(form.dealEndsAt).toISOString() : null,
        ...(validatePackageDims(pkg) ? {} : packageDimsToColumns(pkg)),
      } as any).select().single();
      if (error) throw error;
      const must = (r: { error: any }) => { if (r.error) throw r.error; };

      if (images.length > 0 && product) {
        const urls = await uploadImages(product.id);
        if (urls.length) must(await supabase.from("product_images").insert(urls.map((url, idx) => ({ product_id: product.id, url, position: idx }))));
      }

      if (hasVariants && variantRows.length > 0 && product) {
        await Promise.all(variantRows.map(async (v) => {
          const allUrls = v.imageFiles.length > 0 ? await uploadVariantImages(v.imageFiles, product.id) : [];
          const { data: variant, error: vErr } = await supabase.from("product_variants").insert({
            product_id: product.id, variant_options: v.options,
            price: v.price ? parseFloat(v.price) : null,
            compare_at_price: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
            stock: parseInt(v.stock) || 0,
            sku: v.sku.trim() || null, image_url: allUrls[0] || null,
          } as any).select("id").single();
          if (vErr) throw vErr;
          if (allUrls.length > 0 && variant) {
            must(await supabase.from("product_images").insert(allUrls.map((url, idx) => ({ product_id: product.id, variant_id: variant.id, url, position: idx }))));
          }
        }));
      }

      // Go live only after photos and sizes saved, so a failed save never shows a half-finished listing.
      if (publishStatus === "active" && product) must(await supabase.from("products").update({ status: "active" } as any).eq("id", product.id));
      toast.success(publishStatus === "active" ? "Product published!" : "Draft saved");
      navigate("/vendor/products");
    } catch (err: any) {
      console.error("Add product failed:", err);
      const msg = err?.message || err?.error_description || err?.error || JSON.stringify(err);
      toast.error(msg || "Failed to add product");
    } finally { setLoading(false); }
  };

  if (vendor?.status !== "approved" && !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold">Your store isn't approved yet</h2>
        <p className="text-sm text-muted-foreground">Finish all 12 store setup steps and submit for review. You can add products once an admin approves your store.</p>
        <Button onClick={() => navigate("/vendor/settings")}>Go to Store Settings</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Add New Product</h2>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => { if (i < step) setStep(i); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-primary/20 text-primary cursor-pointer" :
                "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{s.icon}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        {/* Step 0: Category Selection */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Select Category</h3>
            <p className="text-sm text-muted-foreground">Choose the category that best fits your product.</p>
            <CategoryPicker value={selectedCategoryId} onChange={setSelectedCategoryId} required />
          </div>
        )}

        {/* Step 1: Product Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Product Details</h3>
            <div>
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Generic" /></div>
              <div><Label>Model / MPN (Optional)</Label><Input value={form.mpn} onChange={(e) => setForm({ ...form, mpn: e.target.value })} /></div>
            </div>
            <div>
              <Label>Condition *</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Description *</Label>
                <span className={`text-xs ${form.description.length >= MAX_DESC ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.description.length}/{MAX_DESC}
                </span>
              </div>
              <Textarea
                value={form.description}
                onChange={(e) => { if (e.target.value.length <= MAX_DESC) setForm({ ...form, description: e.target.value }); }}
                rows={5}
                placeholder="Describe your product in detail..."
              />
            </div>

            <Separator />

            {/* Key Features */}
            <SpecificationsFields value={specs} onChange={setSpecs} />
            <Separator />
            <div>
              <Label className="mb-2 block">Key Features</Label>
              <p className="text-xs text-muted-foreground mb-2">Add features one per line. These appear independently in the product specifications.</p>
              {keyFeatures.map((feat, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input
                    value={feat}
                    onChange={(e) => { const next = [...keyFeatures]; next[i] = e.target.value; setKeyFeatures(next); }}
                    placeholder={`Feature ${i + 1}`}
                  />
                  {keyFeatures.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive shrink-0" onClick={() => setKeyFeatures(keyFeatures.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setKeyFeatures([...keyFeatures, ""])}>
                <Plus className="h-3.5 w-3.5" /> Add Feature
              </Button>
            </div>

            {/* What's in the Box */}
            <div>
              <Label className="mb-2 block">What's in the Box</Label>
              <p className="text-xs text-muted-foreground mb-2">Add items one per line.</p>
              {whatsInBoxItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input
                    value={item}
                    onChange={(e) => { const next = [...whatsInBoxItems]; next[i] = e.target.value; setWhatsInBoxItems(next); }}
                    placeholder={`Item ${i + 1}, e.g. 1 x ${form.name || "Product"}`}
                  />
                  {whatsInBoxItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive shrink-0" onClick={() => setWhatsInBoxItems(whatsInBoxItems.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setWhatsInBoxItems([...whatsInBoxItems, ""])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Pricing & Stock */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Pricing, Inventory & Shipping</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (CAD) *</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Enter price in Canadian Dollars. Buyers see it converted to their local currency.</p>
              </div>
              <div>
                <Label>Compare at Price (CAD)</Label>
                <Input type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
              </div>
            </div>

            <div>
              <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowBulkPrice(!showBulkPrice)}>
                {showBulkPrice ? "Hide" : "+ Add"} Bulk Price
              </button>
              {showBulkPrice && (
                <div className="mt-2">
                  <Label>Bulk Price (CAD)</Label>
                  <Input type="number" min="0" step="0.01" value={form.bulkPrice} onChange={(e) => setForm({ ...form, bulkPrice: e.target.value })} placeholder="Price for bulk orders" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stock Quantity</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Auto-generated if blank" />
              </div>
            </div>

            <InventoryExtrasFields value={inv} onChange={setInv} />
            <PackageMeasurementsFields value={pkg} onChange={setPkg} />
            <ShippingOptionsFields value={shipping} onChange={setShipping} />

            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <Label className="flex items-center gap-1.5 text-primary">⚡ Flash Sale Timer (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Set an end time to feature this product in the homepage Flash Sale section.</p>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={form.dealEndsAt}
                  onChange={(e) => setForm({ ...form, dealEndsAt: e.target.value })}
                />
                {form.dealEndsAt && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, dealEndsAt: "" })}>Clear</Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Media */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Images & Media</h3>
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-secondary group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 bg-background/80 text-[10px] px-1 rounded font-medium">{idx + 1}</span>
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <Upload className="h-5 w-5" /><span className="text-[10px]">Upload</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            <p className="text-xs text-muted-foreground">First image will be the main product image.</p>

            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-4 w-4 text-muted-foreground" />
                <Label>Video URL (YouTube or Vimeo)</Label>
              </div>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>
        )}

        {/* Step 4: Variants */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg">Product Variations</h3>
              </div>
              <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
            </div>

            {hasVariants && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Define option types (e.g. Size, Color) and their values.</p>
                {optionTypes.map((opt, optIdx) => (
                  <div key={optIdx} className="bg-secondary/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Option name (e.g. Size)" value={opt.name} onChange={(e) => updateOptionName(optIdx, e.target.value)} className="flex-1" />
                      {optionTypes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOptionType(optIdx)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {opt.values.map((val, valIdx) => (
                        <span key={valIdx} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                          {val}
                          <button type="button" onClick={() => removeOptionValue(optIdx, valIdx)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Add value (e.g. S, M, L)" value={newValueInputs[optIdx] || ""} onChange={(e) => setNewValueInputs({ ...newValueInputs, [optIdx]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOptionValue(optIdx); } }} className="flex-1" />
                      <Button type="button" variant="outline" size="sm" onClick={() => addOptionValue(optIdx)}>Add</Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOptionType}><Plus className="h-3.5 w-3.5" /> Add Option Type</Button>

                {variantRows.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium mb-2 block">Variant Combinations ({variantRows.length})</Label>
                    <div className="space-y-3">
                      {variantRows.map((row, idx) => (
                        <div key={idx} className="bg-card border border-border rounded-lg p-3 space-y-3">
                          <p className="text-xs font-semibold text-foreground">{Object.entries(row.options).map(([k, v]) => `${k}: ${v}`).join(" / ")}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Original Price (CAD)</Label>
                              <Input type="number" min="0" step="0.01" placeholder={form.compareAtPrice || "Optional"} value={row.compareAtPrice} onChange={(e) => updateVariantRow(idx, "compareAtPrice", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Current Price (CAD)</Label>
                              <Input type="number" min="0" step="0.01" placeholder={form.price || "Default"} value={row.price} onChange={(e) => updateVariantRow(idx, "price", e.target.value)} />
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground -mt-1">Leave Original Price empty for no discount. Current Price falls back to the product price if blank.</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Stock</Label>
                              <Input type="number" min="0" value={row.stock} onChange={(e) => updateVariantRow(idx, "stock", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">SKU</Label>
                              <Input placeholder="Optional" value={row.sku} onChange={(e) => updateVariantRow(idx, "sku", e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground mb-1 block">Images</Label>
                            <div className="flex flex-wrap gap-2">
                              {row.imagePreviews.map((preview, imgIdx) => (
                                <div key={imgIdx} className="relative w-12 h-12 rounded overflow-hidden border border-border bg-secondary group">
                                  <img src={preview} alt="" className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => removeVariantImage(idx, imgIdx)} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-2.5 w-2.5" /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => variantFileRefs.current[idx]?.click()} className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"><ImageIcon className="h-4 w-4" /></button>
                              <input ref={(el) => { variantFileRefs.current[idx] = el; }} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleVariantImageSelect(idx, e)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasVariants && <p className="text-sm text-muted-foreground">No variations needed? You can skip this step.</p>}
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Review your product</h3>
            <p className="text-sm text-muted-foreground">Check everything before publishing. Use Edit to change any section.</p>
            {([
              { title: "Product Details", to: 1, rows: [["Name", form.name], ["Category", categoryPath.join(" > ")], ["Brand", form.brand], ["Model / MPN", form.mpn], ["Condition", form.condition === "new" ? "New" : "Used"], ["Key features", `${keyFeatures.filter(f => f.trim()).length} listed`], ["What's in the box", `${whatsInBoxItems.filter(f => f.trim()).length} items`], ["Specifications", `${normalizeSpecifications(specs).length} listed`]] },
              { title: "Pricing & Inventory", to: 2, rows: [["Price", form.price ? `CA$${Number(form.price).toFixed(2)}` : ""], ["Compare at", form.compareAtPrice ? `CA$${Number(form.compareAtPrice).toFixed(2)}` : ""], ["SKU", form.sku || "Auto-generated"], ["Barcode", inv.barcode], ["Stock", hasVariants ? `Managed by variants (Total: ${variantRows.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)})` : form.stock], ["Order quantity", `Min ${inv.minQty || 1}${inv.maxQty ? ` · Max ${inv.maxQty}` : ""}`]] },
              { title: "Shipping", to: 2, rows: [["Weight", pkg.weightG ? `${pkg.weightG} g` : ""], ["Package", pkg.lengthCm ? `${pkg.lengthCm} × ${pkg.widthCm} × ${pkg.heightCm} cm` : ""], ...(Object.keys(SHIP_LABELS) as ShipKey[]).filter(k => shipping[k].enabled).map(k => [SHIP_LABELS[k], `${shipDaysLabel(k, shipping[k].days)} · ${shipping[k].price > 0 ? `CA$${shipping[k].price.toFixed(2)}` : "Free"}`])] },
              { title: "Media", to: 3, rows: [["Images", `${images.length} uploaded`], ["Video", videoUrl]] },
              { title: "Seller", to: -1, rows: [["Store", vendor?.store_name]] },
            ] as { title: string; to: number; rows: [string, any][] }[]).map((sec) => (
              <div key={sec.title} className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <h4 className="font-semibold">{sec.title}</h4>
                  {sec.to >= 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setStep(sec.to)}>Edit</Button>}
                </div>
                {sec.title === "Media" && images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto px-4 pt-3">{images.slice(0, 6).map((im, i) => <img key={i} src={im.preview} alt="" className="h-14 w-14 shrink-0 rounded border border-border object-cover" />)}</div>
                )}
                <dl className="divide-y divide-border px-4 text-sm">
                  {sec.rows.map(([k, v]) => <div key={k} className="grid grid-cols-[40%_1fr] gap-2 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium break-words">{v || "N/A"}</dd></div>)}
                </dl>
              </div>
            ))}
            {hasVariants && variantRows.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <h4 className="font-semibold">Variants ({variantRows.length} combinations)</h4>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setStep(4)}>Edit</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">Variant</th><th className="p-2">Price</th><th className="p-2">Stock</th><th className="p-2">SKU</th><th className="p-2">Image</th></tr></thead>
                    <tbody>{variantRows.map((v, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(", ")}</td>
                        <td className="p-2">CA${Number(v.price || form.price || 0).toFixed(2)}</td>
                        <td className="p-2">{v.stock}</td>
                        <td className="p-2">{v.sku || "Auto"}</td>
                        <td className="p-2">{v.imagePreviews[0] ? <img src={v.imagePreviews[0]} alt="" className="h-8 w-8 rounded object-cover" /> : "—"}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" className="h-12 flex-1" onClick={back} disabled={loading}>Back</Button>
              <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => handleSubmit("draft")} disabled={loading}>Save as Draft</Button>
              <Button type="button" className="h-12 flex-1 font-bold" onClick={() => handleSubmit("active")} disabled={loading}>{loading ? "Saving..." : "Publish Product"}</Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 5 && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            {step > 0 && <Button type="button" variant="outline" className="flex-1" onClick={back}>Back</Button>}
            <Button type="button" className="flex-1" onClick={next}>
              {step === 4 ? "Review" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProductPage;
