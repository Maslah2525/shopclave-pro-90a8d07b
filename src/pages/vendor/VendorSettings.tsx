import { useEffect, useRef, useState } from "react";
import StoreSetupSubmitCard from "@/components/vendor/StoreSetupSubmitCard";
import { storeSetupChecklist } from "@/lib/storeSetup";
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
import { Loader2, Upload, Trash2, ImageIcon, Store, Building2, Mail, Link2, CheckCircle2, Save, Truck, CreditCard, Receipt, PackageCheck, FileText, Palette, Bell, Users, Shield, ShieldCheck, ChevronRight, PanelLeftOpen, PanelLeftClose, ExternalLink, RotateCcw } from "lucide-react";
import { convertImageToWebp } from "@/lib/imageToWebp";
import { mergeSettings, publicStoreSettings, restoreSettings, sameSettings, settingsRecord } from "@/lib/vendorSettingsPersistence";
import { COUNTRIES, addressFormat, countryByCode, countryByName } from "@/lib/countries";
import CountrySelector from "@/components/vendor/CountrySelector";
import { paymentMethods } from "@/lib/paymentMethods";
import { CANADIAN_BANKS, sellerPayoutMethod } from "@/lib/sellerPayoutPreferences";
import type { Json } from "@/integrations/supabase/types";
import WithdrawalRequests from "@/components/vendor/WithdrawalRequests";
import { canadianBankSchema } from "@/lib/withdrawalRules";

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
    store_email: "",
    primary_category_id: null as string | null,
    additional_category_ids: [] as string[],
    public_store_address: asJsonRecord({}),
    store_language: "en",
    contact_visibility: "all",
  });
  const { data: savedPreferences, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: ["vendor-settings-preferences", vendor.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_settings_preferences").select("section,settings").eq("vendor_id", vendor.id);
      if (error) throw error;
      return Object.fromEntries((data || []).map(row => [row.section, settingsRecord(row.settings)]));
    },
  });
  const hydratedVendor = useRef<string | null>(null);
  const savedPreferenceRef = useRef<Record<string, Record<string, unknown>>>({});
  const warehouse = asJsonRecord(form.warehouse_address);
  const publicAddress = asJsonRecord(form.public_store_address);
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ["store-settings-root-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,parent_id").is("parent_id", null).order("name").limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery({
    queryKey: ["store-settings-subcategories", form.primary_category_id],
    enabled: !!form.primary_category_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,parent_id").eq("parent_id", form.primary_category_id as string).order("name").limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const setPublicAddress = (key: string, value: string) => setForm(f => ({ ...f, public_store_address: { ...asJsonRecord(f.public_store_address), [key]: value, ...(key === "country" ? { state: "", city: "", zip: "" } : key === "state" ? { city: "", zip: "" } : {}) } }));
  const canadianCities: Record<string,string[]> = {
    "Alberta":["Calgary","Edmonton","Red Deer","Lethbridge","Medicine Hat"],
    "British Columbia":["Vancouver","Victoria","Surrey","Burnaby","Kelowna","Richmond"],
    "Manitoba":["Winnipeg","Brandon","Steinbach"],
    "New Brunswick":["Moncton","Saint John","Fredericton"],
    "Newfoundland and Labrador":["St. John's","Mount Pearl","Corner Brook"],
    "Northwest Territories":["Yellowknife","Hay River","Inuvik"],
    "Nova Scotia":["Halifax","Sydney","Truro"],
    "Nunavut":["Iqaluit","Rankin Inlet"],
    "Ontario":["Toronto","Ottawa","Mississauga","Brampton","Hamilton","London","Kitchener","Markham"],
    "Prince Edward Island":["Charlottetown","Summerside"],
    "Quebec":["Montreal","Quebec City","Laval","Gatineau","Longueuil"],
    "Saskatchewan":["Saskatoon","Regina","Prince Albert"],
    "Yukon":["Whitehorse","Dawson City"]
  };
  const canadaSelected = ["Canada","CA"].includes(addressValue(publicAddress,"country"));
  const addressCities = canadaSelected ? (canadianCities[addressValue(publicAddress,"state")] || []) : [];
  const chosenSubcategory = form.additional_category_ids.find(id => subcategories.some(c => c.id === id)) || "";
  const [saving, setSaving] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState<"checking" | "available" | "taken" | "error" | null>(null);
  const [initialForm, setInitialForm] = useState(JSON.stringify(form));
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false);
  const [section, setSection] = useState<"profile" | "branding" | "shipping" | "payouts" | "business" | "security" | "compliance" | "tax" | "returns" | "policies" | "notifications" | "team" | "overview">("overview");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("section") === "payouts") setSection("payouts"); }, []);

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
      store_email: "",
      primary_category_id: null as string | null,
      additional_category_ids: [] as string[],
      public_store_address: asJsonRecord({}),
      store_language: "en",
      contact_visibility: "all",
    };
    const restored = restoreSettings(nextForm, { ...settingsRecord(settingsRecord(vendor.store_settings).profile), ...settingsRecord(savedPreferenceRef.current.profile) });
    setForm(restored);
    setInitialForm(JSON.stringify(restored));
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

  const persistPreference = async (key: "profile" | "branding" | "shipping" | "business" | "tax" | "returns" | "policies" | "notifications" | "payouts" | "security", values: Record<string, unknown>) => {
    if (!user?.id || preferencesLoading || preferencesError) throw new Error("Store settings could not be loaded. Reload before saving.");
    const settings = mergeSettings(savedPreferenceRef.current[key], values);
    const { data, error } = await supabase.from("vendor_settings_preferences").upsert({ vendor_id: vendor.id, section: key, settings: settings as Json, updated_at: new Date().toISOString() }, { onConflict: "vendor_id,section" }).select("settings").single();
    if (error) throw error;
    if (!sameSettings(settings, data?.settings)) throw new Error("The saved settings could not be verified. Reload and try again.");
    savedPreferenceRef.current[key] = settings;
    queryClient.setQueryData(["vendor-settings-preferences", vendor.id], { ...savedPreferenceRef.current });
  };

  const profilePreferences = () => ({ store_email: form.store_email.trim(), primary_category_id: form.primary_category_id, additional_category_ids: form.additional_category_ids, public_store_address: form.public_store_address, store_language: form.store_language, contact_visibility: form.contact_visibility });

  const handleSave = async (): Promise<boolean> => {
    const storeName = form.store_name.trim();
    const slug = form.slug.trim();
    if (!storeName) {
      toast.error("Store name is required.");
      setSection("profile");
      return false;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast.error("Store URL must use lowercase letters, numbers and single hyphens, without leading or trailing hyphens.");
      setSection("profile");
      return false;
    }
    if (form.store_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.store_email)) { toast.error("Enter a valid store email."); return false; }


    if (form.store_description.length > 500) { toast.error("Store description must be 500 characters or fewer."); setSection("profile"); return false; }
    if (slugAvailability !== "available") { toast.error("Confirm that the store URL is available before saving."); setSection("profile"); return false; }
    if (form.website.trim()) {
      try {
        const website = new URL(form.website.trim());
        if (!["https:", "http:"].includes(website.protocol)) throw new Error("Unsupported protocol");
      } catch {
        toast.error("Website must be a valid HTTP or HTTPS URL.");
        setSection("profile");
        return false;
      }
    }
    const contactPhone = form.phone.trim();
    if (!contactPhone || !/^\+[1-9]\d{6,14}$/.test(contactPhone.replace(/[\s().-]/g, ""))) {
      toast.error("Enter a valid contact phone number with international country code (for example, +14165550123).");
      setSection("profile");
      return;
    }
    for (const [label, number] of [["Secondary phone", form.phone2], ["WhatsApp", form.whatsapp]] as const) {
      if (number.trim() && !/^\+[1-9]\d{6,14}$/.test(number.replace(/[\s().-]/g, ""))) {
        toast.error(`${label} must include a valid international country code.`);
        setSection("profile");
        return;
      }
    }
    setSaving(true);
    try {
      if (!user?.id) throw new Error("Your session has expired. Please sign in again.");
      await persistPreference("profile", profilePreferences());
      await persistPreference("branding", { ...brandingDraft });
      const publicSettings = publicStoreSettings(vendor.store_settings, profilePreferences(), { ...brandingDraft });
      const updates = { store_name: storeName, store_description: form.store_description, logo_url: form.logo_url, banner_url: form.banner_url, slug, phone: form.phone, phone2: form.phone2, whatsapp: form.whatsapp, website: form.website.trim(), warehouse_address: form.warehouse_address, store_settings: publicSettings as Json };
      const { data: updatedRows, error } = await supabase
        .from("vendors")
        .update(updates)
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

      const { data: publicReadback, error: readbackError } = await supabase.from("vendors").select("store_name,store_description,logo_url,banner_url,slug,phone,phone2,whatsapp,website,store_settings").eq("id", vendor.id).eq("user_id", user.id).single();
      if (readbackError) throw readbackError;
      const { warehouse_address: _address, ...publicUpdates } = updates;
      if (!sameSettings(publicReadback, publicUpdates)) throw new Error("Store changes could not be verified. Reload and try again.");
      setInitialForm(JSON.stringify(form));
      await queryClient.invalidateQueries({ queryKey: ["vendor", user.id] });
      if (missingOrigin.length > 0) {
        toast.warning(`Settings saved and verified, but shipping still needs: ${missingOrigin.join(", ")}.`);
      } else {
        toast.success("Store settings and shipping origin saved and verified.");
      }
      return true;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Store settings could not be saved.");
      return false;
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
        .eq("user_id", user?.id || "").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!sellerApplication) return;
    const details = asJsonRecord(sellerApplication.business_info);
    const pick = (...keys: string[]) => keys.map(key => details[key]).find(value => typeof value === "string") as string | undefined;
    if (savedPreferenceRef.current.business) return;
    setBusinessDraft(current => ({...current,
      type: sellerApplication.business_type || current.type,
      country: sellerApplication.country || current.country,
      legalName: pick("legal_business_name","legal_name","business_name") || current.legalName,
      registration: pick("registration_number","business_registration_number") || current.registration,
      tradingName: pick("trading_name","doing_business_as") || current.tradingName,
      email: pick("business_email","email") || current.email,
      phone: pick("business_phone","phone") || current.phone,
      website: pick("business_website","website") || current.website,
      province: pick("region","province","state") || current.province,
      street: pick("street_address","address_line1") || current.street,
      city: pick("city") || current.city,
      unit: pick("address_line2","suite","unit") || current.unit,
      postal: pick("postal_code","zip") || current.postal,
      taxId: pick("tax_identifier","tax_id","tax_number") || current.taxId,
    }));
  }, [sellerApplication]);
  const [businessFiles, setBusinessFiles] = useState<Record<string, File | null>>({});
  const [businessCountryCode, setBusinessCountryCode] = useState("+1");
  const canadianProvinces = ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"];
  const usStates = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];
  const australianStates = ["Australian Capital Territory","New South Wales","Northern Territory","Queensland","South Australia","Tasmania","Victoria","Western Australia"];
  const kenyanCounties = ["Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa","Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos","Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya","Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot"];
  const businessCountryIso = countryByName(businessDraft.country)?.code || (businessDraft.country.length===2?businessDraft.country.toUpperCase():"");
  const businessFormat = addressFormat(businessCountryIso || "");
  const businessRegions = ({CA:canadianProvinces,US:usStates,AU:australianStates,KE:kenyanCounties} as Record<string,string[]>)[businessCountryIso];
  const { data: verifiedDocuments = [] } = useQuery({
    queryKey: ["seller-settings-documents", sellerApplication?.id],
    enabled: !!sellerApplication?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_verification_documents")
        .select("id,requirement_code,verification_status,uploaded_at,review_reason")
        .eq("application_id", sellerApplication?.id || "");
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
    ["profile","Store Profile","Basic store information",Store],["business","Business Information","Legal business details",Building2],["shipping","Shipping Settings","Shipping options & zones",Truck],["payouts","Payments & Payouts","Bank accounts & payouts",CreditCard],["returns","Returns & Refunds","Return and refund policies",PackageCheck],["policies","Store Policies","Store rules and policies",FileText],["branding","Appearance & Branding","Logo, banner and theme",Palette],["notifications","Notifications","Email and alert settings",Bell],["team","Team & Staff","Manage team members",Users],["security","Security & Account","Password, 2FA and access",Shield]
  ] as const;
  const [warehouseEditorOpen,setWarehouseEditorOpen] = useState(false);
  const [shippingPreview,setShippingPreview] = useState({phone:true,po:false,eta:true,handling:true,processing:"1 – 2 business days",fee:"0.00"});
  const [shippingZonePreview,setShippingZonePreview] = useState<Record<string,boolean>>({ "Domestic (Canada)":false, "United States":false, "International":false });
  const [zoneEditor,setZoneEditor] = useState<string|null>(null);
  const [newZoneName,setNewZoneName] = useState("");
  const [newZoneRegions,setNewZoneRegions] = useState("");
  const [zoneCreatorOpen,setZoneCreatorOpen] = useState(false);
  const [additionalZones,setAdditionalZones] = useState<string[]>([]);
  const [zoneDrafts,setZoneDrafts] = useState<Record<string,string>>({"Domestic (Canada)":"All Provinces & Territories","United States":"All States","International":""});
  const [methodEditor,setMethodEditor] = useState<string|null>(null);
  const [methodDrafts,setMethodDrafts] = useState<Record<string,{price:string,time:string,tracking:string,applies:string}>>({"Standard Shipping":{price:"Live carrier rate",time:"Carrier estimate",tracking:"Enabled",applies:"Canada"},"Express Shipping":{price:"Live carrier rate",time:"Carrier estimate",tracking:"Enabled",applies:"Canada"}});

  const {data: sellerPayoutAccount, isLoading: payoutAccountLoading, isError: payoutAccountError} = useQuery({
    queryKey:["settings-stripe-payout",sellerApplication?.id],
    enabled:(section==="payouts" || section==="compliance") && !!sellerApplication?.id,
    queryFn:async()=>{const {data,error}=await supabase.from("seller_payout_accounts").select("provider,verification_status,charges_enabled,payouts_enabled,country,currency").eq("application_id",sellerApplication?.id || "").eq("provider","stripe").maybeSingle();if(error)throw error;return data;}
  });
  const {data: vendorFinancialItems, isLoading: financialLoading, isError: financialError} = useQuery({
    queryKey:["settings-vendor-financial-items",vendor?.id],
    enabled:section==="payouts" && !!vendor?.id && !!user?.id,
    queryFn:async()=>{const {data,error}=await supabase.from("order_items").select("id,order_id,price,quantity,commission_amount,commission_pct,payment_fee_amount,refunded_amount,vendor_payout,stripe_transfer_id,created_at").eq("vendor_id",vendor.id).order("created_at",{ascending:false}).limit(500);if(error)throw error;return data||[];}
  });
  const {data: vendorCommissionRates} = useQuery({
    queryKey:["settings-vendor-commission-rates"],
    enabled:section==="payouts",
    queryFn:async()=>{const {data,error}=await supabase.from("category_commission_rates").select("commission_pct");if(error)throw error;return data||[];}
  });
  const financialTotals = vendorFinancialItems ? vendorFinancialItems.reduce((acc,item)=>({gross:acc.gross+(item.price*item.quantity),net:acc.net+(item.vendor_payout??0),commission:acc.commission+item.commission_amount,refunds:acc.refunds+item.refunded_amount}),{gross:0,net:0,commission:0,refunds:0}) : null;
  const formatCad=(n:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n);
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<"bank" | "paypal">("bank");
  const activePayoutMethod = sellerPayoutMethod(businessCountryIso, selectedPayoutMethod);
  const isCanadianPayout = activePayoutMethod === "bank";
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutHolderName, setPayoutHolderName] = useState("");
  const [payoutTransitNumber, setPayoutTransitNumber] = useState("");
  const [payoutInstitutionNumber, setPayoutInstitutionNumber] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutPaypalEmail, setPayoutPaypalEmail] = useState("");
  const [payoutFrequency,setPayoutFrequency] = useState("Weekly");
  const [payoutToggles,setPayoutToggles] = useState({automatic:true,email:true,refunds:true});
  const [payoutDateFrom,setPayoutDateFrom] = useState("2026-10-01");
  const [payoutDateTo,setPayoutDateTo] = useState("2026-10-15");
  const [payoutStatus,setPayoutStatus] = useState("All Statuses");
  const [taxCalculation,setTaxCalculation]=useState<"marketplace"|"custom">("marketplace");
  const [taxExemptions,setTaxExemptions]=useState({organizations:false,exports:true,digital:false});
  const [taxDraft,setTaxDraft]=useState({country:"CA",type:"GST / HST",businessNumber:"",program:"",legalName:""});
  const [taxDocument,setTaxDocument]=useState<File|null>(null);
  const [showTaxRegions,setShowTaxRegions]=useState(false);
  useEffect(()=>{if(!sellerApplication || savedPreferenceRef.current.tax)return;const info=asJsonRecord(sellerApplication.business_info);const pick=(...keys:string[])=>{for(const key of keys){if(typeof info[key]==="string")return info[key] as string;}return "";};setTaxDraft(current=>({...current,country:sellerApplication.country||current.country,businessNumber:pick("business_number","tax_id","tax_registration_number"),program:pick("tax_program_account"),legalName:pick("legal_business_name","legal_name","business_name")}));},[sellerApplication]);
  const returnsDefaults={window:"7 days",shipping:"Customer pays return shipping",conditions:[true,true,true,true,true],excluded:[true,true,true,true,false,false],other:"",method:"Original payment method",processing:"3 – 5 business days",restocking:"0.00",address:"primary",returnStreet:"",returnCity:"",returnProvince:"",returnPostal:"",instructions:"Please contact us before returning any item. Pack the item securely in its original packaging and include all accessories. Once we receive and inspect the item, we will process your refund within 3–5 business days.",toggles:[true,true,true,true,true,false]};
  const [returnsDraft,setReturnsDraft]=useState(returnsDefaults);
  const updateReturns=(patch:Partial<typeof returnsDefaults>)=>setReturnsDraft(v=>({...v,...patch}));
  const policyDefinitions=[["privacy","Privacy Policy","Explain how you collect, use and protect customer data."],["terms","Terms & Conditions","Set the terms for using your store and purchasing products."],["shipping","Shipping Policy","Explain your shipping methods, delivery times and costs."],["refund","Return & Refund Policy","Explain the return process, eligibility and refund method."],["cancellation","Cancellation Policy","Explain order cancellation rules."],["security","Security Policy","Explain how you ensure secure transactions and data."]] as const;
  const [policyDrafts,setPolicyDrafts]=useState<Record<string,string>>({});
  const [policyEditing,setPolicyEditing]=useState<Record<string,boolean>>({});
  const [policyPreview,setPolicyPreview]=useState(false);
  const insertPolicyMarkup=(id:string,prefix:string,suffix:string=prefix)=>{const el=document.getElementById(`policy-editor-${id}`) as HTMLTextAreaElement|null;if(!el)return;const start=el.selectionStart,end=el.selectionEnd;const old=policyDrafts[id]||"";const selection=old.slice(start,end)||"text";const next=old.slice(0,start)+prefix+selection+suffix+old.slice(end);setPolicyDrafts(v=>({...v,[id]:next}));requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+prefix.length,start+prefix.length+selection.length);});};
  const [policyDisplay,setPolicyDisplay]=useState<Record<string,boolean>>({privacy:true,terms:true,shipping:true,refund:true,cancellation:false,security:true,fallback:true});
  const [policyLocalPublished,setPolicyLocalPublished]=useState(false);
  const brandingDefaults={color:"#F97316",style:"Style 1",featured:[] as string[],welcome:"",instagram:"",facebook:"",tiktok:"",youtube:"",device:"Desktop"};
  const [brandingDraft,setBrandingDraft]=useState(brandingDefaults);
  const setBranding=(patch:Partial<typeof brandingDefaults>)=>setBrandingDraft(v=>({...v,...patch}));
  const notificationTypes=[["orders","New Orders","Get notified when you receive a new order."],["updates","Order Updates","Order status changes (paid, shipped, delivered, cancelled)."],["messages","Customer Messages","Get notified when customers send you a message."],["reviews","Product Reviews","New product reviews and ratings."],["returns","Returns & Refunds","New return or refund requests."],["payouts","Payout Updates","Payment sent, payout failed or payout received."],["announcements","Store Announcements","Important updates from Barakaz."],["marketing","Marketing & Promotions","Tips, promotions and marketplace opportunities."]] as const;
  const notificationDefaults={channel:"email",enabled:{email:true,sms:true,inapp:true,browser:true} as Record<string,boolean>,selected:{email:["orders","updates","messages","reviews","returns","payouts","announcements","marketing"],sms:["orders","updates","returns","payouts"],inapp:["orders","updates","messages","reviews","returns","payouts","announcements"],browser:["orders","updates","messages","payouts"]} as Record<string,string[]>,frequency:{orders:"Instantly",updates:"Instantly",messages:"Instantly",reviews:"Daily Digest",returns:"Instantly",payouts:"Instantly",announcements:"Instantly",marketing:"Weekly Digest"} as Record<string,string>,email:user?.email||"",cc:"",language:"English",quiet:true,quietStart:"22:00",quietEnd:"08:00",phone:form.phone||""};
  const [notificationDraft,setNotificationDraft]=useState(notificationDefaults);
  const updateNotification=(patch:Partial<typeof notificationDefaults>)=>setNotificationDraft(v=>({...v,...patch}));
  const toggleNotificationType=(channel:string,id:string,checked:boolean)=>setNotificationDraft(v=>({...v,selected:{...v.selected,[channel]:checked?[...v.selected[channel],id]:v.selected[channel].filter(x=>x!==id)}}));
  const teamRoles=["Owner","Admin","Order Manager","Customer Support","Marketing","Inventory Manager"] as const;
  const teamPermissions=["View Dashboard","Manage Products","Manage Orders","Manage Customers","View Reports","Manage Settings","Manage Team"] as const;
  const teamRoleDefaults:Record<string,string[]>={Owner:[...teamPermissions],Admin:["View Dashboard","Manage Products","Manage Orders","View Reports","Manage Settings"],"Order Manager":["Manage Products","Manage Orders","View Reports"],"Customer Support":["Manage Orders","Manage Customers"],Marketing:["View Reports"],"Inventory Manager":["Manage Products","Manage Orders"]};
  const [teamInvite,setTeamInvite]=useState({email:"",name:"",role:""});
  const [teamSearch,setTeamSearch]=useState("");
  const [teamShowInvite,setTeamShowInvite]=useState(true);
  const [teamRoleMatrix,setTeamRoleMatrix]=useState(teamRoleDefaults);
  const [securityPasswords,setSecurityPasswords]=useState({current:"",next:"",confirm:""});
  const [securityVisible,setSecurityVisible]=useState<Record<string,boolean>>({});
  const [securityBusy,setSecurityBusy]=useState(false);
  const [securityMfa,setSecurityMfa]=useState<"unknown"|"enabled"|"disabled">("unknown");
  const [securityMfaMethod,setSecurityMfaMethod]=useState("authenticator");
  const [securitySessionsLoading,setSecuritySessionsLoading]=useState(false);
  const [securityConfirmAction,setSecurityConfirmAction]=useState<"reset-mfa"|"email-change"|null>(null);
  const securityDefaults={login:true,suspicious:true,password:true,team:true};
  const [securityAlerts,setSecurityAlerts]=useState(securityDefaults);
  const [securityPhone,setSecurityPhone]=useState(form.phone||"");
  const [securityEditingPhone,setSecurityEditingPhone]=useState(false);
  useEffect(()=>{if(section!=="security")return;let active=true;supabase.auth.mfa.listFactors().then(({data,error})=>{if(active)setSecurityMfa(error?"unknown":data?.totp?.some(f=>f.status==="verified")?"enabled":"disabled");});return()=>{active=false;};},[section]);
  const updateAccountPassword=async()=>{const {current,next,confirm}=securityPasswords;if(!current||!next||!confirm){toast.error("Complete all password fields");return;}if(next!==confirm){toast.error("New passwords do not match");return;}if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(next)){toast.error("Password does not meet the requirements");return;}setSecurityBusy(true);try{const email=user?.email;if(!email)throw Error("Account email unavailable");const check=await supabase.auth.signInWithPassword({email,password:current});if(check.error)throw Error("Current password could not be verified");const result=await supabase.auth.updateUser({password:next});if(result.error)throw result.error;setSecurityPasswords({current:"",next:"",confirm:""});toast.success("Password updated");}catch(err){toast.error(err instanceof Error?err.message:"Could not update password");}finally{setSecurityBusy(false);}};
  const [complianceExpanded,setComplianceExpanded]=useState({documents:false,policies:false,alerts:false});
  useEffect(() => {
    if (!savedPreferences || hydratedVendor.current === vendor.id) return;
    hydratedVendor.current = vendor.id;
    savedPreferenceRef.current = savedPreferences;
    const profile = { ...settingsRecord(settingsRecord(vendor.store_settings).profile), ...settingsRecord(savedPreferences.profile) };
    setForm(current => {
      const restored = restoreSettings(current, profile);
      setInitialForm(JSON.stringify(restored));
      return restored;
    });
    setBrandingDraft(current => restoreSettings(current, savedPreferences.branding || settingsRecord(vendor.store_settings).branding));
    const shipping = settingsRecord(savedPreferences.shipping);
    setShippingPreview(current => restoreSettings(current, shipping.options));
    if (shipping.zones) setShippingZonePreview(shipping.zones as Record<string, boolean>);
    if (Array.isArray(shipping.additionalZones)) setAdditionalZones(shipping.additionalZones as string[]);
    if (shipping.regions) setZoneDrafts(shipping.regions as Record<string, string>);
    if (shipping.methods) setMethodDrafts(shipping.methods as typeof methodDrafts);
    setBusinessDraft(current => restoreSettings(current, savedPreferences.business));
    const tax = settingsRecord(savedPreferences.tax);
    setTaxDraft(current => restoreSettings(current, tax.registration));
    if (tax.calculation === "custom" || tax.calculation === "marketplace") setTaxCalculation(tax.calculation);
    setTaxExemptions(current => restoreSettings(current, tax.exemptions));
    setReturnsDraft(current => restoreSettings(current, savedPreferences.returns));
    const policies = settingsRecord(savedPreferences.policies);
    if (policies.content) setPolicyDrafts(policies.content as Record<string, string>);
    if (policies.display) setPolicyDisplay(policies.display as Record<string, boolean>);
    setNotificationDraft(current => {
      const restored = restoreSettings(current, savedPreferences.notifications);
      const notification = settingsRecord(savedPreferences.notifications);
      if (notification.selected) restored.selected = notification.selected as Record<string, string[]>;
      return restored;
    });
    const payouts = settingsRecord(savedPreferences.payouts);
    if (payouts.method === "bank" || payouts.method === "paypal") setSelectedPayoutMethod(payouts.method);
    if (typeof payouts.holderName === "string") setPayoutHolderName(payouts.holderName);
    if (typeof payouts.transitNumber === "string") setPayoutTransitNumber(payouts.transitNumber);
    if (typeof payouts.institutionNumber === "string") setPayoutInstitutionNumber(payouts.institutionNumber);
    if (typeof payouts.accountNumber === "string") setPayoutAccountNumber(payouts.accountNumber);
    if (typeof payouts.bank === "string") setPayoutBank(payouts.bank);
    if (typeof payouts.paypalEmail === "string") setPayoutPaypalEmail(payouts.paypalEmail);
    if (typeof payouts.frequency === "string") setPayoutFrequency(payouts.frequency);
    setPayoutToggles(current => restoreSettings(current, payouts.options));
    const security = settingsRecord(savedPreferences.security);
    setSecurityAlerts(current => restoreSettings(current, security.alerts));
    if (typeof security.phone === "string") setSecurityPhone(security.phone);
  }, [savedPreferences, vendor.id, vendor.store_settings]);

  const saveSection = async (key: "shipping" | "business" | "tax" | "returns" | "policies" | "notifications" | "payouts" | "security"): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      if (key === "business" && Object.values(businessFiles).some(Boolean)) throw new Error("Documents have not been uploaded. Use the verification workflow to upload them securely.");
      if (key === "tax" && taxDocument) throw new Error("This document has not been uploaded. Use the verification workflow for private documents.");
      if (key === "notifications" && [notificationDraft.email, notificationDraft.cc].some(email => email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Enter valid notification email addresses.");
      if (key === "payouts" && !isCanadianPayout && payoutPaypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payoutPaypalEmail)) throw new Error("Enter a valid PayPal email address.");
      if (key === "payouts" && isCanadianPayout && !canadianBankSchema.safeParse({ bank: payoutBank, holderName: payoutHolderName, transitNumber: payoutTransitNumber, institutionNumber: payoutInstitutionNumber, accountNumber: payoutAccountNumber }).success) throw new Error("Enter the bank, account holder, 5-digit transit, 3-digit institution and account number.");
      const values: Record<string, unknown> = key === "shipping" ? { options: shippingPreview, zones: shippingZonePreview, additionalZones, regions: zoneDrafts, methods: methodDrafts }
        : key === "business" ? { ...businessDraft }
        : key === "tax" ? { registration: taxDraft, calculation: taxCalculation, exemptions: taxExemptions }
        : key === "returns" ? { ...returnsDraft }
        : key === "policies" ? { content: policyDrafts, display: policyDisplay }
        : key === "notifications" ? { ...notificationDraft }
        : key === "payouts" ? { frequency: payoutFrequency, options: payoutToggles, country: businessCountryIso, method: activePayoutMethod, bank: isCanadianPayout ? payoutBank : "", holderName: isCanadianPayout ? payoutHolderName : "", transitNumber: isCanadianPayout ? payoutTransitNumber : "", institutionNumber: isCanadianPayout ? payoutInstitutionNumber : "", accountNumber: isCanadianPayout ? payoutAccountNumber : "", paypalEmail: isCanadianPayout ? "" : payoutPaypalEmail }
        : { alerts: securityAlerts, phone: securityPhone };
      await persistPreference(key, values);
      toast.success("Settings draft saved and verified. Live payment, tax, shipping, verification and notification rules are unchanged.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings could not be saved.");
      return false;
    } finally { setSaving(false); }
  };
  // Guided step layout applies to every seller, including existing approved accounts.
  const setupMode = true;
  const completedSteps: string[] = Array.isArray(vendor.setup_completed_sections) ? vendor.setup_completed_sections.filter((key: string) => key !== "tax" && key !== "compliance") : [];
  const [doneSteps, setDoneSteps] = useState<string[]>(completedSteps);
  useEffect(() => { setDoneSteps(completedSteps); }, [vendor.setup_completed_sections]); // eslint-disable-line react-hooks/exhaustive-deps
  const stepIndex = sections.findIndex(([key]) => key === section);
  useEffect(() => {
    if (!setupMode || section !== "overview") return;
    const firstOpen = sections.find(([key]) => !completedSteps.includes(key));
    setSection((firstOpen ?? sections[sections.length - 1])[0]);
  }, [setupMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [setupSubmitted, setSetupSubmitted] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const saveAndContinue = async () => {
    const key = section;
    if (key === "overview") return;
    const ok = key === "profile" || key === "branding" ? await handleSave() : key === "team" || key === "compliance" ? true : await saveSection(key);
    if (!ok) return;
    const { data, error } = await supabase.rpc("mark_vendor_setup_section", { p_section: key });
    if (error) { toast.error(error.message || "Could not save your progress."); return; }
    setDoneSteps(data || []);
    queryClient.invalidateQueries({ queryKey: ["vendor"] });
    const next = sections[stepIndex + 1];
    if (next) { setSection(next[0]); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (vendor.status === "approved") {
      // Existing approved sellers only save their changes — no re-submission for review.
      toast.success("Settings saved.");
    } else {
      setFinalSubmitting(true);
      try {
        const { data: latestVendor, error: reloadError } = await supabase.from("vendors").select("store_name,store_description,phone,logo_url").eq("id", vendor.id).single();
        if (reloadError) throw reloadError;
        if (storeSetupChecklist(latestVendor).some(item => !item.done)) {
          toast.error("Complete the required store profile details before submitting.");
          return;
        }
        const { error: submitError } = await supabase.rpc("submit_vendor_for_review");
        if (submitError) throw submitError;
        setSetupSubmitted(true);
        await queryClient.invalidateQueries({ queryKey: ["vendor"] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Your store could not be submitted. Please try again.");
      } finally { setFinalSubmitting(false); }
    }
  };
  const isDirty = JSON.stringify(form) !== initialForm;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div><h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6"/>Store Settings</h2><p className="text-sm text-muted-foreground">Manage your store and customize your selling experience.</p></div>
        <div className="flex flex-wrap gap-2 items-center max-w-full"><span className={`rounded-md border px-3 py-2 text-xs font-semibold ${vendor.status === "approved" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{vendor.status === "approved" ? "✓ Approved Seller Account" : `Seller Account: ${vendor.status || "Unknown"}`}</span><Link to={`/store/${vendor.slug}`} target="_blank" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><ExternalLink className="h-4 w-4"/>View Store</Link></div>
      </div>
      {setupSubmitted && <div role="status" aria-live="polite" className="rounded-xl border border-green-300 bg-green-50 p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" />
        <h3 className="text-2xl font-bold text-green-900">Congratulations! Your store setup has been submitted.</h3>
        <p className="text-sm text-green-900">Our team will review your store information. We'll notify you when a decision is made. You can return to your account while you wait.</p>
        <Button variant="outline" asChild><Link to="/account">Go to My Account</Link></Button>
      </div>}
      {setupMode && !setupSubmitted && <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="mb-3 text-sm font-semibold">Store setup · Step {Math.max(stepIndex,0)+1} of 10 · {doneSteps.length} completed</p><ol className="flex items-start overflow-x-auto pb-2">{sections.map(([key,label],index)=>{const done=doneSteps.includes(key);const current=key===section;return <li key={key} className="flex min-w-[64px] flex-1 flex-col items-center text-center relative">{index>0&&<span aria-hidden className={`absolute top-4 right-1/2 h-0.5 w-full ${done||current?"bg-primary":"bg-border"}`}/>}<button type="button" onClick={()=>setSection(key)} aria-current={current?"step":undefined} aria-label={`Step ${index+1}: ${label}${done?" (completed)":""}`} className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${current?"border-primary bg-primary text-primary-foreground":done?"border-primary bg-background text-primary":"border-border bg-background text-muted-foreground"}`}>{done&&!current?<CheckCircle2 className="h-4 w-4"/>:index+1}</button><span className={`mt-1 px-1 text-[10px] leading-tight ${current?"font-semibold text-foreground":"text-muted-foreground"}`}>{label}</span></li>;})}</ol></div>}
      {(!setupMode || doneSteps.length >= 10) && <StoreSetupSubmitCard vendor={vendor} allStepsDone={doneSteps.length >= 10} />}
      {preferencesLoading && <p role="status" className="text-sm text-muted-foreground">Loading saved store preferences…</p>}
      {preferencesError && <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Saved preferences could not be loaded. Reload before editing; no settings have been overwritten.</div>}
      {!setupMode && section === "overview" && <div className="space-y-5"><div className="rounded-xl border bg-card p-5 sm:p-6"><h3 className="text-xl font-bold">Choose a settings section</h3><p className="mt-1 text-sm text-muted-foreground">All 10 store settings sections are available below. Select one to view its controls and make changes.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sections.map(([key,label,description,Icon],index)=><button key={key} type="button" onClick={()=>{setSection(key);setSettingsSidebarOpen(false);}} className="group flex min-h-32 items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-orange-50"><Icon className="h-5 w-5 text-foreground group-hover:text-orange-700"/></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Section {String(index+1).padStart(2,"0")}</span><span className="mt-1 block font-semibold">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span><ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground"/></button>)}</div></div>}
      {!setupMode && section !== "overview" && <button type="button" onClick={()=>setSection("overview")} className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">← All 10 store settings sections</button>}
      {section !== "overview" && <div className={`grid min-w-0 grid-cols-1 gap-4 items-start lg:gap-6 ${settingsSidebarOpen ? "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]"}`}>
      <div className={`${setupMode?"hidden":"lg:hidden"} rounded-lg border bg-card p-3 space-y-2`}><Label htmlFor="mobile-settings-section">Settings section</Label><select id="mobile-settings-section" aria-label="Select store settings section" value={section} onChange={e=>setSection(e.target.value as typeof section)} className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{sections.map(([key,label],index)=><option key={key} value={key}>{index+1}. {label}</option>)}</select><p className="text-xs text-muted-foreground">Choose a section to edit its settings.</p></div>
      <nav id="store-settings-desktop-navigation" aria-label="Store settings sections" className={`${settingsSidebarOpen ? "lg:block" : "lg:hidden"} hidden lg:sticky lg:top-5 max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain rounded-xl border bg-card p-2 space-y-1 shadow-sm`}>
        {sections.map(([key,label,description,Icon],index) => (
          <button key={key} type="button" aria-current={section === key ? "page" : undefined} aria-label={`${index+1}. ${label}`} onClick={() => {setSection(key);setSettingsSidebarOpen(false);}} className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${section === key ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm" : "border-transparent hover:border-border hover:bg-muted"}`}>
            <span className="h-7 w-7 shrink-0 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">{index+1}</span>
            <Icon className="h-6 w-6 shrink-0"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span><ChevronRight className="h-4 w-4 shrink-0"/>
          </button>
        ))}
      </nav>
      <div className="min-w-0 space-y-3">
        <div className={`hidden ${setupMode?"":"lg:flex"} items-center justify-between gap-3`}><button type="button" aria-expanded={settingsSidebarOpen} aria-controls="store-settings-desktop-navigation" onClick={()=>setSettingsSidebarOpen(open=>!open)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{settingsSidebarOpen ? <PanelLeftClose className="h-4 w-4"/> : <PanelLeftOpen className="h-4 w-4"/>}{settingsSidebarOpen ? "Hide settings menu" : "Show all 12 settings"}</button><span className="text-xs text-muted-foreground">The menu closes after selecting a section to give the form more room.</span></div>
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 lg:p-8 min-w-0 space-y-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="flex items-center gap-3">{sections.filter(([key])=>key===section).map(([key,label,description,Icon],index)=><div key={key} className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon className="h-5 w-5"/></span><span><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Store settings</span><span className="block break-words text-lg font-bold">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span></div>)}</div><span className="whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Section {sections.findIndex(([key])=>key===section)+1} of 10</span></div>
        {(["shipping","payouts","business","tax","returns","policies","branding","notifications","team","security","compliance"] as const).includes(section as any)&&<div role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"><strong>Settings status:</strong> Preferences can be saved as private drafts. They do not activate shipping destinations, change tax or payouts, approve verification, send notifications, or grant staff access. Documents must use the secure verification workflow.</div>}
        {section === "profile" && (<div className="space-y-5"><div><h3 className="text-xl font-bold">Store Profile</h3><p className="text-sm text-muted-foreground">Manage your public store information. This will be displayed on your store page.</p><p className="text-xs text-amber-700 mt-2">Profile preferences are saved. Only your public address, categories and language are shown on the store page; contact details remain private.</p></div><h4 className="font-semibold border-b pb-2">Basic Information</h4>
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
        {categoriesError && <p role="alert" className="text-sm text-red-600">Categories could not be loaded. Reload the page and try again.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label htmlFor="main-category">Main Category *</Label><select id="main-category" disabled={categoriesLoading||!!categoriesError} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.primary_category_id || ""} onChange={e=>setForm(f=>({...f,primary_category_id:e.target.value||null,additional_category_ids:[]}))}><option value="">{categoriesLoading?"Loading categories…":"Select a category"}</option>{categories.filter(c=>!c.parent_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label htmlFor="store-subcategory">Subcategory</Label><select id="store-subcategory" disabled={!form.primary_category_id||categoriesLoading||subcategoriesLoading||!!categoriesError} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={chosenSubcategory} onChange={e=>setForm(f=>({...f,additional_category_ids:e.target.value?[e.target.value]:[]}))}><option value="">{!form.primary_category_id?"Select a main category first":subcategoriesLoading?"Loading subcategories…":"Select a subcategory"}</option>{subcategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{form.primary_category_id&&subcategories.length===0&&!categoriesLoading&&!subcategoriesLoading&&<p className="mt-1 text-xs text-muted-foreground">No subcategories are available for this category.</p>}</div>
        </div>
        </div>)}
        {section === "branding" && (<div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><Palette className="h-6 w-6 text-orange-600"/>8. Appearance &amp; Branding</h3><p className="text-sm text-muted-foreground">Customize your store's appearance, logo, banner, colors and branding elements.</p></div><Link to={`/store/${vendor.slug}`} target="_blank" className="rounded-md border px-3 py-2 text-sm">Preview Store</Link></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><ImageUploadField kind="logo" label="Store Logo" value={form.logo_url} userId={user?.id||""} onChange={url=>setForm(f=>({...f,logo_url:url}))}/><p className="text-xs text-muted-foreground">Recommended 500 × 500 px. Square PNG or JPG, max 5MB.</p></div><div className="rounded-lg border p-4"><ImageUploadField kind="banner" label="Store Banner" value={form.banner_url} userId={user?.id||""} onChange={url=>setForm(f=>({...f,banner_url:url}))}/><p className="text-xs text-muted-foreground">Recommended 1920 × 600 px. PNG or JPG, max 5MB.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Theme Color</h4><p className="text-xs text-muted-foreground">Choose your brand color. Saved with your store preferences.</p><div className="flex flex-wrap gap-2 mt-3">{["#F97316","#FF244B","#145CF2","#8612EB","#00B85B","#111827","#00B7FF"].map(c=><button type="button" key={c} aria-label={`Choose theme color ${c}`} onClick={()=>setBranding({color:c})} className={`h-9 w-9 rounded-full border-2 ${brandingDraft.color===c?"ring-2 ring-offset-2 ring-orange-500":""}`} style={{backgroundColor:c}}/>)}</div><Label className="block mt-4">Custom Color</Label><div className="flex gap-2 mt-1"><input aria-label="Choose custom theme color" type="color" value={brandingDraft.color} onChange={e=>setBranding({color:e.target.value})} className="h-10 w-12"/><Input value={brandingDraft.color} onChange={e=>{if(/^#[0-9a-fA-F]{0,6}$/.test(e.target.value))setBranding({color:e.target.value});}}/></div></div><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Layout &amp; Style</h4><p className="text-xs text-muted-foreground">Choose how your store page looks.</p><div className="grid grid-cols-3 gap-2 mt-3">{["Style 1","Style 2","Style 3"].map((style,i)=><button key={style} type="button" onClick={()=>setBranding({style})} className={`rounded border p-2 text-xs text-center ${brandingDraft.style===style?"border-orange-500 ring-1 ring-orange-500":""}`}><div className="h-14 rounded mb-2 flex flex-col justify-end gap-1 p-1" style={{backgroundColor:i===2?"#171717":i===1?"#f1f5f9":"#fff0e7"}}><div className="h-3 rounded bg-muted/80"/><div className="grid grid-cols-3 gap-1">{[1,2,3].map(x=><div key={x} className="h-4 bg-background border rounded"/>)}</div></div><input type="radio" readOnly checked={brandingDraft.style===style}/> {style}</button>)}</div></div></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Featured Categories</h4><p className="text-xs text-muted-foreground">Select categories to display on your store page header.</p><div className="grid grid-cols-2 gap-2 mt-3">{categories.map(c=><label key={c.id} className="rounded border p-2 text-xs flex gap-2 items-center"><input type="checkbox" checked={brandingDraft.featured.includes(c.id)} onChange={e=>setBranding({featured:e.target.checked?[...brandingDraft.featured,c.id]:brandingDraft.featured.filter(x=>x!==c.id)})}/>{c.name}</label>)}</div><p className="text-xs text-muted-foreground mt-2">Featured categories are saved with your store preferences.</p></div><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Welcome Message</h4><p className="text-xs text-muted-foreground">Show a short message on your store page.</p><Textarea maxLength={200} rows={5} className="mt-2" placeholder="Welcome to our store!" value={brandingDraft.welcome} onChange={e=>setBranding({welcome:e.target.value})}/><p className="text-xs text-right text-muted-foreground">{brandingDraft.welcome.length}/200</p></div></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Social Media Links</h4><p className="text-xs text-muted-foreground mb-3">Add your social media links to show on your store page.</p>{([["instagram","Instagram"],["facebook","Facebook"],["tiktok","TikTok"],["youtube","YouTube"]] as const).map(([key,label])=><div key={key} className="flex gap-2 items-center mb-2"><Label className="w-20 shrink-0">{label}</Label><Input type="url" placeholder={`https://${key}.com/yourstore`} value={brandingDraft[key]} onChange={e=>setBranding({[key]:e.target.value})}/></div>)}</div><div className="rounded-lg border p-4"><h4 className="font-semibold">Store Settings Preview</h4><p className="text-xs text-muted-foreground">See how your store looks on different devices.</p><div className="grid grid-cols-3 mt-3 border-b">{["Desktop","Tablet","Mobile"].map(device=><button key={device} type="button" className={`p-2 text-xs ${brandingDraft.device===device?"border-b-2 border-orange-500 font-bold":""}`} onClick={()=>setBranding({device})}>{device}</button>)}</div><div className="mx-auto mt-3 border rounded overflow-hidden" style={{maxWidth:brandingDraft.device==="Mobile"?220:brandingDraft.device==="Tablet"?340:550}}><div className="h-20 bg-muted flex items-center justify-center overflow-hidden">{form.banner_url?<img src={form.banner_url} alt="Store banner preview" className="w-full h-full object-cover"/>:<span className="text-xs">Store Banner</span>}</div><div className="flex gap-2 items-center p-2"><div className="h-10 w-10 rounded border overflow-hidden">{form.logo_url&&<img src={form.logo_url} alt="Store logo preview" className="w-full h-full object-cover"/>}</div><strong className="text-sm">{form.store_name||"Your Store"}</strong><span className="ml-auto rounded px-2 py-1 text-white text-xs" style={{backgroundColor:/^#[0-9a-fA-F]{6}$/.test(brandingDraft.color)?brandingDraft.color:"#F97316"}}>Follow</span></div><p className="text-xs px-2 pb-2">{brandingDraft.welcome||"Welcome to our store!"}</p><div className="grid grid-cols-3 gap-1 p-2">{[1,2,3].map(x=><div key={x} className="h-12 bg-muted rounded"/>)}</div></div></div></div>
          <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>setBrandingDraft({...brandingDefaults})}><RotateCcw className="h-4 w-4 mr-2"/>Reset to Default</Button><Button disabled={saving} onClick={()=>void handleSave()}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
        </div>)}
        {section === "profile" && (<div className="space-y-5">
        <h3 className="font-semibold pt-2 border-t border-border">Store Contact Information</h3>
        <p className="text-xs text-muted-foreground">These contact details are currently displayed according to the existing storefront implementation.</p>
        <div><Label>Store Email *</Label><Input type="email" value={form.store_email} onChange={e=>setForm({...form,store_email:e.target.value})} placeholder="store@example.com"/></div>

        <div>
          <Label>Phone Number *</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 416 555 0100" />
        </div>
        <div>
          <Label>Phone Number 2 (Optional)</Label>
          <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} placeholder="+1 604 555 0101" />
        </div>
        <div>
          <Label>WhatsApp Number</Label>
          <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+1 604 555 0101" />
        </div>
        <div>
          <Label>Website (Optional)</Label>
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourstore.com" />
        </div>

        <h3 className="font-semibold border-t pt-4">Store Address (Public)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label htmlFor="public-country">Country *</Label><Input id="public-country" list="public-country-options" autoComplete="off" value={addressValue(publicAddress,"country")} onChange={e=>setPublicAddress("country",e.target.value)} placeholder="Search for a country"/><datalist id="public-country-options">{COUNTRIES.map(country=><option key={country.code} value={country.name}/>)}</datalist></div>
          <div><Label htmlFor="public-province">Province / State *</Label><Input id="public-province" list={canadaSelected?"public-canada-provinces":undefined} value={addressValue(publicAddress,"state")} onChange={e=>setPublicAddress("state",e.target.value)} placeholder={canadaSelected?"Search Canadian provinces":"Enter state or province"}/>{canadaSelected&&<datalist id="public-canada-provinces">{Object.keys(canadianCities).map(province=><option key={province} value={province}/>)}</datalist>}</div>
          <div><Label htmlFor="public-city">City *</Label><Input id="public-city" list={addressCities.length?"public-city-options":undefined} value={addressValue(publicAddress,"city")} onChange={e=>setPublicAddress("city",e.target.value)} placeholder={addressCities.length?"Search or enter a city":"Enter city"}/>{addressCities.length>0&&<datalist id="public-city-options">{addressCities.map(city=><option key={city} value={city}/>)}</datalist>}</div>
          <div><Label htmlFor="public-postal">Postal / ZIP Code *</Label><Input id="public-postal" value={addressValue(publicAddress,"zip")} onChange={e=>setPublicAddress("zip",e.target.value)} placeholder={canadaSelected?"A1A 1A1":"Postal / ZIP code"}/></div>
        </div><p className="text-xs text-muted-foreground">Search the country, then choose a province and city. You can type a city not shown in the suggestions.</p>
        <h3 className="font-semibold border-t pt-4">Store Language & Visibility</h3>
        <div className="grid md:grid-cols-2 gap-4"><div><Label>Store Language</Label><select className="w-full h-10 border rounded-md bg-background px-3" value={form.store_language} onChange={e=>setForm({...form,store_language:e.target.value})}><option value="en">English</option><option value="fr">French</option></select></div><fieldset><legend className="text-sm font-medium mb-2">Contact Information Visibility</legend>{([["all","Show all contact details"],["email","Show email only"],["phone","Show phone number only"],["hidden","Hide all contact details"]] as const).map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm mb-2"><input type="radio" name="contact-visibility" checked={form.contact_visibility===value} onChange={()=>setForm({...form,contact_visibility:value})}/>{label}</label>)}<p className="text-xs text-muted-foreground">Saved privately as a preference. Direct phone and email contact remain hidden under marketplace rules.</p></fieldset></div>
        </div>)}
        {section === "shipping" && (
          <div className="space-y-6">
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
              <div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="font-semibold">Shipping Zones &amp; Destinations</h4><p className="text-xs text-muted-foreground">View the regions you can ship to. Zone management requires shipping-rule integration.</p></div><Button size="sm" variant="outline" onClick={()=>setZoneCreatorOpen(v=>!v)}>+ Add Shipping Zone</Button></div>
              {zoneCreatorOpen && <div className="rounded-lg border bg-muted/20 p-3 space-y-3"><h5 className="font-medium">Add shipping zone (preview only)</h5><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="new-zone-name">Zone name</Label><Input id="new-zone-name" value={newZoneName} onChange={e=>setNewZoneName(e.target.value)} placeholder="e.g. Europe"/></div><div><Label htmlFor="new-zone-regions">Countries / Regions</Label><Input id="new-zone-regions" value={newZoneRegions} onChange={e=>setNewZoneRegions(e.target.value)} placeholder="e.g. France, Germany"/></div></div><div className="flex gap-2"><Button size="sm" onClick={()=>{const name=newZoneName.trim();if(!name||!newZoneRegions.trim()){toast.error("Enter a zone name and countries or regions.");return;}if(additionalZones.includes(name)||Object.prototype.hasOwnProperty.call(zoneDrafts,name)){toast.error("A shipping zone with this name already exists.");return;}setAdditionalZones(v=>[...v,name]);setZoneDrafts(v=>({...v,[name]:newZoneRegions.trim()}));setShippingZonePreview(v=>({...v,[name]:false}));setZoneCreatorOpen(false);setNewZoneName("");setNewZoneRegions("");toast.info("Zone added to this preview only; checkout rules were not changed.");}}>Add to preview</Button><Button size="sm" variant="outline" onClick={()=>setZoneCreatorOpen(false)}>Cancel</Button></div></div>}
              <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead className="bg-muted/50 text-left"><tr>{["Zone / Region","Countries","Status","Actions"].map(h=><th key={h} className="p-3 border font-medium">{h}</th>)}</tr></thead><tbody>{([["🇨🇦","Domestic (Canada)","All Provinces & Territories"],["🇺🇸","United States","All States"],["🌐","International","Not configured"],...additionalZones.map(name=>["🌐",name,zoneDrafts[name]||""] as const)] as const).map(([flag,name,desc])=><tr key={name}><td className="p-3 border"><span className="mr-2">{flag}</span>{name}</td><td className="p-3 border text-muted-foreground">{zoneDrafts[name] || desc}</td><td className="p-3 border"><label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" role="switch" aria-label={`Enable ${name} shipping zone preview`} aria-checked={shippingZonePreview[name]} checked={shippingZonePreview[name]} onChange={e=>setShippingZonePreview(old=>({...old,[name]:e.target.checked}))} className="peer sr-only"/><span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-green-600 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"/><span className={`text-xs ${shippingZonePreview[name]?"text-green-700":"text-muted-foreground"}`}>{shippingZonePreview[name]?"Active":"Inactive"}</span></label></td><td className="p-3 border"><Button size="sm" variant="outline" onClick={()=>setZoneEditor(zoneEditor===name?null:name)}>Edit</Button>{additionalZones.includes(name)&&<Button size="sm" variant="ghost" onClick={()=>{setAdditionalZones(v=>v.filter(z=>z!==name));if(zoneEditor===name)setZoneEditor(null);}}>Remove</Button>}</td></tr>)}</tbody></table></div>
              {zoneEditor && <div className="rounded-md border bg-muted/20 p-3 space-y-2"><div className="flex justify-between"><p className="font-semibold text-sm">Edit {zoneEditor}</p><Button size="sm" variant="ghost" onClick={()=>setZoneEditor(null)}>Close</Button></div><Label>Countries / Regions</Label><Input value={zoneDrafts[zoneEditor]||""} onChange={e=>setZoneDrafts(old=>({...old,[zoneEditor]:e.target.value}))}/><p className="text-xs text-amber-700">Changes are preview-only and will not change checkout destinations.</p></div>}<p className="text-xs text-amber-700">Zone rows reproduce the reference layout; they are not confirmed active shipping rules. Checkout shipping availability is controlled by the existing shipping backend.</p>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2"><div><h4 className="font-semibold">Shipping Methods</h4><p className="text-xs text-muted-foreground">Standard and Express shipping options currently configured for checkout.</p></div><Button variant="outline" size="sm" onClick={()=>toast.info("Custom shipping methods require backend integration.")}>+ Add Shipping Method</Button></div>
              {([{name:"Standard Shipping",description:"Reliable delivery at an affordable rate.",icon:"📦"},{name:"Express Shipping",description:"Faster delivery for urgent orders.",icon:"🚚"}] as const).map(method=>{const draft=methodDrafts[method.name];const editing=methodEditor===method.name;return <div key={method.name} className="rounded-lg border p-3 space-y-3">
                <div className="flex justify-between gap-2"><div className="flex gap-3"><span className="text-2xl">{method.icon}</span><div><p className="text-sm font-semibold">{method.name} <span className="ml-2 text-xs text-green-700 bg-green-50 rounded px-2 py-0.5">Configured</span></p><p className="text-xs text-muted-foreground">{method.description}</p></div></div><Button size="sm" variant="outline" onClick={()=>setMethodEditor(editing?null:method.name)}>✎ {editing?"Close":"Edit"}</Button></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div><Label>Price (CAD) *</Label><Input type="number" min="0" step="0.01" value={draft.price} readOnly={!editing} onChange={e=>setMethodDrafts(old=>({...old,[method.name]:{...old[method.name],price:e.target.value}}))}/></div><div><Label>Delivery Time *</Label><select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" disabled={!editing} value={draft.time} onChange={e=>setMethodDrafts(old=>({...old,[method.name]:{...old[method.name],time:e.target.value}}))}>{["1 – 3 business days","3 – 7 business days","5 – 10 business days"].map(v=><option key={v}>{v}</option>)}</select></div><div><Label>Tracking</Label><select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" disabled={!editing} value={draft.tracking} onChange={e=>setMethodDrafts(old=>({...old,[method.name]:{...old[method.name],tracking:e.target.value}}))}><option>Enabled</option><option>Disabled</option></select></div><div><Label>Applies To</Label><select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" disabled={!editing} value={draft.applies} onChange={e=>setMethodDrafts(old=>({...old,[method.name]:{...old[method.name],applies:e.target.value}}))}>{["All zones","Domestic (Canada)","United States","International"].map(v=><option key={v}>{v}</option>)}</select></div></div>
                {editing && <p className="text-xs text-amber-700">Preview only: edits do not update live checkout rates.</p>}
              </div>})}
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3">
              <h4 className="font-semibold">Additional Shipping Settings</h4>
              <div className="grid md:grid-cols-3 gap-4"><div className="space-y-2">{([["phone","Require phone number for shipping"],["po","Allow PO Box addresses"],["eta","Show estimated delivery date at checkout"],["handling","Include handling time"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange-600" checked={shippingPreview[key]} onChange={e=>setShippingPreview(old=>({...old,[key]:e.target.checked}))}/>{label}</label>)}</div><div className="space-y-1"><Label>Processing Time</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={shippingPreview.processing} onChange={e=>setShippingPreview(old=>({...old,processing:e.target.value}))}><option>1 – 2 business days</option><option>3 – 5 business days</option><option>5 – 7 business days</option></select><p className="text-xs text-muted-foreground">Time needed to prepare and ship orders.</p></div><div className="space-y-1"><Label>Handling Fee (Optional)</Label><div className="relative"><Input type="number" min="0" step="0.01" value={shippingPreview.fee} onChange={e=>setShippingPreview(old=>({...old,fee:e.target.value}))}/><span className="absolute right-3 top-3 text-xs text-muted-foreground">CAD</span></div><p className="text-xs text-muted-foreground">Additional fee per order (e.g. packaging).</p></div></div>
              <p className="text-xs text-amber-700">Additional settings are a design preview and do not change checkout behavior until the shipping configuration backend supports them.</p>
              <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving || !isDirty || slugAvailability!=="available"} onClick={()=>void handleSave()}>Save Warehouse</Button><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("shipping")}>{saving ? "Saving..." : "Save Shipping Draft"}</Button></div>
            </section>
          </div>
        )}
        {section === "payouts" && (<div className="space-y-5">
          <div className="flex flex-wrap justify-between items-start gap-3"><div className="flex gap-3 items-start"><CreditCard className="h-9 w-9 text-violet-600"/><div><h3 className="text-xl md:text-2xl font-bold">4. Payments &amp; Payouts</h3><p className="text-sm text-muted-foreground">Manage how you receive payments, set up your payout method and view your earnings.</p></div></div><Button size="sm" variant="outline" asChild><Link to="/vendor/payments">ⓘ Learn more</Link></Button></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["💼","Total Earnings"],["💵","Available Balance"],["🕒","Pending Balance"],["🔒","Held Balance"]].map(([icon,label])=><div key={label} className="rounded-lg border p-4 bg-card"><div className="flex items-center gap-3"><span className="text-2xl">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{label==="Total Earnings" && financialTotals && !financialError?formatCad(financialTotals.gross):"—"}</p><p className="text-xs text-muted-foreground">{label==="Total Earnings" && financialTotals && !financialError?"CAD · Gross order items (up to 500), not settled earnings":financialLoading?"Loading…":"CAD · Stripe balance unavailable"}</p></div></div></div>)}</div>
          <div className="grid lg:grid-cols-3 gap-3">
            <section className="lg:col-span-2 rounded-lg border p-4 space-y-4"><div><h4 className="font-semibold">Payout Account Setup</h4><p className="text-xs text-muted-foreground">Save your payment details for withdrawal requests.</p></div>
              {businessCountryIso === "CA" && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payout method">
                <Button variant={isCanadianPayout ? "default" : "outline"} aria-pressed={isCanadianPayout} onClick={()=>setSelectedPayoutMethod("bank")}><Building2 className="mr-2 h-4 w-4"/>Bank Account</Button>
                <Button variant={!isCanadianPayout ? "default" : "outline"} aria-pressed={!isCanadianPayout} onClick={()=>setSelectedPayoutMethod("paypal")}>PayPal</Button>
              </div>}
              {isCanadianPayout ? <div className="space-y-4">
                <h5 className="text-sm font-semibold">Canadian bank account</h5>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="payout-bank">Canadian bank</Label><select id="payout-bank" value={payoutBank} onChange={e=>setPayoutBank(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose your bank</option>{CANADIAN_BANKS.map(bank=><option key={bank} value={bank}>{bank}</option>)}</select></div>
                  <div className="space-y-2"><Label>Country</Label><Input value="Canada" readOnly/></div>
                </div>
                {payoutBank && <div className="space-y-3 border-t pt-4">
                  <div className="space-y-2"><Label htmlFor="payout-holder-name">Account holder name</Label><Input id="payout-holder-name" autoComplete="name" value={payoutHolderName} onChange={e=>setPayoutHolderName(e.target.value)} placeholder="Name on your bank account"/></div>
                  <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="payout-transit">Transit number</Label><Input id="payout-transit" inputMode="numeric" maxLength={5} value={payoutTransitNumber} onChange={e=>setPayoutTransitNumber(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="payout-institution">Institution number</Label><Input id="payout-institution" inputMode="numeric" maxLength={3} value={payoutInstitutionNumber} onChange={e=>setPayoutInstitutionNumber(e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="payout-account">Account number</Label><Input id="payout-account" type="password" autoComplete="off" inputMode="numeric" maxLength={12} value={payoutAccountNumber} onChange={e=>setPayoutAccountNumber(e.target.value)} /></div></div>
                  <p className="text-xs text-muted-foreground">Saved privately and included with withdrawal requests for admin review. No Stripe connection required.</p>
                </div>}
              </div> : <div className="space-y-4">
                <img src={paymentMethods.find(method=>method.name==="PayPal")?.logo} alt="PayPal" className="h-10 w-36 object-contain"/>
                <div className="space-y-2"><Label htmlFor="payout-paypal-email">PayPal email address</Label><Input id="payout-paypal-email" type="email" placeholder="Email linked to your PayPal account" value={payoutPaypalEmail} onChange={e=>setPayoutPaypalEmail(e.target.value)}/></div>
                <p className="text-xs text-muted-foreground">Included privately with your withdrawal request for admin review.</p>
              </div>}
            </section>
            <div className="space-y-3"><section className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Payment details</h4><p className="text-xs text-muted-foreground">Save before requesting a withdrawal. Payments are reviewed by the admin.</p><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("payouts")}>Save Payment Details</Button></section>
              <section className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">⚙ Payout Settings</h4>{([["automatic","Automatically receive payouts"],["email","Email me when a payout is sent"],["refunds","Include order refunds in balance"]] as const).map(([key,label])=><label key={key} className="flex justify-between items-center gap-3 text-sm"><span>{label}</span><input type="checkbox" role="switch" className="accent-green-600 h-4 w-4" checked={payoutToggles[key]} onChange={e=>setPayoutToggles(v=>({...v,[key]:e.target.checked}))}/></label>)}<p className="text-xs text-amber-700">These switches are UI-only and do not alter actual payout or refund processing.</p></section></div>
          </div>
          <div className="grid lg:grid-cols-3 gap-3"><section className="lg:col-span-2 rounded-lg border p-4 space-y-3"><div className="flex justify-between items-center"><div><h4 className="font-semibold">🟠 Commission &amp; Fees</h4><p className="text-xs text-muted-foreground">Marketplace fee structure applicable to your store.</p></div><Button size="sm" variant="outline" asChild><Link to="/vendor/payments">View Details</Link></Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Fee Type","Rate","Description"].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{[["Marketplace Commission",vendorCommissionRates?.length?Array.from(new Set(vendorCommissionRates.map(x=>x.commission_pct))).sort((a,b)=>a-b).map(x=>`${x}%`).join(", "):"See agreement","Category-dependent commission rates"],["Payment Processing Fee","Provider dependent","Charged by payment processor"],["Refund Processing Fee","Provider dependent","Subject to applicable refund terms"]].map(row=><tr key={row[0]} className="border-b">{row.map((cell,i)=><td className="p-2" key={i}>{cell}</td>)}</tr>)}</tbody></table></div></section>
          <section className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Supported Payment Methods</h4><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2" aria-label="Customer payment options">{paymentMethods.map(method=><div key={method.name} className="flex h-16 min-w-0 items-center justify-center rounded-md border border-border bg-background px-3" title={method.name}><img src={method.logo} alt={method.name} className="h-10 w-full max-w-32 object-contain" loading="lazy"/></div>)}</div><p className="text-xs text-muted-foreground">Available customer payment methods are confirmed at checkout and may vary by order.</p></section></div>
          <WithdrawalRequests vendorId={vendor.id} />
        </div>)}
        {section === "business" && (
          <div className="space-y-6">
            <div className="flex items-start gap-3"><Building2 className="h-9 w-9 text-violet-600 shrink-0"/><div><h3 className="text-xl md:text-2xl font-bold">2. Business Information</h3><p className="text-sm text-muted-foreground">Manage your legal business details. This information is used for verification, tax and payout purposes.</p></div></div>
            <p className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3">Existing application details are loaded. Save edits as a private business draft; verified details change only through the approved verification workflow.</p>
            {sellerApplication && <p className="text-xs text-muted-foreground">Application status: <strong>{sellerApplication.status}</strong> · Identity verification: <strong>{sellerApplication.kyc_status}</strong> · <Link className="underline text-primary" to="/vendor/register">Open verification workflow</Link></p>}
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Type</h4>
              <div className="grid md:grid-cols-3 gap-3">{([
                ["individual","Individual Seller","Selling as a person (no registered business)"],
                ["sole_proprietor","Sole Proprietorship (Self Employed)","You own the business personally"],
                ["company","Incorporated Company","Registered business (e.g. Ltd, Inc, Corp)"],
                ["partnership","Partnership","Two or more people own the business together"],
                ["other","Other","Co-operative, non-profit, trust or another structure"]
              ] as const).map(([value,label,help]) => <label key={value} className="flex items-start gap-2 cursor-pointer"><input type="radio" className="mt-1 accent-orange-600" name="business-type" checked={businessDraft.type === value} onChange={() => updateBusiness("type",value)}/><span><span className="text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{help}</span></span></label>)}</div>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Legal Business Information</h4><div className="grid md:grid-cols-2 gap-4">
              {businessInput("legalName","Legal Business Name",true,"Your official business name as per legal documents.")}
              {businessInput("registration","Business Registration Number (Optional)",false,"Company registration or business licence number.")}
              {businessInput("tradingName","Doing Business As (Trading Name)",false,"Your store or trading name (if different).")}
              <div className="space-y-1"><Label htmlFor="business-email">Business Email <span className="text-red-600">*</span></Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-orange-600"/><Input id="business-email" className="pl-9" type="email" value={businessDraft.email} onChange={e=>updateBusiness("email",e.target.value)}/></div><p className="text-xs text-muted-foreground">Official business email address.</p></div>
              <div className="space-y-1"><Label htmlFor="business-phone">Business Phone <span className="text-red-600">*</span></Label><div className="flex rounded-md border border-input overflow-hidden"><select aria-label="Phone country code" className="shrink-0 bg-muted px-2 text-sm border-r max-w-[6.5rem]" value={businessCountryCode} onChange={e=>setBusinessCountryCode(e.target.value)}>{[...new Set(COUNTRIES.map(c=>c.dial))].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))).map(dial=><option key={dial} value={dial}>{dial}</option>)}</select><Input id="business-phone" className="border-0 rounded-none focus-visible:ring-0" type="tel" value={businessDraft.phone} onChange={e=>updateBusiness("phone",e.target.value)}/></div><p className="text-xs text-muted-foreground">Primary business contact number.</p></div>
              <div className="space-y-1"><Label htmlFor="business-website">Business Website (Optional)</Label><div className="relative"><Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="business-website" className="pl-9" type="url" value={businessDraft.website} onChange={e=>updateBusiness("website",e.target.value)}/></div><p className="text-xs text-muted-foreground">Your official business website.</p></div>
            </div></section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Address</h4><div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2"><Label>Country <span className="text-red-600">*</span></Label><CountrySelector value={businessCountryIso} onChange={code=>{const c=countryByCode(code);if(!c)return;setBusinessDraft(old=>({...old,country:c.name,province:"",postal:""}));setBusinessCountryCode(c.dial);}}/></div>
              {businessRegions ? businessSelect("province",businessFormat.regionLabel,[`Select ${businessFormat.regionLabel.toLowerCase()}`,...businessRegions],true) : businessInput("province",businessFormat.regionLabel,!businessFormat.regionLabel.includes("optional"))}
              {businessInput("street","Street Address",true)}
              {businessInput("city","City / Town",true)}
              {businessInput("unit","Suite / Unit (Optional)")}
              {businessInput("postal",businessFormat.postalLabel,businessFormat.postalRequired,businessFormat.postalExample?`e.g. ${businessFormat.postalExample}`:"")}
            </div></section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Business Documents</h4>
              {verifiedDocuments.length > 0 && <div className="rounded-md bg-muted p-3"><p className="text-sm font-medium mb-2">Documents already submitted for verification</p>{verifiedDocuments.map(doc => <p key={doc.id} className="text-xs py-1">{doc.requirement_code.replace(/_/g," ")} — <strong>{doc.verification_status}</strong></p>)}<p className="text-xs text-muted-foreground mt-1">Document contents are private and are not exposed in Store Settings.</p></div>}<p className="text-xs text-muted-foreground">Choose clear and valid documents for a future verification step. JPG, PNG or PDF (maximum 10MB each).</p>
              <div className="grid md:grid-cols-3 gap-3">{(["Business License / Registration","Government ID","Tax Document (Optional)"] as const).map(label => <div key={label} className="rounded-md border p-3 space-y-2"><p className="text-xs font-semibold">{label}</p><label className="flex min-h-24 flex-col items-center justify-center gap-1 rounded border border-dashed cursor-pointer text-center p-2">{businessFiles[label] ? <><div className="flex items-center gap-2"><FileText className="h-8 w-8 text-muted-foreground"/><span className="text-xs break-all">{businessFiles[label]?.name}</span><CheckCircle2 className="h-4 w-4 text-green-600"/></div><span className="text-xs text-muted-foreground">{((businessFiles[label]?.size || 0) / 1024).toFixed(0)} KB · Selected, not uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground"/><span className="text-xs">Upload Document</span><span className="text-xs text-muted-foreground">JPG, PNG or PDF (Max 10MB)</span></>}<input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => {const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024 || !["image/jpeg","image/png","application/pdf"].includes(file.type)){toast.error("Choose a JPG, PNG or PDF under 10MB.");e.target.value="";return;}setBusinessFiles(old=>({...old,[label]:file}));}}/></label>{businessFiles[label] && <button type="button" className="text-xs text-orange-700 underline" onClick={()=>setBusinessFiles(old=>({...old,[label]:null}))}>Remove selection</button>}</div>)}</div>
            </section>
            <section className="rounded-lg border p-3 md:p-4 space-y-3"><h4 className="font-semibold">Tax Information</h4><div className="grid md:grid-cols-3 gap-4">
              {businessInput("taxId","Tax ID Number (Optional)",false,"GST/HST, EIN, VAT or other tax identification number.")}
              <div className="space-y-1"><Label>Tax Registration Country</Label><div className="relative"><span className="absolute left-3 top-2.5">🇨🇦</span><select aria-label="Tax registration country" className="w-full h-10 rounded-md border border-input bg-background pl-11 pr-3 text-sm" value={businessDraft.taxCountry} onChange={e=>updateBusiness("taxCountry",e.target.value)}>{["Canada","United States","United Kingdom","Kenya","Other"].map(country=><option key={country}>{country}</option>)}</select></div></div>
              {businessSelect("taxType","Tax Type",["GST / HST","PST / QST","VAT","Sales Tax","Not Registered"])}
            </div></section>
            <div className="flex justify-between gap-3 border-t pt-4"><Button variant="outline" type="button" onClick={()=>{setBusinessDraft(businessInitial);setBusinessFiles({});}}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><Button type="button" disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("business")} className="bg-orange-600 hover:bg-orange-700"><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
          </div>
        )}
        {section === "security" && (<div className="space-y-5">
          <div><h3 className="text-xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-orange-600"/>11. Security &amp; Account</h3><p className="text-sm text-muted-foreground">Keep your account secure and manage access settings.</p></div>
          <div className="grid gap-3 md:grid-cols-3">{[["Account Security","Review your security measures",securityMfa==="enabled"?"2FA active":"Review account protections"],["Two-Factor Authentication",securityMfa==="enabled"?"Enabled":securityMfa==="disabled"?"Not enabled":"Status unavailable","Authenticator app"],["Active Sessions","Session management","View available sessions"]].map(([heading,detail,sub])=><div key={heading} className="rounded-lg border p-4"><h4 className="font-semibold">{heading}</h4><p className="text-sm mt-2">{detail}</p><p className="text-xs text-muted-foreground mt-2">{sub}</p></div>)}</div>
          <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Login &amp; Password</h4><p className="text-xs text-muted-foreground">Manage your login credentials securely.</p><div className="grid gap-3 sm:grid-cols-[1fr_190px]"><div className="space-y-3">{([["current","Current Password"],["next","New Password"],["confirm","Confirm New Password"]] as const).map(([key,label])=><div key={key}><Label>{label}</Label><div className="flex gap-1"><Input type={securityVisible[key]?"text":"password"} autoComplete={key==="current"?"current-password":"new-password"} value={securityPasswords[key]} onChange={e=>setSecurityPasswords(v=>({...v,[key]:e.target.value}))}/><Button type="button" variant="outline" size="sm" onClick={()=>setSecurityVisible(v=>({...v,[key]:!v[key]}))}>{securityVisible[key]?"Hide":"Show"}</Button></div></div>)}</div><div className="rounded bg-blue-50 p-3 text-xs text-blue-900"><strong>Password Requirements</strong><p className="mt-2">At least 8 characters</p><p>One uppercase letter (A–Z)</p><p>One lowercase letter (a–z)</p><p>One number (0–9)</p><p>One special character</p></div></div><Button disabled={securityBusy} onClick={updateAccountPassword} className="w-full">{securityBusy?"Updating...":"Update Password"}</Button></div>
          <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Two-Factor Authentication (2FA)</h4><p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p><p className="text-sm">Current status: <strong>{securityMfa==="enabled"?"Enabled":securityMfa==="disabled"?"Not enabled":"Unable to verify"}</strong></p>{[["authenticator","Authenticator App (Recommended)"],["sms","SMS (Text Message)"],["email","Email"]].map(([id,label])=><label key={id} className="flex gap-2 items-center text-sm"><input type="radio" name="security-mfa" checked={securityMfaMethod===id} onChange={()=>setSecurityMfaMethod(id)}/>{label}</label>)}<p className="text-xs text-muted-foreground">Choosing a method does not activate 2FA. Authenticator enrollment requires secure verification; SMS and email MFA are not enabled here.</p><Link to="/auth" className="text-sm underline">Account authentication settings</Link><Button variant="outline" onClick={()=>setSecurityConfirmAction("reset-mfa")}>Reset 2FA</Button></div></div>
          {securityConfirmAction&&<div role="dialog" aria-modal="false" aria-label="Account security action" className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3"><h4 className="font-semibold text-amber-950">{securityConfirmAction==="reset-mfa"?"Reset two-factor authentication":"Change account email"}</h4><p className="text-sm text-amber-950">{securityConfirmAction==="reset-mfa"?"For account safety, resetting an authenticator requires verified reauthentication and a supported recovery workflow. No factor has been reset.":"Changing your sign-in email requires a verified email-change workflow. Your current email remains unchanged."}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setSecurityConfirmAction(null)}>Close</Button><Button size="sm" variant="outline" asChild><Link to="/auth">Open authentication page</Link></Button></div></div>}
          <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Email &amp; Phone Verification</h4><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">Email Address</strong><p className="text-sm">{user?.email||"Not available"}</p><span className="text-xs text-muted-foreground">{user?.email_confirmed_at?"Verified":"Verification not confirmed"}</span></div><Button size="sm" variant="outline" onClick={()=>setSecurityConfirmAction("email-change")}>Edit</Button></div><div className="border-t pt-3"><div className="flex justify-between gap-2"><div><strong className="text-sm">Phone Number</strong><p className="text-sm">{securityPhone||"Not provided"}</p><span className="text-xs text-muted-foreground">Verification not confirmed</span></div><Button size="sm" variant="outline" onClick={()=>setSecurityEditingPhone(v=>!v)}>Edit</Button></div>{securityEditingPhone&&<Input type="tel" className="mt-2" value={securityPhone} onChange={e=>setSecurityPhone(e.target.value)} placeholder="Phone number (preview only)"/>}</div></div>
          <div className="rounded-lg border p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Active Sessions</h4><Button size="sm" variant="outline" disabled={securitySessionsLoading} onClick={async()=>{setSecuritySessionsLoading(true);try{const {data,error}=await supabase.auth.mfa.listFactors();if(error)throw error;toast.info("This authentication provider does not expose a list of all active device sessions here.");}catch{toast.error("Unable to inspect session information");}finally{setSecuritySessionsLoading(false);}}}>View All</Button></div><p className="text-sm">Current authenticated session</p><p className="text-xs text-muted-foreground">Device, location, and other active sessions are not available from the existing account API. Remote session revocation is not exposed here.</p><Button size="sm" variant="outline" onClick={async()=>{const {error}=await supabase.auth.signOut({scope:"others"});if(error)toast.error(error.message);else toast.success("Other sessions sign-out requested");}}>Sign Out Other Sessions</Button></div></div>
          <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Account Actions</h4>{[["Download My Data","Export account data"],["Deactivate Account","Temporarily disable your seller account"],["Delete Account","Permanently delete your account and data"]].map(([label,desc])=><div key={label} className="flex items-center justify-between gap-3 border-t pt-3"><div><strong className="text-sm">{label}</strong><p className="text-xs text-muted-foreground">{desc}</p></div><Button size="sm" variant="outline" onClick={()=>toast.info("This action requires a verified account-management workflow and is not available from Store Settings.")}>{label.startsWith("Download")?"Download":label.startsWith("Deactivate")?"Deactivate":"Delete"}</Button></div>)}</div><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Security Notifications</h4><p className="text-xs text-muted-foreground">Preferences are saved privately; essential security alerts are not disabled.</p>{[["login","New Login Alerts"],["suspicious","Suspicious Activity Alerts"],["password","Password Changes"],["team","Account Access by Team Members"]].map(([id,label])=><label key={id} className="flex justify-between gap-2 text-sm"><span>{label}</span><input type="checkbox" checked={securityAlerts[id as keyof typeof securityAlerts]} onChange={e=>setSecurityAlerts(v=>({...v,[id]:e.target.checked}))}/></label>)}</div></div>
          <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>{setSecurityAlerts(securityDefaults);setSecurityPhone(form.phone||"");setSecurityEditingPhone(false);setSecurityMfaMethod("authenticator");}}><RotateCcw className="h-4 w-4 mr-2"/>Reset to Default</Button><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("security")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
        </div>)}
        {section === "compliance" && (<div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-emerald-600"/>12. Account Health &amp; Compliance</h3><p className="text-sm text-muted-foreground">Monitor account performance, verification status and policy compliance to keep your store in good standing.</p></div><Link to="/vendor/register" className="text-sm underline">Learn more</Link></div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Account Health Score</h4><div className="flex items-center gap-4"><div className="h-28 w-28 shrink-0 rounded-full border-[10px] border-slate-200 flex items-center justify-center"><span className="text-xl font-bold">—<span className="block text-xs font-normal text-muted-foreground">/100</span></span></div><div><strong>{vendor.status==="approved"?"Seller approved":"Status: "+(vendor.status||"Unavailable")}</strong><p className="text-xs text-muted-foreground mt-1">A verified health score is not currently available.</p></div></div><p className="rounded bg-blue-50 p-2 text-xs text-blue-900">Policy violations: Not verified. No score or violation history is inferred from seller approval.</p></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Performance Overview</h4><p className="text-xs text-muted-foreground mb-3">Scores require verified operational metrics.</p>{["Order Fulfillment","Customer Service","Policy Compliance","Product Quality","Dispute Rate"].map(label=><div key={label} className="flex items-center gap-3 text-xs py-2 border-b"><span className="w-32">{label}</span><div className="flex-1 h-2 rounded bg-muted"/><span>—/100</span></div>)}</div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Account Status</h4>{[["Identity Verification",sellerApplication?.kyc_status||"Not available"],["Business Documents",verifiedDocuments.length?verifiedDocuments.every(d=>d.verification_status==="verified")?"Verified":"Review statuses":"Not available"],["Address Verification","Not independently verified"],["Payment Method",sellerPayoutAccount?.verification_status||"Not available"],["Tax Information","Not independently verified"],["Store Policy Compliance","Not assessed"],["Product Listings","See products"],["Selling Privileges",vendor.status||"Not available"]].map(([label,value])=><div key={label} className="flex justify-between items-center gap-2 border-b py-2 text-xs"><span>{label}</span><span className="rounded bg-muted px-2 py-1 text-right">{value}</span></div>)}</div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Identity Verification (KYC)</h4><p className="text-xs text-muted-foreground">Verify your identity and business to sell on Barakaz.</p><div className="rounded bg-muted/40 p-3"><strong className="text-sm">Status: {sellerApplication?.kyc_status||"Not available"}</strong><p className="text-xs text-muted-foreground">Application: {sellerApplication?.status||"Not available"}</p></div><h5 className="text-sm font-semibold">Documents submitted</h5>{verifiedDocuments.length?verifiedDocuments.slice(0,complianceExpanded.documents?undefined:3).map(d=><div key={d.id} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{d.requirement_code.replace(/_/g," ")}</span><span>{d.verification_status||"Pending"}{d.uploaded_at?" · "+new Date(d.uploaded_at).toLocaleDateString():""}</span></div>):<p className="text-xs text-muted-foreground">No verification document records available.</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>setComplianceExpanded(v=>({...v,documents:!v.documents}))}>{complianceExpanded.documents?"Show Fewer":"View Documents"}</Button><Link to="/vendor/register" className="rounded border px-3 py-2 text-xs">Manage Verification</Link></div></div>
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Policy Compliance</h4><p className="text-xs text-muted-foreground">Follow Barakaz's selling policies and marketplace rules.</p>{["Prohibited & Restricted Items","Product Listing Policy","Intellectual Property Policy","Customer Communication Policy","Fair Pricing Policy","Returns & Refunds Policy","Data Privacy Policy"].slice(0,complianceExpanded.policies?7:5).map(label=><div key={label} className="flex justify-between gap-2 border-b py-2 text-xs"><span>{label}</span><span className="text-muted-foreground">Not assessed</span></div>)}<Button size="sm" variant="outline" onClick={()=>setComplianceExpanded(v=>({...v,policies:!v.policies}))}>{complianceExpanded.policies?"Show Fewer":"View Policy Details"}</Button><p className="text-xs text-muted-foreground">No per-policy compliance assessments are exposed by the current seller data.</p></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Account Alerts</h4><p className="text-xs text-muted-foreground">Important notifications about your account health.</p><div className="rounded bg-blue-50 p-3 text-xs text-blue-900">Keep your business and tax information up to date.</div>{sellerApplication?.status==="more_information_required"&&<div className="rounded bg-amber-50 p-3 text-xs text-amber-900">Your seller application requires additional information.</div>}{complianceExpanded.alerts&&<p className="text-xs text-muted-foreground">There is no verified account-alert feed connected to this view.</p>}<Button variant="outline" size="sm" onClick={()=>setComplianceExpanded(v=>({...v,alerts:!v.alerts}))}>{complianceExpanded.alerts?"Show Fewer":"View All Alerts"}</Button></div>
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Compliance Training</h4><p className="text-xs text-muted-foreground">Complete required training to stay compliant.</p>{[["Marketplace Selling Policies","10 min"],["Prohibited & Restricted Products","8 min"]].map(([name,duration])=><div key={name} className="flex items-center justify-between gap-3 border-b py-2"><div><strong className="text-xs">{name}</strong><p className="text-xs text-muted-foreground">{duration} · Completion not tracked</p></div><Button size="sm" variant="outline" onClick={()=>{toast.info("Training content and completion tracking are not yet connected.");}}>Start Training</Button></div>)}<div className="h-2 rounded bg-muted"/><p className="text-xs text-muted-foreground">Training progress unavailable. No completion claims are made.</p></div>
          </div>
          <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>{setComplianceExpanded({documents:false,policies:false,alerts:false});}}><RotateCcw className="h-4 w-4 mr-2"/>Reset to Default</Button><Button onClick={()=>toast.info("Account health and compliance statuses are read-only. No account changes have been saved.")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
        </div>)}
        {section === "tax" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-emerald-600"/>5. Tax Settings</h3><p className="text-sm text-muted-foreground">Manage your tax registration, tax rates and tax-related documents.</p></div><a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html" target="_blank" rel="noreferrer" className="text-sm underline">Learn more</a></div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 grid gap-4 md:grid-cols-2">
              <div><div className="flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-emerald-600"/><strong>Tax Status</strong><span className="rounded bg-white px-2 py-1 text-xs">{taxDraft.businessNumber?"Registration details provided":"Registration not confirmed"}</span></div><p className="text-xs text-muted-foreground mt-2">Tax registration status must be verified before being marked registered.</p><p className="text-xs mt-2 rounded bg-amber-50 p-2 text-amber-800">Keep your tax information up to date to avoid order issues.</p></div>
              <div className="border-l pl-4"><p className="text-xs font-semibold">Tax Registration Number (BN)</p><p className="font-semibold mt-2">{taxDraft.businessNumber||"Not provided"} {taxDraft.program}</p><p className="text-sm text-muted-foreground">{taxDraft.country==="CA"?"🇨🇦 Canada":taxDraft.country}</p></div>
            </div>
            <div className="rounded-lg border p-4 space-y-4"><div><h4 className="font-semibold">Tax Registration</h4><p className="text-xs text-muted-foreground">Provide your tax registration details.</p></div><div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Tax Registration Country *<select className="mt-1 w-full rounded-md border bg-background p-2" value={taxDraft.country} onChange={e=>setTaxDraft(x=>({...x,country:e.target.value}))}><option value="CA">🇨🇦 Canada</option><option value="US">United States</option><option value="OTHER">Other</option></select></label>
              <label className="text-sm font-medium">Tax Type *<select className="mt-1 w-full rounded-md border bg-background p-2" value={taxDraft.type} onChange={e=>setTaxDraft(x=>({...x,type:e.target.value}))}><option>GST / HST</option><option>PST</option><option>QST</option><option>Other</option></select></label>
              <div><Label>Business Number (BN) *</Label><div className="flex gap-2 mt-1"><Input aria-label="Business Number" placeholder="9-digit BN" value={taxDraft.businessNumber} onChange={e=>setTaxDraft(x=>({...x,businessNumber:e.target.value}))}/><Input className="w-28" aria-label="Program account" placeholder="RT0001" value={taxDraft.program} onChange={e=>setTaxDraft(x=>({...x,program:e.target.value}))}/></div><p className="text-xs text-muted-foreground mt-1">Your 9-digit Business Number with the RT program account (e.g. RT0001).</p></div>
              <div><Label>Legal Business Name *</Label><Input className="mt-1" value={taxDraft.legalName} onChange={e=>setTaxDraft(x=>({...x,legalName:e.target.value}))}/></div>
            </div><div className="border-t pt-4"><h4 className="font-semibold">Tax Calculation Settings</h4><p className="text-xs text-muted-foreground">Choose how taxes are calculated for your products.</p><div className="grid gap-3 md:grid-cols-[1fr_250px] mt-3"><div className="space-y-3">{[["marketplace","Use marketplace tax settings (Recommended)","Taxes are calculated using marketplace checkout configuration."],["custom","Manage my own tax rates","Custom rates are a UI preview and are not applied at checkout."]].map(([key,title,desc])=><label key={key} className="flex gap-2 text-sm"><input type="radio" name="tax-calculation" checked={taxCalculation===key} onChange={()=>setTaxCalculation(key as "marketplace"|"custom")}/><span><strong>{title}</strong><span className="block text-xs text-muted-foreground">{desc}</span></span></label>)}</div><div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900"><strong>Automatic Tax Calculation</strong><p className="mt-1">Checkout tax is calculated according to Barakaz's existing tax configuration. This page does not override tax rules.</p></div></div></div></div>
            <div className="rounded-lg border p-4"><div className="flex justify-between items-center gap-2"><div><h4 className="font-semibold">Tax Regions & Rates (Canada)</h4><p className="text-xs text-muted-foreground">Illustrative tax components; verify current rates with the relevant tax authority.</p></div><Button variant="outline" size="sm" onClick={()=>setShowTaxRegions(x=>!x)}>{showTaxRegions?"Show Fewer":"View All Provinces"}</Button></div><div className="overflow-x-auto mt-3"><table className="w-full text-xs text-left"><thead><tr className="bg-muted/60">{["Province / Territory","GST","PST","HST","Total Rate"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{[["Alberta","5%","0%","0%","5%"],["British Columbia","5%","7%","0%","12%"],["Manitoba","5%","7%","0%","12%"],["New Brunswick","0%","0%","15%","15%"],...(showTaxRegions?[["Ontario","0%","0%","13%","13%"],["Quebec","5%","9.975% QST","0%","14.975%"],["Saskatchewan","5%","6%","0%","11%"]]:[])].map(row=><tr key={row[0]} className="border-t">{row.map((cell,i)=><td key={i} className="p-2">{cell}</td>)}</tr>)}</tbody></table></div></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Tax Exemptions (Optional)</h4><p className="text-xs text-muted-foreground">Select if you offer tax exemptions for certain customers.</p><div className="grid sm:grid-cols-2 gap-2 mt-3">{[["organizations","I sell to tax-exempt organizations"],["exports","I sell outside Canada (export sales)"],["digital","I provide digital products or services"]].map(([key,label])=><label key={key} className="text-sm flex gap-2 items-center"><input type="checkbox" checked={taxExemptions[key as keyof typeof taxExemptions]} onChange={e=>setTaxExemptions(x=>({...x,[key]:e.target.checked}))}/>{label}</label>)}</div><p className="text-xs text-muted-foreground mt-3">Exemptions require documentation and verification; these selections do not change checkout tax.</p></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Tax Documents</h4><p className="text-xs text-muted-foreground">Select tax registration documents and related files.</p><div className="flex flex-wrap items-center gap-3 mt-3"><label className="border border-dashed rounded-lg px-5 py-3 cursor-pointer text-sm"><Upload className="h-5 w-5 inline mr-2"/>Upload Document<input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>10*1024*1024){toast.error("Maximum document size is 10MB");return;}setTaxDocument(file||null);}}/><span className="block text-xs text-muted-foreground">JPG, PNG or PDF (Max 10MB)</span></label>{taxDocument&&<span className="text-sm">{taxDocument.name} · Selected, not uploaded</span>}<Button className="ml-auto" disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("tax")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div></div>
          </div>
        )}
        {section === "returns" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><PackageCheck className="h-6 w-6 text-red-600"/>6. Returns &amp; Refunds</h3><p className="text-sm text-muted-foreground">Set your return policy, refund rules and customer instructions.</p></div><Link to="/vendor/returns" className="text-sm underline">Learn more</Link></div>
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Return Policy</h4><p className="text-xs text-muted-foreground">Set the time period and conditions for product returns.</p><div className="grid gap-4 md:grid-cols-[1fr_1fr_200px]"><label className="text-sm font-medium">Return Window *<select className="mt-1 w-full rounded border p-2 bg-background" value={returnsDraft.window} onChange={e=>updateReturns({window:e.target.value})}>{["7 days","14 days","30 days","60 days","No returns"].map(v=><option key={v}>{v}</option>)}</select><span className="block text-xs text-muted-foreground mt-1">Customers can request a return within this period after delivery.</span></label><label className="text-sm font-medium">Return Shipping Cost *<select className="mt-1 w-full rounded border p-2 bg-background" value={returnsDraft.shipping} onChange={e=>updateReturns({shipping:e.target.value})}><option>Customer pays return shipping</option><option>Seller pays return shipping</option><option>Free return shipping</option></select><span className="block text-xs text-muted-foreground mt-1">Choose who pays for the return shipping cost.</span></label><div className="rounded bg-blue-50 p-3 text-xs text-blue-900"><strong>Policy Preview</strong><p className="mt-1">Customers will be able to see your return policy on your store page once publishing is supported.</p></div></div></div>
            <div className="rounded-lg border p-4 grid gap-4 md:grid-cols-2"><div><h4 className="font-semibold">Return Conditions</h4><p className="text-xs text-muted-foreground mb-3">Select the conditions under which returns are accepted.</p>{["Item is unused and in original condition","Original packaging required","Include all accessories and documentation","Item must not be damaged by customer","Return must be requested within the selected time period"].map((label,i)=><label key={label} className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={returnsDraft.conditions[i]} onChange={e=>updateReturns({conditions:returnsDraft.conditions.map((x,j)=>i===j?e.target.checked:x)})}/>{label}</label>)}</div><div className="rounded-lg bg-red-50 p-3"><h4 className="font-semibold text-red-700">Items not eligible for return</h4>{["Personal care items (e.g. skincare, underwear)","Downloadable digital products","Gift cards","Customized or made-to-order items","Perishable goods (e.g. food, supplements)","Other (specify)"].map((label,i)=><label key={label} className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={returnsDraft.excluded[i]} onChange={e=>updateReturns({excluded:returnsDraft.excluded.map((x,j)=>i===j?e.target.checked:x)})}/>{label}</label>)}<Input placeholder="Enter details..." value={returnsDraft.other} onChange={e=>updateReturns({other:e.target.value})}/></div></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Refund Options</h4><p className="text-xs text-muted-foreground mb-3">Choose how refunds are processed.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Refund Method *<select className="w-full rounded border bg-background p-2 mt-1" value={returnsDraft.method} onChange={e=>updateReturns({method:e.target.value})}><option>Original payment method</option><option>Store credit</option></select><span className="block text-xs text-muted-foreground">Refund to the customer's original payment method.</span></label><label className="text-sm font-medium">Refund Processing Time *<select className="w-full rounded border bg-background p-2 mt-1" value={returnsDraft.processing} onChange={e=>updateReturns({processing:e.target.value})}>{["1 – 2 business days","3 – 5 business days","5 – 10 business days"].map(x=><option key={x}>{x}</option>)}</select><span className="block text-xs text-muted-foreground">Time to process the refund after approval.</span></label><label className="text-sm font-medium">Restocking Fee (Optional)<div className="flex items-center gap-2"><Input className="mt-1" type="number" min="0" step="0.01" value={returnsDraft.restocking} onChange={e=>updateReturns({restocking:e.target.value})}/><span>CAD</span></div><span className="block text-xs text-muted-foreground">Charge a fee for returned items if applicable.</span></label></div></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Return Address</h4><p className="text-xs text-muted-foreground mb-3">Set the address where customers should send returned items.</p><div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><label className="flex items-start gap-2 text-sm"><input type="radio" name="return-address" checked={returnsDraft.address==="primary"} onChange={()=>updateReturns({address:"primary"})}/><span><strong>Use my primary business address</strong><span className="block text-xs text-muted-foreground">{[businessDraft.street,businessDraft.city,businessDraft.province,businessDraft.postal,businessDraft.country].filter(Boolean).join(", ")||"No business address provided"}</span></span></label><label className="flex gap-2 items-start text-sm"><input type="radio" name="return-address" checked={returnsDraft.address==="different"} onChange={()=>updateReturns({address:"different"})}/><span><strong>Use a different return address</strong><span className="block text-xs text-muted-foreground">Set a separate address for returns.</span></span></label>{returnsDraft.address==="different"&&<div className="grid gap-2"><Input aria-label="Apt No. & Street Address" placeholder="Apt No. & Street Address" value={returnsDraft.returnStreet} onChange={e=>updateReturns({returnStreet:e.target.value})}/><Input placeholder="City" value={returnsDraft.returnCity} onChange={e=>updateReturns({returnCity:e.target.value})}/><Input placeholder="Province" value={returnsDraft.returnProvince} onChange={e=>updateReturns({returnProvince:e.target.value})}/><Input placeholder="Postal code" value={returnsDraft.returnPostal} onChange={e=>updateReturns({returnPostal:e.target.value})}/></div>}</div><label className="text-sm font-medium">Return Instructions for Customers<span className="block text-xs text-muted-foreground mb-2">These instructions will be shown to customers when publishing is supported.</span><Textarea rows={5} maxLength={500} value={returnsDraft.instructions} onChange={e=>updateReturns({instructions:e.target.value})}/><span className="block text-xs text-muted-foreground text-right">{returnsDraft.instructions.length}/500</span></label></div></div>
            <div className="rounded-lg border p-4"><h4 className="font-semibold">Additional Settings</h4><div className="grid gap-3 md:grid-cols-2 mt-3">{[["Allow return requests from customers","Customers can request returns through their orders."],["Allow partial refunds","Issue partial refunds when authorized."],["Auto-approve returns for eligible items","Automatic approval requires backend rules."],["Send email notifications for return requests","Get notified when a customer requests a return."],["Show return policy on product pages","Display your return policy to customers."],["Require photos for return requests","Customers must upload photos when requesting a return."]].map(([label,desc],i)=><label key={label} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={returnsDraft.toggles[i]} onChange={e=>updateReturns({toggles:returnsDraft.toggles.map((x,j)=>i===j?e.target.checked:x)})}/><span><strong>{label}</strong><span className="block text-xs text-muted-foreground">{desc}</span></span></label>)}</div></div>
            <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>setReturnsDraft({...returnsDefaults})}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("returns")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
          </div>
        )}
        {section === "policies" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-amber-600"/>7. Store Policies</h3><p className="text-sm text-muted-foreground">Create and manage your store policies. These policies can be published to storefront pages once backend support is available.</p></div><Button size="sm" variant="outline" onClick={()=>setPolicyPreview(v=>!v)}><ExternalLink className="h-4 w-4 mr-2"/>{policyPreview?"Close Preview":"Preview Policies"}</Button></div>
            <div className="rounded-md border bg-blue-50 p-3 text-xs text-blue-900">Policy content is saved as a private draft; publication controls are previews. Existing marketplace policies remain authoritative until a reviewed publishing workflow is available.</div>
            {policyPreview&&<div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Store Policy Preview</h4>{policyDefinitions.filter(([id])=>policyDisplay[id]).map(([id,name])=><div key={id} className="border-t pt-2"><h5 className="font-medium">{name}</h5><p className="text-sm whitespace-pre-wrap">{policyDrafts[id]?.trim()||"No store-specific policy drafted."}</p></div>)}</div>}
            <div className="grid gap-3 md:grid-cols-2">{policyDefinitions.map(([id,name,hint])=><div key={id} className="rounded-lg border p-3 space-y-2"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{name}</h4><span className="rounded bg-muted px-2 py-1 text-xs">{id==="cancellation"&&policyLocalPublished?"Preview marked published · not live":"Not published to storefront"}</span></div><p className="text-xs text-muted-foreground">{hint}</p><div className="rounded-md border overflow-hidden"><div className="flex flex-wrap gap-2 items-center bg-muted/40 p-2 text-xs"><span className="text-muted-foreground">Markdown shortcuts:</span>{([["Bold","**","**"],["Italic","*","*"],["Heading","## ",""],["Bullet","- ",""],["Numbered","1. ",""],["Link","[","](https://example.com)"]] as const).map(([label,prefix,suffix])=><button key={label} type="button" disabled={!policyEditing[id]} aria-label={`${label} ${name}`} title={`${label} (Markdown)`} className="rounded border bg-background px-2 py-1 disabled:opacity-50" onClick={()=>insertPolicyMarkup(id,prefix,suffix)}>{label}</button>)}</div><textarea id={`policy-editor-${id}`} aria-label={name} className="w-full p-3 min-h-32 text-sm bg-background resize-y" value={policyDrafts[id]||""} readOnly={!policyEditing[id]} placeholder={"Write your "+name.toLowerCase()+" here..."} onChange={e=>setPolicyDrafts(v=>({...v,[id]:e.target.value}))}/></div><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Markdown text · save your draft below</span><div className="flex gap-2">{id==="cancellation"&&<Button size="sm" onClick={()=>{setPolicyLocalPublished(v=>!v);toast.info("Preview status only; not published live.");}}>{policyLocalPublished?"Unpublish Preview":"Publish Preview"}</Button>}<Button size="sm" variant="outline" onClick={()=>setPolicyEditing(v=>({...v,[id]:!v[id]}))}>{policyEditing[id]?"Done":"Edit"}</Button></div></div></div>)}</div>
            <div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Policy Display Settings</h4><p className="text-xs text-muted-foreground">Choose where your policies will be shown once publishing is available.</p><div className="grid gap-3 md:grid-cols-3">{[...policyDefinitions.map(([id,name])=>[id,"Show "+name] as const),["fallback","Use Barakaz default policies as fallback"] as const].map(([id,label])=><label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!policyDisplay[id]} onChange={e=>setPolicyDisplay(v=>({...v,[id]:e.target.checked}))}/>{label}</label>)}</div><div className="rounded bg-blue-50 p-3 text-xs text-blue-900">Saved privately as drafts; marketplace policies remain authoritative.</div></div>
            <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>{setPolicyDrafts({});setPolicyEditing({});setPolicyLocalPublished(false);setPolicyDisplay({privacy:true,terms:true,shipping:true,refund:true,cancellation:false,security:true,fallback:true});}}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("policies")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
          </div>
        )}
        {section === "notifications" && (
          <div className="space-y-5">
            <div><h3 className="text-xl font-bold flex items-center gap-2"><Bell className="h-6 w-6 text-orange-600"/>9. Notifications</h3><p className="text-sm text-muted-foreground">Manage how and when you receive notifications. Choose your preferred channels and notification types.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[["email","✉","Email Notifications"],["sms","▣","SMS Notifications"],["inapp","♟","In-App Notifications"],["browser","▤","Browser Notifications"]].map(([id,icon,label])=><button type="button" key={id} onClick={()=>updateNotification({channel:id})} className={`rounded-md border px-2 py-3 text-xs sm:text-sm font-medium ${notificationDraft.channel===id?"border-orange-500 bg-orange-50 text-orange-700":""}`}><span className="mr-2">{icon}</span>{label}</button>)}</div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,1fr)]">
              <div className="rounded-lg border p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-semibold">{notificationDraft.channel==="email"?"Email":notificationDraft.channel==="sms"?"SMS":notificationDraft.channel==="inapp"?"In-App":"Browser"} Notification Settings</h4><p className="text-xs text-muted-foreground">Choose which alerts you prefer to receive on this channel.</p></div><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={notificationDraft.enabled[notificationDraft.channel]} onChange={e=>updateNotification({enabled:{...notificationDraft.enabled,[notificationDraft.channel]:e.target.checked}})}/>Enable Notifications</label></div>
                <div className="divide-y">{notificationTypes.filter(([id])=>notificationDraft.channel==="email"||notificationDraft.channel==="inapp"&&id!=="marketing"||notificationDraft.channel==="sms"&&["orders","updates","returns","payouts"].includes(id)||notificationDraft.channel==="browser"&&["orders","updates","messages","payouts"].includes(id)).map(([id,label,desc])=><div key={id} className="py-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-start gap-2 text-sm flex-1"><input type="checkbox" className="mt-1" checked={notificationDraft.selected[notificationDraft.channel].includes(id)} onChange={e=>toggleNotificationType(notificationDraft.channel,id,e.target.checked)}/><span><strong>{label}</strong><span className="block text-xs text-muted-foreground">{desc}</span></span></label>{notificationDraft.channel==="email"&&<select aria-label={label+" frequency"} className="rounded border bg-background p-2 text-xs" value={notificationDraft.frequency[id]} onChange={e=>updateNotification({frequency:{...notificationDraft.frequency,[id]:e.target.value}})}>{["Instantly","Daily Digest","Weekly Digest"].map(x=><option key={x}>{x}</option>)}</select>}</div>)}</div>
              </div>
              <div className="space-y-3"><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Email Preferences</h4><p className="text-xs text-muted-foreground">Manage your email notification settings.</p><div><Label>Notification Email *</Label><Input type="email" value={notificationDraft.email} onChange={e=>updateNotification({email:e.target.value})}/></div><div><Label>CC Email (Optional)</Label><Input type="email" placeholder="Enter additional email" value={notificationDraft.cc} onChange={e=>updateNotification({cc:e.target.value})}/></div><div><Label>Email Language</Label><select className="w-full rounded border bg-background p-2 mt-1" value={notificationDraft.language} onChange={e=>updateNotification({language:e.target.value})}><option>English</option><option>French</option></select></div><p className="rounded bg-blue-50 p-3 text-xs text-blue-900">Keep your verified account email up to date to receive important marketplace notifications.</p></div><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Quiet Hours</h4><p className="text-xs text-muted-foreground">Temporarily pause non-critical notifications once supported.</p><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={notificationDraft.quiet} onChange={e=>updateNotification({quiet:e.target.checked})}/>Enable Quiet Hours</label><div className="grid grid-cols-2 gap-2">{([["quietStart","Start Time"],["quietEnd","End Time"]] as const).map(([key,label])=><label key={key} className="text-xs">{label}<input type="time" className="mt-1 w-full rounded border p-2" value={notificationDraft[key]} onChange={e=>updateNotification({[key]:e.target.value})}/></label>)}</div><p className="text-xs text-muted-foreground">Critical order cancellation and security alerts will not be suppressed by these UI preferences.</p></div></div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">{([["sms","SMS","Receive important updates via SMS."],["inapp","In-App","Receive notifications inside your account."],["browser","Browser","Receive notifications on this device/browser."]] as const).map(([channel,title,desc])=><div key={channel} className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">{title} Notification Settings</h4><p className="text-xs text-muted-foreground">{desc}</p><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={notificationDraft.enabled[channel]} onChange={e=>updateNotification({enabled:{...notificationDraft.enabled,[channel]:e.target.checked}})}/>Enable {title} Notifications</label>{channel==="sms"&&<div><Label>Phone Number</Label><Input type="tel" value={notificationDraft.phone} onChange={e=>updateNotification({phone:e.target.value})} placeholder="+1 780 691 4120"/></div>}{notificationTypes.filter(([id])=>channel==="sms"?["orders","updates","returns","payouts"].includes(id):channel==="browser"?["orders","updates","messages","payouts"].includes(id):id!=="marketing").map(([id,label])=><label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationDraft.selected[channel].includes(id)} onChange={e=>toggleNotificationType(channel,id,e.target.checked)}/>{label}</label>)}</div>)}</div>
            <div className="rounded border bg-blue-50 p-3 text-xs text-blue-900">Save your notification preferences below. Delivery scheduling is not yet connected; essential operational alerts remain active.</div>
            <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>setNotificationDraft({...notificationDefaults})}><RotateCcw className="h-4 w-4 mr-2"/>Reset to Default</Button><Button disabled={saving || preferencesLoading || !!preferencesError} onClick={()=>void saveSection("notifications")}><Save className="h-4 w-4 mr-2"/>Save Changes</Button></div>
          </div>
        )}
        {section === "team" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-orange-600"/>10. Team &amp; Staff</h3><p className="text-sm text-muted-foreground">Manage team members, roles and permissions for your store. Add staff to help run your business.</p></div><a className="text-sm underline" href="https://docs.stripe.com/connect" target="_blank" rel="noreferrer">Learn more</a></div>
            <div className="rounded-lg border p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Team Overview</h4><Button onClick={()=>setTeamShowInvite(x=>!x)} size="sm">+ Add Team Member</Button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[["Total Team Members","1"],["Active Members","1"],["Pending Invitations","—"],["Inactive Members","—"]].map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><p className="text-xs text-muted-foreground">Only the current store owner is shown. Staff counts and invitations require an authorized staff-management backend.</p></div>
            {teamShowInvite&&<div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Invite Team Member</h4><p className="text-xs text-muted-foreground">Prepare an invitation for a new team member. Sending invitations is not yet enabled.</p><div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"><div><Label>Email Address *</Label><Input type="email" placeholder="example@company.com" value={teamInvite.email} onChange={e=>setTeamInvite(x=>({...x,email:e.target.value}))}/></div><div><Label>Full Name *</Label><Input placeholder="Enter full name" value={teamInvite.name} onChange={e=>setTeamInvite(x=>({...x,name:e.target.value}))}/></div><div><Label>Role *</Label><select aria-label="Team member role" className="w-full rounded-md border bg-background p-2 mt-1" value={teamInvite.role} onChange={e=>setTeamInvite(x=>({...x,role:e.target.value}))}><option value="">Select a role</option>{teamRoles.filter(x=>x!=="Owner").map(x=><option key={x}>{x}</option>)}</select></div><Button onClick={()=>{if(!teamInvite.name.trim()||!teamInvite.email.trim()||!teamInvite.role){toast.error("Enter a name, email address and role.");return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teamInvite.email.trim())){toast.error("Enter a valid email address.");return;}toast.info("Invitation details validated. Sending is unavailable until staff management is connected; no email was sent.");}}>Review Invitation</Button></div></div>}
            <div className="rounded-lg border p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-semibold">Team Members</h4><p className="text-xs text-muted-foreground">View and manage your team members.</p></div><Input className="max-w-64" placeholder="Search team members..." value={teamSearch} onChange={e=>setTeamSearch(e.target.value)}/></div><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-muted/50"><tr>{["Name","Email","Role","Status","Last Active","Actions"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{[form.store_name||"Store Owner",user?.email||"Account email unavailable"].join(" ").toLowerCase().includes(teamSearch.toLowerCase())&&<tr className="border-t"><td className="p-3">{form.store_name||"Store Owner"}</td><td className="p-3">{user?.email||"—"}</td><td className="p-3"><span className="rounded bg-purple-100 text-purple-800 px-2 py-1">Owner</span></td><td className="p-3">Current account</td><td className="p-3">—</td><td className="p-3">Protected</td></tr>}</tbody></table></div><p className="text-xs text-muted-foreground">No additional staff accounts are shown without verified staff records. Edit, resend and remove actions are unavailable until authorization is implemented.</p></div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Role Permissions</h4><p className="text-xs text-muted-foreground">Illustrative role templates. Changes here do not grant or revoke access.</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-muted/50"><th className="p-2 text-left">Permission</th>{teamRoles.map(role=><th className="p-2" key={role}>{role}</th>)}</tr></thead><tbody>{teamPermissions.map(permission=><tr key={permission} className="border-t"><td className="p-2 whitespace-nowrap">{permission}</td>{teamRoles.map(role=><td key={role} className="p-2 text-center"><input aria-label={role+" "+permission} type="checkbox" disabled={role==="Owner"} checked={teamRoleMatrix[role]?.includes(permission)||false} onChange={e=>setTeamRoleMatrix(v=>({...v,[role]:e.target.checked?[...(v[role]||[]),permission]:(v[role]||[]).filter(p=>p!==permission)}))}/></td>)}</tr>)}</tbody></table></div><Button size="sm" variant="outline" onClick={()=>setTeamRoleMatrix(teamRoleDefaults)}>Reset Role Templates</Button></div><div className="rounded-lg border p-4 space-y-3"><h4 className="font-semibold">Activity Log</h4><p className="text-xs text-muted-foreground">Recent team activities on your store.</p><div className="rounded bg-muted/40 p-3 text-sm">No verified staff activity records available.</div><p className="text-xs text-muted-foreground">Activity entries will appear once audit logging and authorized staff access are implemented.</p></div></div>
            <div className="rounded border bg-amber-50 p-3 text-xs text-amber-900">Security: This interface does not create accounts, send invitations, modify permissions or revoke access. Role-based access control requires server-side authorization and audit logging.</div>
          </div>
        )}
        {(section==="profile"||section==="branding") && <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setForm(JSON.parse(initialForm))} disabled={!isDirty || saving}><RotateCcw className="h-4 w-4 mr-2"/>Reset Changes</Button><div className="flex gap-2"><Button variant="outline" asChild><Link to={`/store/${vendor.slug}`} target="_blank"><ExternalLink className="h-4 w-4 mr-2"/>Preview Store</Link></Button><Button onClick={handleSave} disabled={saving || preferencesLoading || !!preferencesError || slugAvailability !== "available"} >{saving ? "Saving..." : "Save Settings"}</Button></div></div>}
        {setupMode && <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 flex items-center justify-between gap-2 border-t bg-card px-4 sm:px-6 lg:px-8 py-3"><Button type="button" variant="outline" disabled={stepIndex<=0||saving} onClick={()=>setSection(sections[stepIndex-1][0])}>Back</Button><Button type="button" disabled={saving||finalSubmitting||preferencesLoading||!!preferencesError} onClick={()=>void saveAndContinue()}>{saving||finalSubmitting?"Saving…":stepIndex===sections.length-1?(vendor.status==="approved"?"Save":"Save and Submit"):"Save & continue"}<ChevronRight className="h-4 w-4 ml-1"/></Button></div>}
      </div>
      </div>
      </div>}
    </div>
  );
};

export default VendorSettings;
