import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import VendorProfileChecklist from "@/components/vendor/VendorProfileChecklist";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ImageIcon, Store, Building2, Truck, CreditCard, Receipt, PackageCheck, FileText, Palette, Bell, Users, Shield, ShieldCheck, ChevronRight, ExternalLink, RotateCcw } from "lucide-react";
import { convertImageToWebp } from "@/lib/imageToWebp";

type ImageKind = "logo" | "banner";

type JsonRecord = Record<string, unknown>;

const asJsonRecord = (value: unknown): JsonRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
};

const addressValue = (value: unknown, key: string) => {
  const field = asJsonRecord(value)[key];
  return typeof field === "string" ? field : "";
};

const normalizedAddress = (value: unknown) => {
  const address = asJsonRecord(value);
  return {
    street1: addressValue(address, "street1").trim(),
    city: addressValue(address, "city").trim(),
    state: addressValue(address, "state").trim(),
    zip: addressValue(address, "zip").trim(),
    country: addressValue(address, "country").trim(),
    phone: addressValue(address, "phone").trim(),
  };
};

interface ImageUploadFieldProps {
  kind: ImageKind;
  label: string;
  value: string;
  userId: string;
  onChange: (url: string) => void;
}

const ImageUploadField = ({ kind, label, value, userId, onChange }: ImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    if (!original.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (original.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller");
      return;
    }
    if (!userId) {
      toast.error("You must be signed in to upload");
      return;
    }
    setUploading(true);
    try {
      const file = await convertImageToWebp(original);
      const ext = file.name.split(".").pop() || "webp";
      const path = `uploads/${userId}/vendor-assets/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success(`${label} uploaded — click Save Settings to keep changes`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isLogo = kind === "logo";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex items-start gap-3">
        <div
          className={
            isLogo
              ? "h-24 w-24 shrink-0 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center"
              : "w-full max-w-sm aspect-video rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center"
          }
        >
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        {isLogo && (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={uploading}>
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      {!isLogo && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {value ? "Replace banner" : "Upload banner"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={uploading}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {isLogo ? "Square image recommended (e.g., 400x400). Max 5MB." : "Wide image recommended (e.g., 1600x900). Max 5MB."}
      </p>
    </div>
  );
};

const VendorSettings = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    store_name: vendor.store_name || "",
    store_description: vendor.store_description || "",
    logo_url: vendor.logo_url || "",
    banner_url: vendor.banner_url || "",
    slug: vendor.slug || "",
    phone: vendor.phone || "",
    phone2: vendor.phone2 || "",
    whatsapp: vendor.whatsapp || "",
    website: vendor.website || "",
    warehouse_address: vendor.warehouse_address || {},
    store_email: vendor.store_email || "",
    primary_category_id: vendor.primary_category_id || null as string | null,
    additional_category_ids: (vendor.additional_category_ids || []) as string[],
    public_store_address: asJsonRecord(vendor.public_store_address),
    store_language: vendor.store_language || "en",
    contact_visibility: vendor.contact_visibility || "all",
  });
  const warehouse = asJsonRecord(form.warehouse_address);
  const publicAddress = asJsonRecord(form.public_store_address);
  const { data: categories = [] } = useQuery({
    queryKey: ["store-settings-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,parent_id").order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const setPublicAddress = (key: string, value: string) => setForm(f => ({ ...f, public_store_address: { ...asJsonRecord(f.public_store_address), [key]: value } }));
  const [saving, setSaving] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState<"checking" | "available" | "taken" | "error" | null>(null);
  const [initialForm, setInitialForm] = useState(JSON.stringify(form));
  const [section, setSection] = useState<"profile" | "branding" | "shipping" | "payouts" | "business" | "security" | "compliance" | "tax" | "returns" | "policies" | "notifications" | "team">("profile");

  useEffect(() => {
    const nextForm = {
      store_name: vendor.store_name || "",
      store_description: vendor.store_description || "",
      logo_url: vendor.logo_url || "",
      banner_url: vendor.banner_url || "",
      slug: vendor.slug || "",
      phone: vendor.phone || "",
      phone2: vendor.phone2 || "",
      whatsapp: vendor.whatsapp || "",
      website: vendor.website || "",
      warehouse_address: asJsonRecord(vendor.warehouse_address),
      store_email: vendor.store_email || "",
      primary_category_id: vendor.primary_category_id || null,
      additional_category_ids: vendor.additional_category_ids || [],
      public_store_address: asJsonRecord(vendor.public_store_address),
      store_language: vendor.store_language || "en",
      contact_visibility: vendor.contact_visibility || "all",
    };
    setForm(nextForm);
    setInitialForm(JSON.stringify(nextForm));
  }, [vendor]);

  useEffect(() => {
    const slug = form.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugAvailability(null);
      return;
    }
    if (slug === vendor.slug) {
      setSlugAvailability("available");
      return;
    }
    setSlugAvailability("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from("vendors").select("id").eq("slug", slug).neq("id", vendor.id).limit(1);
      if (!cancelled) setSlugAvailability(error ? "error" : data?.length ? "taken" : "available");
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.slug, vendor.id, vendor.slug]);

  // Mirrors the server-side check used at checkout (validateWarehouse).
  const originIso = (() => {
    const c = addressValue(warehouse, "country").trim();
    if (c.length === 2) return c.toUpperCase();
    const map: Record<string, string> = { kenya: "KE", canada: "CA", "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB", india: "IN", australia: "AU" };
    return map[c.toLowerCase()] ?? c.slice(0, 2).toUpperCase();
  })();
  const missingOrigin: string[] = [];
  if (!addressValue(warehouse, "street1").trim()) missingOrigin.push("street address");
  if (!addressValue(warehouse, "city").trim()) missingOrigin.push("city");
  if (!addressValue(warehouse, "country").trim()) missingOrigin.push("country");
  if (!addressValue(warehouse, "phone").trim()) missingOrigin.push("pickup phone number");
  if (["US", "CA", "AU", "IN"].includes(originIso) && !addressValue(warehouse, "state").trim()) missingOrigin.push("state/province");
  if (["US", "CA", "GB", "DE", "FR", "AU", "IN", "CN", "NL", "ES", "IT"].includes(originIso) && !addressValue(warehouse, "zip").trim()) missingOrigin.push("postal code");

  const handleSave = async () => {
    const storeName = form.store_name.trim();
    const slug = form.slug.trim();
    if (!storeName) {
      toast.error("Store name is required.");
      setSection("profile");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast.error("Store URL must use lowercase letters, numbers and single hyphens, without leading or trailing hyphens.");
      setSection("profile");
      return;
    }
    if (form.store_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.store_email)) { toast.error("Enter a valid store email."); return; }
    if (!form.primary_category_id) { toast.error("Select a main store category."); setSection("profile"); return; }
    if (form.store_description.length > 500) { toast.error("Store description must be 500 characters or fewer."); setSection("profile"); return; }
    if (slugAvailability !== "available") { toast.error("Confirm that the store URL is available before saving."); setSection("profile"); return; }
    if (form.website.trim()) {
      try {
        const website = new URL(form.website.trim());
        if (!["https:", "http:"].includes(website.protocol)) throw new Error("Unsupported protocol");
      } catch {
        toast.error("Website must be a valid HTTP or HTTPS URL.");
        setSection("profile");
        return;
      }
    }
    setSaving(true);
    try {
      if (!user?.id) throw new Error("Your session has expired. Please sign in again.");
      const { data: updatedRows, error } = await supabase
        .from("vendors")
        .update(form)
        .eq("id", vendor.id)
        .eq("user_id", user.id)
        .select("id");
      if (error) throw error;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("No store record was updated. Reload the page and try again.");
      }

      const { data: privateRows, error: verifyError } = await supabase.rpc("get_vendor_private_fields_v2", {
        _vendor_id: vendor.id,
      });
      if (verifyError) throw verifyError;
      const persisted = Array.isArray(privateRows) ? privateRows[0] : null;
      if (!persisted || JSON.stringify(normalizedAddress(persisted.warehouse_address)) !== JSON.stringify(normalizedAddress(form.warehouse_address))) {
        throw new Error("Your store was updated, but the shipping origin could not be verified. Please try again.");
      }

      setInitialForm(JSON.stringify(form));
      await queryClient.invalidateQueries({ queryKey: ["vendor", user.id] });
      if (missingOrigin.length > 0) {
        toast.warning(`Settings saved and verified, but shipping still needs: ${missingOrigin.join(", ")}.`);
      } else {
        toast.success("Store settings and shipping origin saved and verified.");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Store settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    ["profile","Store Profile","Basic store information",Store],["business","Business Information","Legal business details",Building2],["shipping","Shipping Settings","Shipping options & zones",Truck],["payouts","Payments & Payouts","Bank accounts & payouts",CreditCard],["tax","Tax Settings","Tax registration & documents",Receipt],["returns","Returns & Refunds","Return and refund policies",PackageCheck],["policies","Store Policies","Store rules and policies",FileText],["branding","Appearance & Branding","Logo, banner and theme",Palette],["notifications","Notifications","Email and alert settings",Bell],["team","Team & Staff","Manage team members",Users],["security","Security & Account","Password, 2FA and access",Shield],["compliance","Account Health & Compliance","Verification and compliance",ShieldCheck]
  ] as const;
  const isDirty = JSON.stringify(form) !== initialForm;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6"/>Store Settings</h2><p className="text-sm text-muted-foreground">Manage your store and customize your selling experience.</p></div>
        <div className="flex flex-wrap gap-2 items-center"><span className="rounded-md border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-xs font-semibold">{vendor.status === "approved" ? "✓ Approved Seller Account" : `Seller Account: ${vendor.status || "Unknown"}`}</span><Link to={`/store/${vendor.slug}`} target="_blank" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><ExternalLink className="h-4 w-4"/>View Store</Link></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      <nav aria-label="Store settings sections" className="rounded-lg border bg-card p-2 space-y-1">
        {sections.map(([key,label,description,Icon],index) => (
          <button key={key} type="button" aria-current={section === key ? "step" : undefined} onClick={() => setSection(key)} className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${section === key ? "border-orange-500 bg-orange-50 text-orange-700" : "border-transparent hover:bg-muted"}`}>
            <span className="h-7 w-7 shrink-0 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">{index+1}</span>
            <Icon className="h-6 w-6 shrink-0"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span><ChevronRight className="h-4 w-4 shrink-0"/>
          </button>
        ))}
      </nav>
      <div className="bg-card rounded-lg border border-border p-4 md:p-6 min-w-0 space-y-5">
        {section === "profile" && (<div className="space-y-4"><div><h3 className="text-xl font-bold">Store Profile</h3><p className="text-sm text-muted-foreground">Manage your public store information. This will be displayed on your store page.</p></div><h4 className="font-semibold border-b pb-2">Basic Information</h4>
        <div>
          <Label>Store Name</Label>
          <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
        </div>
        <div>
          <Label>Store Description *</Label>
          <Textarea maxLength={500} value={form.store_description} onChange={(e) => setForm({ ...form, store_description: e.target.value })} rows={3} />
          <p className="text-right text-xs text-muted-foreground">{form.store_description.length}/500</p>
        </div>

        <div>
          <Label>Store URL</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">barakaz.com/store/</span>
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm({
                  ...form,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-"),
                })
              }
              placeholder="your-store-name"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lowercase letters, numbers and hyphens only. Must be unique.
          </p>
          {slugAvailability && <p role="status" className={`text-xs mt-1 ${slugAvailability === "available" ? "text-green-700" : slugAvailability === "taken" ? "text-red-600" : "text-muted-foreground"}`}>{slugAvailability === "checking" ? "Checking availability…" : slugAvailability === "available" ? "✓ Available" : slugAvailability === "taken" ? "This URL is already in use" : "Unable to check availability"}</p>}
        </div>
        <h4 className="font-semibold border-b pb-2">Store Category</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label htmlFor="main-category">Main Category *</Label><select id="main-category" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.primary_category_id || ""} onChange={e=>setForm(f=>({...f,primary_category_id:e.target.value || null,additional_category_ids:f.additional_category_ids.filter(id=>id!==e.target.value)}))}><option value="">Select a category</option>{categories.filter(c=>!c.parent_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label htmlFor="additional-categories">Additional Categories (Optional)</Label><select id="additional-categories" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value="" onChange={e=>{const id=e.target.value;if(id)setForm(f=>({...f,additional_category_ids:[...new Set([...f.additional_category_ids,id])]}));}}><option value="">Add a category</option>{categories.filter(c=>c.id!==form.primary_category_id&&!form.additional_category_ids.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex flex-wrap gap-1 mt-2">{form.additional_category_ids.map(id=><button type="button" key={id} onClick={()=>setForm(f=>({...f,additional_category_ids:f.additional_category_ids.filter(v=>v!==id)}))} className="text-xs border rounded px-2 py-1">{categories.find(c=>c.id===id)?.name || id} ×</button>)}</div></div>
        </div>
        </div>)}
        {section === "branding" && (<div className="space-y-4">
        <ImageUploadField
          kind="logo"
          label="Store Logo"
          value={form.logo_url}
          userId={user?.id || ""}
          onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
        />

        <ImageUploadField
          kind="banner"
          label="Store Banner"
          value={form.banner_url}
          userId={user?.id || ""}
          onChange={(url) => setForm((f) => ({ ...f, banner_url: url }))}
        />

        </div>)}
        {section === "profile" && (<div className="space-y-4">
        <h3 className="font-semibold pt-2 border-t border-border">Store Contact Information</h3>
        <p className="text-xs text-muted-foreground">These contact details are currently displayed according to the existing storefront implementation.</p>
        <div><Label>Store Email *</Label><Input type="email" value={form.store_email} onChange={e=>setForm({...form,store_email:e.target.value})} placeholder={user?.email || "store@example.com"}/></div>

        <div>
          <Label>Phone Number *</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 416 555 0123" />
        </div>
        <div>
          <Label>Phone Number 2 (Optional)</Label>
          <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} placeholder="+254 7XX XXX XXX" />
        </div>
        <div>
          <Label>WhatsApp Number</Label>
          <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+254 7XX XXX XXX" />
        </div>
        <div>
          <Label>Website (Optional)</Label>
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourstore.com" />
        </div>

        <h3 className="font-semibold border-t pt-4">Store Address (Public)</h3>
        <div className="grid md:grid-cols-2 gap-3">{([["country","Country"],["state","Province / State"],["city","City"],["zip","Postal / ZIP Code"]] as const).map(([key,label])=><div key={key}><Label>{label} *</Label><Input value={addressValue(publicAddress,key)} onChange={e=>setPublicAddress(key,e.target.value)} placeholder={key==="country"?"Canada":label}/></div>)}</div>
        <h3 className="font-semibold border-t pt-4">Store Language & Visibility</h3>
        <div className="grid md:grid-cols-2 gap-4"><div><Label>Store Language</Label><select className="w-full h-10 border rounded-md bg-background px-3" value={form.store_language} onChange={e=>setForm({...form,store_language:e.target.value})}><option value="en">English</option><option value="fr">French</option></select></div><fieldset><legend className="text-sm font-medium mb-2">Contact Information Visibility</legend>{([["all","Show all contact details"],["email","Show email only"],["phone","Show phone number only"],["hidden","Hide all contact details"]] as const).map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm mb-2"><input type="radio" name="contact-visibility" checked={form.contact_visibility===value} onChange={()=>setForm({...form,contact_visibility:value})}/>{label}</label>)}<p className="text-xs text-muted-foreground">Visibility preferences require storefront rendering support before they affect public pages.</p></fieldset></div>
        </div>)}
        {section === "shipping" && (<div className="space-y-4">
        <h3 className="font-semibold pt-2 border-t border-border">Shipping Origin Address</h3>
        <p className="text-xs text-muted-foreground">Used to calculate live shipping rates for buyers at checkout. Required for your products to be shippable.</p>

        {missingOrigin.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 text-warning p-3 text-xs">
            Shipping origin is incomplete — buyers cannot check out your products until you add: {missingOrigin.join(", ")}.
          </div>
        )}

        <div>
          <Label>Pickup Phone Number *</Label>
          <Input
            value={addressValue(warehouse, "phone")}
            onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, phone: e.target.value } })}
            placeholder="Phone the courier can call at pickup, with country code"
          />
        </div>

        <div>
          <Label>Street Address</Label>
          <Input
            value={addressValue(warehouse, "street1")}
            onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, street1: e.target.value } })}
            placeholder="e.g., 123 Moi Avenue"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>City</Label>
            <Input
              value={addressValue(warehouse, "city")}
              onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, city: e.target.value } })}
              placeholder="Nairobi"
            />
          </div>
          <div>
            <Label>State / Region</Label>
            <Input
              value={addressValue(warehouse, "state")}
              onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, state: e.target.value } })}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>ZIP / Postal Code</Label>
            <Input
              value={addressValue(warehouse, "zip")}
              onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, zip: e.target.value } })}
              placeholder="00100"
            />
          </div>
          <div>
            <Label>Country (ISO code or name)</Label>
            <Input
              value={addressValue(warehouse, "country")}
              onChange={(e) => setForm({ ...form, warehouse_address: { ...warehouse, country: e.target.value } })}
              placeholder="KE"
            />
          </div>
        </div>

        </div>)}
        {section === "payouts" && (<div className="space-y-4">
        <h3 className="font-semibold pt-2 border-t border-border">Secure Payout Settings</h3>
        <p className="text-xs text-muted-foreground">
          Bank details for seller payouts are collected securely through Stripe Connect, not published as customer-facing checkout instructions.
          <Link to="/vendor/payments" className="ml-1 text-primary underline">Manage Stripe payout account</Link>.
        </p>

        </div>)}
        {section === "business" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Verified Business Information</h3>
            <p className="text-sm text-muted-foreground">Legal identity, business registration and verification documents are managed through the seller application review process. These fields cannot be changed through public store settings.</p>
            <Link to="/vendor/register" className="text-sm text-primary underline">View seller registration and verification</Link>
          </div>
        )}
        {section === "security" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Security & Account</h3>
            <p className="text-sm text-muted-foreground">Account credentials and authentication settings are separate from public storefront settings. Never enter passwords or banking credentials into store profile fields.</p>
            <Link to="/auth" className="text-sm text-primary underline">Go to account sign-in</Link>
          </div>
        )}
        {section === "compliance" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Account Health & Compliance</h3>
            <p className="text-sm text-muted-foreground">Your seller eligibility and verification status are governed by the reviewed seller application and payout provider. Storefront settings cannot override compliance restrictions.</p>
            <p className="text-sm">Store approval: <span className="font-medium">{vendor.status || "Not available"}</span></p>
            <Link to="/vendor/register" className="text-sm text-primary underline">Review seller verification requirements</Link>
          </div>
        )}
        {section === "tax" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Tax Settings</h3>
            <p className="text-sm text-muted-foreground">Tax obligations depend on the seller's legal entity, registered jurisdiction, and applicable marketplace rules. Tax registrations and collection settings are not editable here until verified tax configuration is available.</p>
            <Link to="/vendor/register" className="text-sm text-primary underline">Review registered business details</Link>
          </div>
        )}
        {section === "returns" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Returns & Refunds</h3>
            <p className="text-sm text-muted-foreground">Refund decisions and payment reversals must follow the marketplace's authorized return workflow. This page does not issue refunds or override buyer protection policies.</p>
          </div>
        )}
        {section === "policies" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Store Policies</h3>
            <p className="text-sm text-muted-foreground">Published marketplace seller agreements and policies remain authoritative. Store-specific policy editing will be available only after a reviewed persistence and publishing workflow is implemented.</p>
            <Link to="/vendor/register" className="text-sm text-primary underline">Review seller agreements</Link>
          </div>
        )}
        {section === "notifications" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground">Essential order, payment, security and seller verification notices are controlled by the marketplace. Notification preferences cannot be changed until a secure, persistent preference service is implemented.</p>
          </div>
        )}
        {section === "team" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Team & Staff</h3>
            <p className="text-sm text-muted-foreground">Staff invitations, role assignments and access revocation are not enabled. Only authorized seller accounts should access store management. No staff permissions are granted from this page.</p>
          </div>
        )}
        {(["profile","branding","shipping"] as const).includes(section as "profile" | "branding" | "shipping") && <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setForm(JSON.parse(initialForm))} disabled={!isDirty || saving}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><div className="flex gap-2"><Button variant="outline" asChild><Link to={`/store/${vendor.slug}`} target="_blank"><ExternalLink className="h-4 w-4 mr-2"/>Preview Store</Link></Button><Button onClick={handleSave} disabled={saving || !isDirty || slugAvailability !== "available"}>{saving ? "Saving..." : "Save Settings"}</Button></div></div>}
      </div>
      </div>
    </div>
  );
};

export default VendorSettings;
