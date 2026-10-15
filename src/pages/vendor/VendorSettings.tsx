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
import { Loader2, Upload, Trash2, ImageIcon, Store, Building2, Mail, Link2, CheckCircle2, Save, Truck, CreditCard, Receipt, PackageCheck, FileText, Palette, Bell, Users, Shield, ShieldCheck, ChevronRight, ExternalLink, RotateCcw } from "lucide-react";
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
    store_email: "" || "",
    primary_category_id: null || null as string | null,
    additional_category_ids: ([] || []) as string[],
    public_store_address: asJsonRecord({}),
    store_language: "en" || "en",
    contact_visibility: "all" || "all",
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
      store_email: "" || "",
      primary_category_id: null || null,
      additional_category_ids: [] || [],
      public_store_address: asJsonRecord({}),
      store_language: "en" || "en",
      contact_visibility: "all" || "all",
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
        .update({ store_name: form.store_name, store_description: form.store_description, logo_url: form.logo_url, banner_url: form.banner_url, slug: form.slug, phone: form.phone, phone2: form.phone2, whatsapp: form.whatsapp, website: form.website, warehouse_address: form.warehouse_address })
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

  // Business Information is a UI-only draft until seller verification integration is approved.
  const businessInitial = {
    type: "sole_proprietor", legalName: vendor.store_name || "", registration: "", tradingName: vendor.store_name || "",
    email: user?.email || "", phone: vendor.phone || "", website: vendor.website || "",
    country: "Canada", province: "", street: "", city: "", unit: "", postal: "",
    taxId: "", taxCountry: "Canada", taxType: "GST / HST",
  };
  const [businessDraft, setBusinessDraft] = useState(businessInitial);
  const { data: sellerApplication } = useQuery({
    queryKey: ["seller-settings-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_applications")
        .select("id,business_type,country,business_info,status,kyc_status,vendor_id")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!sellerApplication) return;
    const details = asJsonRecord(sellerApplication.business_info);
    const pick = (...keys: string[]) => keys.map(key => details[key]).find(value => typeof value === "string") as string | undefined;
    setBusinessDraft(current => ({...current,
      type: sellerApplication.business_type || current.type,
      country: sellerApplication.country || current.country,
      legalName: pick("legal_business_name","legal_name","business_name") || current.legalName,
      registration: pick("registration_number","business_registration_number") || current.registration,
      tradingName: pick("trading_name","doing_business_as") || current.tradingName,
      email: pick("business_email","email") || current.email,
      phone: pick("business_phone","phone") || current.phone,
      website: pick("business_website","website") || current.website,
      province: pick("province","state") || current.province,
      street: pick("street_address","address_line1") || current.street,
      city: pick("city") || current.city,
      unit: pick("suite","unit") || current.unit,
      postal: pick("postal_code","zip") || current.postal,
      taxId: pick("tax_id","tax_number") || current.taxId,
    }));
  }, [sellerApplication]);
  const [businessFiles, setBusinessFiles] = useState<Record<string, File | null>>({});
  const [businessCountryCode, setBusinessCountryCode] = useState("+1");
  const canadianProvinces = ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"];
  const { data: verifiedDocuments = [] } = useQuery({
    queryKey: ["seller-settings-documents", sellerApplication?.id],
    enabled: !!sellerApplication?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_verification_documents")
        .select("id,requirement_code,verification_status,uploaded_at,review_reason")
        .eq("application_id", sellerApplication!.id);
      if (error) throw error;
      return data || [];
    },
  });
  const updateBusiness = (key: keyof typeof businessDraft, value: string) => setBusinessDraft(previous => ({ ...previous, [key]: value }));
  const businessInput = (key: keyof typeof businessDraft, label: string, required = false, hint = "", type = "text") => (
    <div className="space-y-1"><Label htmlFor={`business-${key}`}>{label}{required && <span className="text-red-600"> *</span>}</Label>
    <Input id={`business-${key}`} type={type} value={businessDraft[key]} onChange={event => updateBusiness(key, event.target.value)} />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
  );
  const businessSelect = (key: keyof typeof businessDraft, label: string, choices: string[], required = false) => (
    <div className="space-y-1"><Label htmlFor={`business-${key}`}>{label}{required && <span className="text-red-600"> *</span>}</Label>
    <select id={`business-${key}`} value={businessDraft[key]} onChange={event => updateBusiness(key,event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
      {choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
    </select></div>
  );
  const sections = [
    ["profile","Store Profile","Basic store information",Store],["business","Business Information","Legal business details",Building2],["shipping","Shipping Settings","Shipping options & zones",Truck],["payouts","Payments & Payouts","Bank accounts & payouts",CreditCard],["tax","Tax Settings","Tax registration & documents",Receipt],["returns","Returns & Refunds","Return and refund policies",PackageCheck],["policies","Store Policies","Store rules and policies",FileText],["branding","Appearance & Branding","Logo, banner and theme",Palette],["notifications","Notifications","Email and alert settings",Bell],["team","Team & Staff","Manage team members",Users],["security","Security & Account","Password, 2FA and access",Shield],["compliance","Account Health & Compliance","Verification and compliance",ShieldCheck]
  ] as const;
  const [warehouseEditorOpen,setWarehouseEditorOpen] = useState(false);
  const [shippingPreview,setShippingPreview] = useState({phone:true,po:false,eta:true,handling:true,processing:"1 – 2 business days",fee:"0.00"});
  const isDirty = JSON.stringify(form) !== initialForm;
  const uiOnlyDirty = (() => { const previous = JSON.parse(initialForm); return ["store_email","primary_category_id","additional_category_ids","public_store_address","store_language","contact_visibility"].some(key => JSON.stringify(form[key as keyof typeof form]) !== JSON.stringify(previous[key])); })();
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
        {section === "profile" && (<div className="space-y-4"><div><h3 className="text-xl font-bold">Store Profile</h3><p className="text-sm text-muted-foreground">Manage your public store information. This will be displayed on your store page.</p><p className="text-xs text-amber-700 mt-2">UI preview: category, store email, public address, language and visibility controls are not connected to the database yet.</p></div><h4 className="font-semibold border-b pb-2">Basic Information</h4>
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
        {section === "shipping" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3"><Truck className="h-9 w-9 text-orange-600 shrink-0"/><div><h3 className="text-xl md:text-2xl font-bold">3. Shipping Settings</h3><p className="text-sm text-muted-foreground">Manage your shipping options, warehouse addresses, delivery rates and shipping zones.</p></div></div>
              <Button variant="outline" size="sm" asChild><Link to="/vendor/help"><FileText className="h-4 w-4 mr-2"/>Shipping Guide</Link></Button>
            </div>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="font-semibold">Warehouse Addresses</h4><p className="text-xs text-muted-foreground">Your fulfillment address is used to calculate shipping rates and delivery times.</p></div><Button type="button" size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={()=>toast.info("Additional warehouses need backend support. Edit your main warehouse below.")}>+ Add Warehouse</Button></div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex gap-3 items-start"><span className="rounded-md bg-orange-100 text-orange-600 p-2"><Store className="h-5 w-5"/></span><div><p className="font-semibold text-sm">Main Warehouse <span className="text-xs text-green-700 bg-green-50 rounded px-2 py-0.5 ml-1">Default</span></p><p className="text-xs text-muted-foreground">{[addressValue(warehouse,"street1"),addressValue(warehouse,"city"),addressValue(warehouse,"state"),addressValue(warehouse,"zip")].filter(Boolean).join(", ") || "Address not configured"}</p><p className="text-xs text-muted-foreground">🌐 {addressValue(warehouse,"country") || "Country not set"}</p></div></div>
                <Button type="button" variant="outline" size="sm" onClick={()=>setWarehouseEditorOpen(value=>!value)}>{warehouseEditorOpen ? "Close" : "✎ Edit"}</Button>
              </div>
              {(warehouseEditorOpen || missingOrigin.length>0) && <div className="rounded-lg border p-3 space-y-3">
                {missingOrigin.length>0 && <p className="text-xs text-amber-700">Complete the shipping origin: {missingOrigin.join(", ")}.</p>}
                <div className="grid md:grid-cols-2 gap-3">{([["phone","Pickup Phone *"],["street1","Street Address *"],["city","City *"],["state","Province / State"],["zip","Postal / ZIP Code"],["country","Country (ISO code or name) *"]] as const).map(([key,label])=><div key={key} className="space-y-1"><Label htmlFor={`shipping-${key}`}>{label}</Label><Input id={`shipping-${key}`} value={addressValue(warehouse,key)} onChange={e=>setForm(old=>({...old,warehouse_address:{...asJsonRecord(old.warehouse_address),[key]:e.target.value}}))}/></div>)}</div>
                <p className="text-xs text-muted-foreground">Save the main warehouse with the Save Changes button below. Additional warehouses are not yet supported.</p>
              </div>}
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="font-semibold">Shipping Zones &amp; Destinations</h4><p className="text-xs text-muted-foreground">View the regions you can ship to. Zone management requires shipping-rule integration.</p></div><Button size="sm" variant="outline" onClick={()=>toast.info("Adding shipping zones is not available until zone persistence is implemented.")}>+ Add Shipping Zone</Button></div>
              <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead className="bg-muted/50 text-left"><tr>{["Zone / Region","Countries","Status","Actions"].map(h=><th key={h} className="p-3 border font-medium">{h}</th>)}</tr></thead><tbody>{([["🇨🇦","Domestic (Canada)","All Provinces & Territories"],["🇺🇸","United States","All States"],["🌐","International","Selected Countries (120+)"]] as const).map(([flag,name,desc])=><tr key={name}><td className="p-3 border"><span className="mr-2">{flag}</span>{name}</td><td className="p-3 border text-muted-foreground">{desc}</td><td className="p-3 border"><span className="text-xs text-muted-foreground">Preview</span></td><td className="p-3 border"><Button size="sm" variant="outline" onClick={()=>toast.info("Shipping zone editing is not yet connected.")}>Edit</Button></td></tr>)}</tbody></table></div>
              <p className="text-xs text-amber-700">Zone rows reproduce the reference layout; they are not confirmed active shipping rules. Checkout shipping availability is controlled by the existing shipping backend.</p>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="font-semibold">Shipping Methods</h4><p className="text-xs text-muted-foreground">Standard and Express shipping options currently configured for checkout.</p></div><Button variant="outline" size="sm" onClick={()=>toast.info("Custom shipping methods require backend integration.")}>+ Add Shipping Method</Button></div>
              {([{name:"Standard Shipping",price:"12.50",time:"3 – 7 business days",description:"Reliable delivery at an affordable rate.",icon:"📦"},{name:"Express Shipping",price:"19.99",time:"1 – 3 business days",description:"Faster delivery for urgent orders.",icon:"🚚"}] as const).map(method=><div key={method.name} className="rounded-lg border p-3 space-y-3">
                <div className="flex justify-between gap-2"><div className="flex gap-3"><span className="text-2xl">{method.icon}</span><div><p className="text-sm font-semibold">{method.name} <span className="ml-2 text-xs text-green-700 bg-green-50 rounded px-2 py-0.5">Configured</span></p><p className="text-xs text-muted-foreground">{method.description}</p></div></div><Button size="sm" variant="outline" onClick={()=>toast.info("Shipping method editing requires the checkout rate configuration to be connected.")}>✎ Edit</Button></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div><Label>Price (CAD)</Label><Input value={method.price} readOnly aria-label={`${method.name} price`}/></div><div><Label>Delivery Time</Label><Input value={method.time} readOnly aria-label={`${method.name} delivery time`}/></div><div><Label>Tracking</Label><Input value="Carrier dependent" readOnly/></div><div><Label>Applies To</Label><Input value="Checkout rules" readOnly/></div></div>
              </div>)}
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <h4 className="font-semibold">Additional Shipping Settings</h4>
              <div className="grid md:grid-cols-3 gap-4"><div className="space-y-2">{([["phone","Require phone number for shipping"],["po","Allow PO Box addresses"],["eta","Show estimated delivery date at checkout"],["handling","Include handling time"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange-600" checked={shippingPreview[key]} onChange={e=>setShippingPreview(old=>({...old,[key]:e.target.checked}))}/>{label}</label>)}</div><div className="space-y-1"><Label>Processing Time</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={shippingPreview.processing} onChange={e=>setShippingPreview(old=>({...old,processing:e.target.value}))}><option>1 – 2 business days</option><option>3 – 5 business days</option><option>5 – 7 business days</option></select><p className="text-xs text-muted-foreground">Time needed to prepare and ship orders.</p></div><div className="space-y-1"><Label>Handling Fee (Optional)</Label><div className="relative"><Input type="number" min="0" step="0.01" value={shippingPreview.fee} onChange={e=>setShippingPreview(old=>({...old,fee:e.target.value}))}/><span className="absolute right-3 top-3 text-xs text-muted-foreground">CAD</span></div><p className="text-xs text-muted-foreground">Additional fee per order (e.g. packaging).</p></div></div>
              <p className="text-xs text-amber-700">Additional settings are a design preview and do not change checkout behavior until the shipping configuration backend supports them.</p>
              <div className="flex justify-end"><Button className="bg-orange-600 hover:bg-orange-700" disabled={saving || !isDirty || uiOnlyDirty || slugAvailability!=="available"} onClick={handleSave}>{saving ? "Saving..." : "Save Changes"}</Button></div>
            </section>
          </div>
        )}
        {section === "payouts" && (<div className="space-y-4">
        <h3 className="font-semibold pt-2 border-t border-border">Secure Payout Settings</h3>
        <p className="text-xs text-muted-foreground">
          Bank details for seller payouts are collected securely through Stripe Connect, not published as customer-facing checkout instructions.
          <Link to="/vendor/payments" className="ml-1 text-primary underline">Manage Stripe payout account</Link>.
        </p>

        </div>)}
        {section === "business" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3"><Building2 className="h-9 w-9 text-violet-600 shrink-0"/><div><h3 className="text-xl md:text-2xl font-bold">2. Business Information</h3><p className="text-sm text-muted-foreground">Manage your legal business details. This information is used for verification, tax and payout purposes.</p></div></div>
            <p className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3">Existing seller application details are loaded where available. Edits and document selections remain preview-only; verification changes must use the approved onboarding workflow.</p>
            {sellerApplication && <p className="text-xs text-muted-foreground">Application status: <strong>{sellerApplication.status}</strong> · Identity verification: <strong>{sellerApplication.kyc_status}</strong> · <Link className="underline text-primary" to="/vendor/register">Open verification workflow</Link></p>}
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Type</h4>
              <div className="grid md:grid-cols-3 gap-3">{([
                ["individual","Individual Seller","Selling as a person (no registered business)"],
                ["sole_proprietor","Sole Proprietorship (Self Employed)","You own the business personally"],
                ["company","Incorporated Company","Registered business (e.g. Ltd, Inc, Corp)"]
              ] as const).map(([value,label,help]) => <label key={value} className="flex items-start gap-2 cursor-pointer"><input type="radio" className="mt-1 accent-orange-600" name="business-type" checked={businessDraft.type === value} onChange={() => updateBusiness("type",value)}/><span><span className="text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{help}</span></span></label>)}</div>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Legal Business Information</h4><div className="grid md:grid-cols-2 gap-4">
              {businessInput("legalName","Legal Business Name",true,"Your official business name as per legal documents.")}
              {businessInput("registration","Business Registration Number (Optional)",false,"Company registration or business licence number.")}
              {businessInput("tradingName","Doing Business As (Trading Name)",false,"Your store or trading name (if different).")}
              <div className="space-y-1"><Label htmlFor="business-email">Business Email <span className="text-red-600">*</span></Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-orange-600"/><Input id="business-email" className="pl-9" type="email" value={businessDraft.email} onChange={e=>updateBusiness("email",e.target.value)}/></div><p className="text-xs text-muted-foreground">Official business email address.</p></div>
              <div className="space-y-1"><Label htmlFor="business-phone">Business Phone <span className="text-red-600">*</span></Label><div className="flex rounded-md border border-input overflow-hidden"><select aria-label="Phone country code" className="shrink-0 bg-muted px-2 text-sm border-r" value={businessCountryCode} onChange={e=>setBusinessCountryCode(e.target.value)}><option value="+1">🇨🇦 +1</option><option value="+254">🇰🇪 +254</option><option value="+44">🇬🇧 +44</option><option value="+61">🇦🇺 +61</option></select><Input id="business-phone" className="border-0 rounded-none focus-visible:ring-0" type="tel" value={businessDraft.phone} onChange={e=>updateBusiness("phone",e.target.value)}/></div><p className="text-xs text-muted-foreground">Primary business contact number.</p></div>
              <div className="space-y-1"><Label htmlFor="business-website">Business Website (Optional)</Label><div className="relative"><Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="business-website" className="pl-9" type="url" value={businessDraft.website} onChange={e=>updateBusiness("website",e.target.value)}/></div><p className="text-xs text-muted-foreground">Your official business website.</p></div>
            </div></section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Address</h4><div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Country <span className="text-red-600">*</span></Label><div className="relative"><span className="absolute left-3 top-2.5">🇨🇦</span><select aria-label="Business country" className="w-full h-10 rounded-md border border-input bg-background pl-11 pr-3 text-sm" value={businessDraft.country} onChange={e=>setBusinessDraft(old=>({...old,country:e.target.value,province:""}))}>{["Canada","United States","United Kingdom","Kenya","Other"].map(country=><option key={country}>{country}</option>)}</select></div></div>
              {businessDraft.country === "Canada" ? businessSelect("province","Province / State",["Select a province",...canadianProvinces],true) : businessInput("province","Province / State",true)}
              {businessInput("street","Street Address",true)}
              {businessInput("city","City",true)}
              {businessInput("unit","Suite / Unit (Optional)")}
              {businessInput("postal","Postal / ZIP Code",true)}
            </div></section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Documents</h4>
              {verifiedDocuments.length > 0 && <div className="rounded-md bg-muted p-3"><p className="text-sm font-medium mb-2">Documents already submitted for verification</p>{verifiedDocuments.map(doc => <p key={doc.id} className="text-xs py-1">{doc.requirement_code.replace(/_/g," ")} — <strong>{doc.verification_status}</strong></p>)}<p className="text-xs text-muted-foreground mt-1">Document contents are private and are not exposed in Store Settings.</p></div>}<p className="text-xs text-muted-foreground">Choose clear and valid documents for a future verification step. JPG, PNG or PDF (maximum 10MB each).</p>
              <div className="grid md:grid-cols-3 gap-3">{(["Business License / Registration","Government ID","Tax Document (Optional)"] as const).map(label => <div key={label} className="rounded-md border p-3 space-y-2"><p className="text-xs font-semibold">{label}</p><label className="flex min-h-24 flex-col items-center justify-center gap-1 rounded border border-dashed cursor-pointer text-center p-2">{businessFiles[label] ? <><div className="flex items-center gap-2"><FileText className="h-8 w-8 text-muted-foreground"/><span className="text-xs break-all">{businessFiles[label]?.name}</span><CheckCircle2 className="h-4 w-4 text-green-600"/></div><span className="text-xs text-muted-foreground">{(businessFiles[label]!.size / 1024).toFixed(0)} KB · Selected, not uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground"/><span className="text-xs">Upload Document</span><span className="text-xs text-muted-foreground">JPG, PNG or PDF (Max 10MB)</span></>}<input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => {const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024 || !["image/jpeg","image/png","application/pdf"].includes(file.type)){toast.error("Choose a JPG, PNG or PDF under 10MB.");e.target.value="";return;}setBusinessFiles(old=>({...old,[label]:file}));}}/></label>{businessFiles[label] && <button type="button" className="text-xs text-orange-700 underline" onClick={()=>setBusinessFiles(old=>({...old,[label]:null}))}>Remove selection</button>}</div>)}</div>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Tax Information</h4><div className="grid md:grid-cols-3 gap-4">
              {businessInput("taxId","Tax ID Number (Optional)",false,"GST/HST, EIN, VAT or other tax identification number.")}
              <div className="space-y-1"><Label>Tax Registration Country</Label><div className="relative"><span className="absolute left-3 top-2.5">🇨🇦</span><select aria-label="Tax registration country" className="w-full h-10 rounded-md border border-input bg-background pl-11 pr-3 text-sm" value={businessDraft.taxCountry} onChange={e=>updateBusiness("taxCountry",e.target.value)}>{["Canada","United States","United Kingdom","Kenya","Other"].map(country=><option key={country}>{country}</option>)}</select></div></div>
              {businessSelect("taxType","Tax Type",["GST / HST","PST / QST","VAT","Sales Tax","Not Registered"])}
            </div></section>
            <div className="flex justify-between gap-3 border-t pt-4"><Button variant="outline" type="button" onClick={()=>{setBusinessDraft(businessInitial);setBusinessFiles({});}}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><Button type="button" disabled title="Database integration pending" className="bg-orange-600 hover:bg-orange-700"><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
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
        {(["profile","branding"] as const).includes(section as "profile" | "branding" | "shipping") && <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setForm(JSON.parse(initialForm))} disabled={!isDirty || saving}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><div className="flex gap-2"><Button variant="outline" asChild><Link to={`/store/${vendor.slug}`} target="_blank"><ExternalLink className="h-4 w-4 mr-2"/>Preview Store</Link></Button><Button onClick={handleSave} disabled={saving || !isDirty || slugAvailability !== "available" || uiOnlyDirty} title={uiOnlyDirty ? "Preview-only fields cannot be saved until database integration" : undefined}>{saving ? "Saving..." : "Save Settings"}</Button></div></div>}
      </div>
      </div>
    </div>
  );
};

export default VendorSettings;
