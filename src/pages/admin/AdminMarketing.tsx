import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Megaphone, Upload, Layers, CheckCircle2, XCircle, Loader2, ExternalLink, Search, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { convertImageToWebp } from "@/lib/imageToWebp";


// ----- Spec definitions shown in the UI -----
const SPECS = {
  desktopBanner: { w: 1920, h: 600, maxKB: 2048, label: "Desktop Hero" },
  mobileBanner: { w: 750, h: 500, maxKB: 1024, label: "Mobile Hero" },
  brand: { w: 600, h: 600, maxKB: 1024, label: "Brand Logo" },
  product: { w: 800, h: 800, maxKB: 1024, label: "Product Spotlight" },
};

// ----- Promotion placement metadata (single source of truth) -----
const PLACEMENTS: Record<
  string,
  { label: string; description: string; kind: "brand" | "product"; spec: typeof SPECS.brand }
> = {
  featured_brands: {
    label: "Featured Brands",
    description: "Small logo grid below the hero. Best for brand logos.",
    kind: "brand",
    spec: SPECS.brand,
  },
  sponsored_products: {
    label: "Sponsored Products",
    description: "Large product cards under Featured Brands.",
    kind: "product",
    spec: SPECS.product,
  },
};

const SpecCard = ({ spec }: { spec: { w: number; h: number; maxKB: number; label: string } }) => (
  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
    <div className="font-semibold flex items-center gap-1.5">
      <ImageIcon className="h-3.5 w-3.5" /> {spec.label} requirements
    </div>
    <div>
      Image must be <span className="font-mono font-semibold">exactly {spec.w} × {spec.h} px</span>
    </div>
    <div>Format: JPG, PNG or WebP</div>
    <div>Max file size: {spec.maxKB >= 1024 ? `${spec.maxKB / 1024} MB` : `${spec.maxKB} KB`}</div>
    <div className="text-muted-foreground">Tip: keep important text within the centre 60%.</div>
  </div>
);

// ===== Destination picker =====
// Lets the admin map a banner/promotion click to a real destination instead
// of typing a raw URL. Stored value is always a resolved path written to link_url.

type DestMode = "category" | "product" | "vendor" | "custom";

const parseDestination = (url: string): { mode: DestMode; slug: string; raw: string } => {
  if (!url) return { mode: "custom", slug: "", raw: "/" };
  // /category/{slug}  OR  /search?category={slug}
  const catPath = url.match(/^\/category\/([^/?#]+)/);
  if (catPath) return { mode: "category", slug: catPath[1], raw: url };
  const catQuery = url.match(/^\/search\?category=([^&#]+)/);
  if (catQuery) return { mode: "category", slug: decodeURIComponent(catQuery[1]), raw: url };
  const prod = url.match(/^\/product\/([^/?#]+)/);
  if (prod) return { mode: "product", slug: prod[1], raw: url };
  const store = url.match(/^\/store\/([^/?#]+)/);
  if (store) return { mode: "vendor", slug: store[1], raw: url };
  return { mode: "custom", slug: "", raw: url };
};

const buildUrl = (mode: DestMode, slug: string, custom: string): string => {
  if (mode === "category" && slug) return `/search?category=${encodeURIComponent(slug)}`;
  if (mode === "product" && slug) return `/product/${slug}`;
  if (mode === "vendor" && slug) return `/store/${slug}`;
  return custom || "/";
};

// Debounce hook
const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const SearchableCombobox = ({
  table,
  selectColumns,
  searchColumn,
  selectedSlug,
  onSelect,
  placeholder,
  extraFilter,
}: {
  table: "products" | "vendors";
  selectColumns: string;
  searchColumn: string;
  selectedSlug: string;
  onSelect: (item: { slug: string; name: string }) => void;
  placeholder: string;
  extraFilter?: (q: any) => any;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["dest-search", table, debounced],
    queryFn: async () => {
      let q: any = supabase.from(table).select(selectColumns).limit(20);
      if (debounced.trim()) q = q.ilike(searchColumn, `%${debounced.trim()}%`);
      if (extraFilter) q = extraFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Look up the currently-selected item's display name
  const { data: selectedItem } = useQuery({
    queryKey: ["dest-selected", table, selectedSlug],
    enabled: !!selectedSlug,
    queryFn: async () => {
      const { data } = await supabase.from(table).select(selectColumns).eq("slug", selectedSlug).maybeSingle();
      return data as any;
    },
  });

  const displayName = selectedItem
    ? (table === "products" ? selectedItem.name : selectedItem.store_name)
    : selectedSlug
      ? `(missing — slug: ${selectedSlug})`
      : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {displayName || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <Search className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Searching…" : "No matches"}</CommandEmpty>
            <CommandGroup>
              {results.map((r: any) => {
                const name = table === "products" ? r.name : r.store_name;
                return (
                  <CommandItem
                    key={r.id}
                    value={r.slug}
                    onSelect={() => {
                      onSelect({ slug: r.slug, name });
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const DestinationPicker = ({
  value,
  onChange,
  required = true,
}: {
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}) => {
  const initial = useMemo(() => parseDestination(value), [value]);
  const [mode, setMode] = useState<DestMode>(initial.mode);
  const [slug, setSlug] = useState(initial.slug);
  const [custom, setCustom] = useState(initial.mode === "custom" ? initial.raw : "");

  // Re-parse when the parent value changes (e.g. switching from edit to create)
  useEffect(() => {
    const next = parseDestination(value);
    setMode(next.mode);
    setSlug(next.slug);
    setCustom(next.mode === "custom" ? next.raw : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Push resolved url upstream whenever inputs change
  useEffect(() => {
    onChange(buildUrl(mode, slug, custom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slug, custom]);

  const { data: categories = [] } = useQuery({
    queryKey: ["dest-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug,parent_id")
        .order("name");
      return data || [];
    },
  });

  const categoryOptions = useMemo(() => {
    const map = new Map(categories.map((c: any) => [c.id, c.name]));
    return categories.map((c: any) => ({
      slug: c.slug,
      label: c.parent_id ? `${c.name}  (in ${map.get(c.parent_id) || "—"})` : c.name,
    }));
  }, [categories]);

  // Validate selection
  const selectedCategoryMissing =
    mode === "category" && slug && categories.length > 0 && !categories.find((c: any) => c.slug === slug);

  const resolvedUrl = buildUrl(mode, slug, custom);
  const hasValidSelection =
    (mode === "category" && !!slug) ||
    (mode === "product" && !!slug) ||
    (mode === "vendor" && !!slug) ||
    (mode === "custom" && !!custom.trim());

  return (
    <div className="space-y-2">
      <Label>When clicked, go to {required && "*"}</Label>

      <div className="inline-flex rounded-md border p-0.5 bg-muted/40 text-xs">
        {(
          [
            { v: "category", label: "Category" },
            { v: "product", label: "Product" },
            { v: "vendor", label: "Vendor store" },
            { v: "custom", label: "Custom URL" },
          ] as { v: DestMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => {
              setMode(opt.v);
              if (opt.v !== "custom") setSlug("");
              if (opt.v === "custom" && !custom) setCustom("/");
            }}
            className={`px-2.5 py-1 rounded ${
              mode === opt.v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "category" && (
        <Select value={slug || undefined} onValueChange={setSlug}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a category…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {categoryOptions.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.label}
              </SelectItem>
            ))}
            {categoryOptions.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories yet.</div>
            )}
          </SelectContent>
        </Select>
      )}

      {mode === "product" && (
        <SearchableCombobox
          table="products"
          selectColumns="id,name,slug"
          searchColumn="name"
          selectedSlug={slug}
          placeholder="Search products by name…"
          extraFilter={(q) => q.eq("status", "active")}
          onSelect={({ slug: s }) => setSlug(s)}
        />
      )}

      {mode === "vendor" && (
        <SearchableCombobox
          table="vendors"
          selectColumns="id,store_name,slug"
          searchColumn="store_name"
          selectedSlug={slug}
          placeholder="Search vendor stores…"
          extraFilter={(q) => q.eq("status", "approved")}
          onSelect={({ slug: s }) => setSlug(s)}
        />
      )}

      {mode === "custom" && (
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="/vendor/register or https://example.com"
        />
      )}

      {selectedCategoryMissing && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-3 w-3 mt-px shrink-0" />
          Original category is gone — pick a new destination.
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Will link to:</span>
        {hasValidSelection ? (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-primary hover:underline inline-flex items-center gap-0.5"
          >
            {resolvedUrl}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span className="italic">— pick a destination above —</span>
        )}
      </div>
    </div>
  );
};


// ----- Upload helper -----
async function uploadToBucket(rawFile: File, prefix: string): Promise<string> {
  const file = await convertImageToWebp(rawFile);
  const ext = (file.name.split(".").pop() || "webp").toLowerCase();
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("marketing-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("marketing-assets").getPublicUrl(path);
  return data.publicUrl;
}

function validateFile(file: File, spec: { w: number; h: number; maxKB: number }): Promise<string | null> {
  return new Promise((resolve) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return resolve("Use JPG, PNG or WebP only");
    }
    if (file.size > spec.maxKB * 1024) {
      const sizeKB = Math.round(file.size / 1024);
      return resolve(`File is ${sizeKB}KB — max allowed is ${spec.maxKB}KB`);
    }
    const img = new Image();
    img.onload = () => {
      if (img.width !== spec.w || img.height !== spec.h) {
        resolve(`Image is ${img.width}×${img.height}px. Required exact size: ${spec.w}×${spec.h}px. Please resize and try again.`);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve("Could not read image");
    img.src = URL.createObjectURL(file);
  });
}

// ----- Image upload field (single) -----
const ImageField = ({
  label,
  value,
  spec,
  onChange,
  prefix,
}: {
  label: string;
  value: string;
  spec: { w: number; h: number; maxKB: number; label: string };
  onChange: (url: string) => void;
  prefix: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    const err = await validateFile(file, spec);
    if (err) {
      toast.error(err);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToBucket(file, prefix);
      onChange(url);
      toast.success("Uploaded");
    } catch (e: any) {
      const msg = e?.message || "Upload failed";
      console.error("Marketing upload failed:", e);
      toast.error(`Upload failed: ${msg}`, { duration: 6000 });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <SpecCard spec={spec} />
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
      {value && (
        <div className="rounded-md overflow-hidden border bg-muted/40 max-w-xs">
          <img src={value} alt="preview" className="w-full h-auto" />
        </div>
      )}
    </div>
  );
};

// ----- Bulk file picker for multiple slides -----
type BulkItem = {
  file: File;
  previewUrl: string;
  status: "pending" | "valid" | "invalid";
  error?: string;
};

const BulkFilePicker = ({
  label,
  spec,
  items,
  onChange,
}: {
  label: string;
  spec: { w: number; h: number; maxKB: number; label: string };
  items: BulkItem[];
  onChange: (items: BulkItem[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const next: BulkItem[] = [];
    for (const f of Array.from(files)) {
      const err = await validateFile(f, spec);
      next.push({
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: err ? "invalid" : "valid",
        error: err || undefined,
      });
    }
    onChange([...items, ...next]);
  };

  const removeAt = (idx: number) => {
    const copy = items.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <SpecCard spec={spec} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5 mr-1.5" /> Add {items.length ? "more" : ""} images
      </Button>
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((it, i) => (
            <div key={i} className="relative rounded-md border overflow-hidden bg-muted/30">
              <img src={it.previewUrl} alt="" className="w-full h-20 object-cover" />
              <div className="p-1.5 text-[10px] flex items-start gap-1">
                {it.status === "valid" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0 mt-px" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive shrink-0 mt-px" />
                )}
                <span className="truncate flex-1" title={it.error || it.file.name}>
                  {it.status === "valid" ? `#${i + 1} • ok` : it.error}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ----- Bulk add slides dialog -----
const BulkBannersDialog = ({
  open,
  onOpenChange,
  baseOrder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseOrder: number;
  onCreated: () => void;
}) => {
  const [desktops, setDesktops] = useState<BulkItem[]>([]);
  const [mobiles, setMobiles] = useState<BulkItem[]>([]);
  const [defaultLink, setDefaultLink] = useState("/");
  const [submitting, setSubmitting] = useState(false);

  const validDesktops = desktops.filter((d) => d.status === "valid");
  const invalidDesktops = desktops.length - validDesktops.length;
  const validMobiles = mobiles.filter((m) => m.status === "valid");

  const reset = () => {
    setDesktops([]);
    setMobiles([]);
    setDefaultLink("/");
  };

  const submit = async () => {
    if (validDesktops.length === 0) {
      toast.error("Add at least one valid desktop image.");
      return;
    }
    setSubmitting(true);
    let created = 0;
    let failed = 0;
    try {
      for (let i = 0; i < validDesktops.length; i++) {
        try {
          const desktopUrl = await uploadToBucket(validDesktops[i].file, "banners/desktop");
          let mobileUrl: string | null = null;
          if (validMobiles[i]) {
            mobileUrl = await uploadToBucket(validMobiles[i].file, "banners/mobile");
          }
          const { error } = await supabase.from("hero_banners").insert({
            desktop_image_url: desktopUrl,
            mobile_image_url: mobileUrl,
            link_url: defaultLink || "/",
            display_order: baseOrder + i,
            is_active: true,
          });
          if (error) throw error;
          created++;
        } catch (err: any) {
          console.error("Bulk slide failed", err);
          failed++;
        }
      }
      if (created > 0) {
        toast.success(`Created ${created} slide${created > 1 ? "s" : ""}${failed ? ` (${failed} failed)` : ""}`);
        onCreated();
        reset();
        onOpenChange(false);
      } else {
        toast.error("No slides were created. Check sizes and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk add hero slides</DialogTitle>
          <DialogDescription>
            Pick multiple desktop images at once — each becomes one slide in the carousel. Optionally pick mobile images;
            they pair with desktops in the same order. Slots without a mobile image fall back to the desktop image on phones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <BulkFilePicker
            label={`Desktop images (${validDesktops.length} ready${invalidDesktops ? `, ${invalidDesktops} invalid` : ""})`}
            spec={SPECS.desktopBanner}
            items={desktops}
            onChange={setDesktops}
          />
          <BulkFilePicker
            label={`Mobile images (optional, paired by order)`}
            spec={SPECS.mobileBanner}
            items={mobiles}
            onChange={setMobiles}
          />
        </div>

        <div className="rounded-md border p-3 bg-muted/20">
          <DestinationPicker value={defaultLink} onChange={setDefaultLink} required={false} />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            All new slides will use this destination. You can fine-tune each slide individually after they're created.
          </p>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          <div className="font-semibold mb-1">Preview pairing</div>
          {validDesktops.length === 0 ? (
            <div className="text-muted-foreground">Add desktop images to see the slide order.</div>
          ) : (
            <ol className="space-y-0.5 list-decimal list-inside">
              {validDesktops.map((_, i) => (
                <li key={i}>
                  Slide {i + 1}: desktop ✓ · mobile {validMobiles[i] ? "✓" : "→ falls back to desktop"}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || validDesktops.length === 0}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating…</> : `Create ${validDesktops.length || ""} slide${validDesktops.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ----- Banners tab -----
const emptyBanner = {
  title: "",
  subtitle: "",
  cta_label: "",
  link_url: "/",
  desktop_image_url: "",
  mobile_image_url: "",
  display_order: 0,
  is_active: true,
};

const BannersTab = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyBanner);

  const { data: banners } = useQuery({
    queryKey: ["admin-hero-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_banners").select("*").order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.desktop_image_url) throw new Error("Desktop image is required");
      if (editing) {
        const { error } = await supabase.from("hero_banners").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hero_banners").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      queryClient.invalidateQueries({ queryKey: ["public-hero-banners"] });
      toast.success("Saved");
      setOpen(false);
      setEditing(null);
      setForm(emptyBanner);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hero_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      queryClient.invalidateQueries({ queryKey: ["public-hero-banners"] });
      toast.success("Deleted");
    },
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const list = banners || [];
      const idx = list.findIndex((b: any) => b.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      const a = list[idx];
      await supabase.from("hero_banners").update({ display_order: swap.display_order }).eq("id", a.id);
      await supabase.from("hero_banners").update({ display_order: a.display_order }).eq("id", swap.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("hero_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      queryClient.invalidateQueries({ queryKey: ["public-hero-banners"] });
    },
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyBanner, display_order: (banners?.length || 0) });
    setOpen(true);
  };

  const startEdit = (b: any) => {
    setEditing(b);
    setForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      cta_label: b.cta_label || "",
      link_url: b.link_url || "/",
      desktop_image_url: b.desktop_image_url || "",
      mobile_image_url: b.mobile_image_url || "",
      display_order: b.display_order || 0,
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const nextOrder = banners?.length
    ? Math.max(...banners.map((b: any) => b.display_order || 0)) + 1
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Banners shown in the rotating hero carousel at the top of the homepage. Each saved banner = one slide.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-1.5">
            <Layers className="h-4 w-4" /> Bulk add slides
          </Button>
          <Button onClick={startCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Add banner</Button>
        </div>
      </div>

      <div className="grid gap-3">
        {(banners || []).map((b: any, i: number) => (
          <Card key={b.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <img src={b.desktop_image_url} alt="" className="w-32 h-12 object-cover rounded border" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.title || `Slide ${i + 1}`}</div>
                <div className="text-xs text-muted-foreground truncate">{b.link_url}</div>
                <div className="flex gap-1 mt-1">
                  <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">
                    {b.is_active ? "Live" : "Hidden"}
                  </Badge>
                  {b.mobile_image_url && <Badge variant="outline" className="text-[10px]">Mobile</Badge>}
                </div>
              </div>
              <Switch checked={b.is_active} onCheckedChange={(c) => toggleActive.mutate({ id: b.id, is_active: c })} />
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => reorder.mutate({ id: b.id, dir: -1 })} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => reorder.mutate({ id: b.id, dir: 1 })} disabled={i === (banners?.length || 0) - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => startEdit(b)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Delete this banner?") && remove.mutate(b.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {!banners?.length && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No banners yet. Add one to get started.</CardContent></Card>
        )}
      </div>

      <BulkBannersDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        baseOrder={nextOrder}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
          queryClient.invalidateQueries({ queryKey: ["public-hero-banners"] });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "New hero banner"}</DialogTitle>
            <DialogDescription>
              Upload images at the exact required size for each device. Desktop image is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ImageField
              label="Desktop image *"
              value={form.desktop_image_url}
              spec={SPECS.desktopBanner}
              prefix="banners/desktop"
              onChange={(url) => setForm({ ...form, desktop_image_url: url })}
            />
            <ImageField
              label="Mobile image (optional, falls back to desktop)"
              value={form.mobile_image_url}
              spec={SPECS.mobileBanner}
              prefix="banners/mobile"
              onChange={(url) => setForm({ ...form, mobile_image_url: url })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Headline (optional)</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>CTA label (optional)</Label>
                <Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Shop now" />
              </div>
            </div>
            <div>
              <Label>Subtitle (optional)</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <DestinationPicker
              value={form.link_url}
              onChange={(url) => setForm((prev: any) => ({ ...prev, link_url: url }))}
            />
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save banner"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ----- Promotions tab -----
const emptyPromo = {
  kind: "brand" as "brand" | "product",
  placement: "featured_brands" as "featured_brands" | "sponsored_products",
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "/",
  display_order: 0,
  is_active: true,
};

const PromotionsTab = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyPromo);

  const { data: promos } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promotions").select("*").order("placement").order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProductSlug = parseDestination(form.link_url).mode === "product"
    ? parseDestination(form.link_url).slug : "";

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedProductSlug) throw new Error("Choose a product to promote.");
      const { data: product, error: productError } = await supabase.from("products")
        .select("id,name,slug,status").eq("slug", selectedProductSlug).eq("status", "active").maybeSingle();
      if (productError) throw productError;
      if (!product) throw new Error("The selected product is no longer active. Choose another product.");
      const { data: images, error: imagesError } = await supabase.from("product_images")
        .select("url").eq("product_id", product.id).is("variant_id", null).order("position", { ascending: true }).limit(1);
      if (imagesError) throw imagesError;
      const imageUrl = images?.[0]?.url;
      if (!imageUrl) throw new Error("This product has no main image. Add an image to the product before promoting it.");
      const payload = {
        placement: form.placement,
        kind: PLACEMENTS[form.placement].kind,
        title: product.name,
        subtitle: "",
        image_url: imageUrl,
        link_url: `/product/${product.slug}`,
        display_order: form.display_order,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promotions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["public-promotions"] });
      toast.success("Promotion saved using the product's existing image and name.");
      setOpen(false);
      setEditing(null);
      setForm(emptyPromo);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["public-promotions"] });
      toast.success("Deleted");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("promotions").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["public-promotions"] });
    },
  });

  const startCreate = (placement?: keyof typeof PLACEMENTS) => {
    setEditing(null);
    const p = placement || "featured_brands";
    setForm({ ...emptyPromo, placement: p, kind: PLACEMENTS[p].kind });
    setOpen(true);
  };

  const startEdit = (p: any) => {
    setEditing(p);
    setForm({
      kind: p.kind, placement: p.placement, title: p.title || "", subtitle: p.subtitle || "",
      image_url: p.image_url || "", link_url: p.link_url || "/", display_order: p.display_order || 0,
      is_active: p.is_active,
    });
    setOpen(true);
  };

  // When the placement (display section) changes, auto-sync the image kind/spec
  const handlePlacementChange = (v: string) => {
    const meta = PLACEMENTS[v];
    if (!meta) return;
    setForm((prev: any) => ({ ...prev, placement: v, kind: meta.kind }));
  };


  // Group promos by placement for the list view
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = { featured_brands: [], sponsored_products: [] };
    (promos || []).forEach((p: any) => {
      if (!map[p.placement]) map[p.placement] = [];
      map[p.placement].push(p);
    });
    return map;
  }, [promos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Brand and product spotlights shown below the hero. Choose which homepage section each promo appears in.
        </p>
        <Button onClick={() => startCreate()} className="gap-1.5"><Plus className="h-4 w-4" /> Add promotion</Button>
      </div>

      {Object.entries(PLACEMENTS).map(([key, meta]) => {
        const list = grouped[key] || [];
        const liveCount = list.filter((p) => p.is_active).length;
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <div>
                <h3 className="font-semibold text-sm">{meta.label}</h3>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {liveCount} live · {list.length} total
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => startCreate(key as keyof typeof PLACEMENTS)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded border" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.subtitle}</div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                          {p.is_active ? "Live" : "Hidden"}
                        </Badge>
                      </div>
                    </div>
                    <Switch checked={p.is_active} onCheckedChange={(c) => toggleActive.mutate({ id: p.id, is_active: c })} />
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Delete this promotion?") && remove.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {list.length === 0 && (
                <Card className="sm:col-span-2">
                  <CardContent className="p-4 text-center text-xs text-muted-foreground">
                    No promotions in this section yet.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit promotion" : "New promotion"}</DialogTitle>
            <DialogDescription>
              Choose the homepage section and an existing product. Its name, main image and link are used automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display section *</Label>
              <Select value={form.placement} onValueChange={handlePlacementChange}>
                <SelectTrigger><SelectValue placeholder="Choose a section…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLACEMENTS).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <SearchableCombobox
                table="products"
                selectColumns="id,name,slug"
                searchColumn="name"
                selectedSlug={selectedProductSlug}
                placeholder="Search and choose a product…"
                extraFilter={(q) => q.eq("status", "active")}
                onSelect={({ slug }) => setForm((prev: any) => ({ ...prev, link_url: `/product/${slug}` }))}
              />
              <p className="text-xs text-muted-foreground">Product name, main image and destination are taken from the catalogue.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !selectedProductSlug}>
                {save.isPending ? "Saving…" : "Save promotion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminMarketing = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5" /> Marketing</h1>
        <p className="text-muted-foreground text-sm">Manage homepage hero banners and brand/product promotions.</p>
      </div>
      <Tabs defaultValue="banners" className="w-full">
        <TabsList>
          <TabsTrigger value="banners">Hero Banners</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
        </TabsList>
        <TabsContent value="banners" className="mt-4"><BannersTab /></TabsContent>
        <TabsContent value="promotions" className="mt-4"><PromotionsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMarketing;
