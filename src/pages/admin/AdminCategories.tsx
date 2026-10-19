import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { convertImageToWebp } from "@/lib/imageToWebp";
import { CategoryPicker, useCategoryAncestors } from "@/components/shared/CategoryPicker";
import { Button as UiButton } from "@/components/ui/button";

function ParentPickerField({ value, onChange, excludeId }: { value: string; onChange: (v: string) => void; excludeId?: string }) {
  const { data: ancestors = [] } = useCategoryAncestors(value || null);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>Parent Category (optional)</Label>
        {value && (
          <UiButton type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange("")}>
            Clear (top-level)
          </UiButton>
        )}
      </div>
      <CategoryPicker
        value={value}
        onChange={onChange}
        initialPath={ancestors}
        excludeId={excludeId}
        showBreadcrumb
      />
    </div>
  );
}


const AdminCategories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [deleteCat, setDeleteCat] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: "", slug: "", parent_id: "", image: null as File | null });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      // Paginate to bypass PostgREST 1000-row default cap (taxonomy has ~9k rows).
      const pageSize = 1000;
      let all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("name")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
      }
      return all;
    },
    enabled: !!user,
  });

  const topLevel = categories.filter((c: any) => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter((c: any) => c.parent_id === parentId);

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const uploadImage = async (rawFile: File, slug: string): Promise<string> => {
    const file = await convertImageToWebp(rawFile, { quality: 0.9, maxDim: 1600 });
    const path = `categories/${slug}-${Date.now()}.webp`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const slug = form.slug || autoSlug(form.name);
      let image_url: string | null = null;
      if (form.image) image_url = await uploadImage(form.image, slug);
      const { error } = await supabase.from("categories").insert({
        name: form.name.trim(),
        slug,
        parent_id: form.parent_id || null,
        image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setAddOpen(false);
      resetForm();
      toast.success("Category added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const slug = form.slug || autoSlug(form.name);
      let image_url = editCat?.image_url || null;
      if (form.image) image_url = await uploadImage(form.image, slug);
      const { error } = await supabase.from("categories").update({
        name: form.name.trim(),
        slug,
        parent_id: form.parent_id || null,
        image_url,
      }).eq("id", editCat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditCat(null);
      resetForm();
      toast.success("Category updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").delete().eq("id", deleteCat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteCat(null);
      toast.success("Category deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => setForm({ name: "", slug: "", parent_id: "", image: null });

  const openEdit = (cat: any) => {
    setEditCat(cat);
    setForm({ name: cat.name, slug: cat.slug, parent_id: cat.parent_id || "", image: null });
  };

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const openAddChild = (parentId: string) => {
    setForm({ name: "", slug: "", parent_id: parentId, image: null });
    setAddOpen(true);
  };

  const CategoryImage = ({ url }: { url: string | null }) => (
    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
    </div>
  );

  const renderSubcategories = (parentId: string, depth: number) => {
    const children = getChildren(parentId);
    if (!children.length) return null;
    return (
      <div className={depth === 1 ? "ml-6 border-l border-border pl-4 space-y-1" : "ml-6 border-l border-border pl-4 space-y-1"}>
        {children.map((child: any) => {
          const grandchildren = getChildren(child.id);
          return (
            <div key={child.id}>
              <div className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 group">
                <CategoryImage url={child.image_url} />
                 <span className="text-sm font-medium flex-1 min-w-0 break-words">{child.name}</span>
                 <div className="flex gap-1 shrink-0">
                   <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Add subcategory to ${child.name}`} title="Add subcategory" onClick={() => openAddChild(child.id)}><Plus className="h-3.5 w-3.5" /></Button>
                   <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${child.name}`} title="Edit category" onClick={() => openEdit(child)}><Pencil className="h-3.5 w-3.5" /></Button>
                   <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Delete ${child.name}`} title="Delete category" onClick={() => setDeleteCat(child)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {grandchildren.length > 0 && renderSubcategories(child.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormFields = (isEdit = false) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: isEdit ? f.slug : autoSlug(e.target.value) }))} placeholder="Category name" />
      </div>
      <div>
        <Label htmlFor="category-slug">Slug</Label>
        <Input id="category-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" />
      </div>
      <ParentPickerField
        value={form.parent_id}
        onChange={(v) => setForm((f) => ({ ...f, parent_id: v }))}
        excludeId={editCat?.id}
      />

      <div>
        <Label>Category image</Label>
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {form.image ? (
            <div className="flex items-center justify-center gap-3">
              <img src={URL.createObjectURL(form.image)} alt="New category preview" className="h-14 w-14 rounded-md object-cover" />
              <div className="text-left"><p className="text-sm text-primary">{form.image.name}</p><p className="text-xs text-muted-foreground">Optimized automatically</p></div>
            </div>
          ) : isEdit && editCat?.image_url ? (
            <div className="flex items-center justify-center gap-3">
              <CategoryImage url={editCat.image_url} />
              <span className="text-sm text-muted-foreground">Click to replace image</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" /> Upload category image
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setForm((f) => ({ ...f, image: e.target.files?.[0] || null }))} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Large images are resized and saved in a lighter format.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Categories</h2>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
            {renderFormFields()}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={() => addMutation.mutate()} disabled={!form.name.trim() || addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {topLevel.map((cat: any) => {
          const children = getChildren(cat.id);
          const isOpen = expanded[cat.id] ?? false;
          return (
            <div key={cat.id} className="bg-card rounded-lg border border-border overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={() => toggle(cat.id)}>
                <div className="flex items-center gap-3 p-3 group">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CategoryImage url={cat.image_url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{children.length} subcategories · {cat.slug}</p>
                  </div>
                   <div className="flex gap-1 shrink-0">
                     <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Add subcategory to ${cat.name}`} title="Add subcategory" onClick={() => openAddChild(cat.id)}><Plus className="h-3.5 w-3.5" /></Button>
                     <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${cat.name}`} title="Edit category" onClick={() => openEdit(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Delete ${cat.name}`} title="Delete category" onClick={() => setDeleteCat(cat)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="px-3 pb-3">
                    {renderSubcategories(cat.id, 1)}
                    {children.length === 0 && <p className="text-xs text-muted-foreground ml-6 py-2">No subcategories</p>}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
        {topLevel.length === 0 && (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">No categories found</div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editCat} onOpenChange={(o) => { if (!o) { setEditCat(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {renderFormFields(true)}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => editMutation.mutate()} disabled={!form.name.trim() || editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteCat} onOpenChange={(o) => { if (!o) setDeleteCat(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Category</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteCat?.name}</strong>? This will also remove all subcategories.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategories;
