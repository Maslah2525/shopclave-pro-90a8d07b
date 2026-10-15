import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import VendorProfileChecklist from "@/components/vendor/VendorProfileChecklist";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
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
  });
  const warehouse = asJsonRecord(form.warehouse_address);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"profile" | "branding" | "shipping" | "payouts" | "business" | "security" | "compliance">("profile");

  useEffect(() => {
    setForm({
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
    });
  }, [vendor]);

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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Store Settings</h2>
      <div className="max-w-lg"><VendorProfileChecklist vendor={vendor} showLink={false} /></div>
      <nav aria-label="Store settings sections" className="flex flex-wrap gap-2">
        {([["profile","Store Profile"],["branding","Appearance & Branding"],["shipping","Shipping Origin"],["payouts","Payments & Payouts"],["business","Business Information"],["security","Security & Account"],["compliance","Account Health & Compliance"]] as const).map(([key,label]) => (
          <Button key={key} type="button" size="sm" variant={section === key ? "default" : "outline"} aria-pressed={section === key} onClick={() => setSection(key)}>{label}</Button>
        ))}
      </nav>
      <div className="bg-card rounded-lg border border-border p-6 max-w-lg space-y-4">
        {section === "profile" && (<div className="space-y-4">
        <div>
          <Label>Store Name</Label>
          <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
        </div>
        <div>
          <Label>Store Description</Label>
          <Textarea value={form.store_description} onChange={(e) => setForm({ ...form, store_description: e.target.value })} rows={3} />
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
        <h3 className="font-semibold pt-2 border-t border-border">Contact Information</h3>
        <p className="text-xs text-muted-foreground">Customers will see these on your product pages to contact you directly.</p>

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
        {(["profile","branding","shipping"] as const).includes(section as "profile" | "branding" | "shipping") && <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>}
      </div>
    </div>
  );
};

export default VendorSettings;
