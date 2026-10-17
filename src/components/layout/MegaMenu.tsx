import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, User, Monitor, Shirt, Home, Heart, Dumbbell, Smartphone, BookOpen, Car, Tag, Footprints, Watch, Gem, Luggage, ShoppingBag, Scissors } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LucideIcon } from "lucide-react";

const TOP_LEVEL_ICONS: Record<string, LucideIcon> = {
  electronics: Monitor,
  fashion: Shirt,
  "fashion-clothing": Shirt,
  shoes: Footprints,
  watches: Watch,
  jewelry: Gem,
  "travel-and-luggage": Luggage,
  "bags-and-accessories": ShoppingBag,
  "fabric-and-tailoring": Scissors,
  "home-garden": Home,
  "health-beauty": Heart,
  sports: Dumbbell,
  "phones-tablets": Smartphone,
  automotive: Car,
  books: BookOpen,
};

type CategoryRow = { id: string; name: string; slug: string; parent_id: string | null };

function useCategoryChildren(parentId: string | null, enabled = true) {
  const isRoot = parentId === null;
  return useQuery({
    queryKey: ["sidebar-children", parentId ?? "root"],
    queryFn: async (): Promise<CategoryRow[]> => {
      let q = supabase.from("categories").select("id, name, slug, parent_id").order("name").limit(2000);
      q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
    enabled,
    staleTime: isRoot ? Infinity : 5 * 60 * 1000,
    gcTime: isRoot ? Infinity : 5 * 60 * 1000,
  });
}

interface SidebarMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SidebarMenu = ({ open, onOpenChange }: SidebarMenuProps) => {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const { user, signOut, userRoles } = useAuth();

  const { data: topLevel = [], isLoading } = useCategoryChildren(null);

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0 bg-card overflow-y-auto">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="bg-[hsl(var(--nav-dark))] text-primary-foreground px-5 py-4 flex items-center gap-3">
          <User className="h-6 w-6" />
          <span className="font-semibold text-base">
            {user ? "Hello, welcome back" : "Hello, Sign In"}
          </span>
        </div>

        <div className="py-2">
          <p className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop by Category</p>
          {isLoading && (
            <p className="px-5 py-3 text-sm text-muted-foreground">Loading…</p>
          )}
          {!isLoading && topLevel.length === 0 && (
            <p className="px-5 py-3 text-sm text-muted-foreground">No categories available</p>
          )}
          {topLevel.map((cat) => {
            const Icon = TOP_LEVEL_ICONS[cat.slug] ?? Tag;
            const isOpen = expandedCat === cat.id;
            return (
              <div key={cat.id}>
                <button
                  onClick={() => { setExpandedCat(isOpen ? null : cat.id); setExpandedSub(null); }}
                  className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <span className="flex items-center gap-2.5"><Icon className="h-4 w-4 text-muted-foreground" /> {cat.name}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <SubLevel
                    parent={cat}
                    expandedSub={expandedSub}
                    setExpandedSub={setExpandedSub}
                    onNavigate={close}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border py-2">
          <p className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Help & Settings</p>
          {user ? (
            <>
              <Link to="/account" className="block px-5 py-3 text-sm hover:bg-secondary" onClick={close}>Your Account</Link>
              {userRoles.includes("vendor") && (
                <Link to="/vendor/dashboard" className="block px-5 py-3 text-sm hover:bg-secondary" onClick={close}>Seller Hub</Link>
              )}
              {userRoles.includes("admin") && (
                <Link to="/admin" className="block px-5 py-3 text-sm hover:bg-secondary" onClick={close}>Admin Dashboard</Link>
              )}
              <button onClick={() => { signOut(); close(); }} className="block w-full text-left px-5 py-3 text-sm text-destructive hover:bg-secondary">Sign Out</button>
            </>
          ) : (
            <Link to="/auth" className="block px-5 py-3 text-sm font-medium text-primary hover:bg-secondary" onClick={close}>Sign In / Register</Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SubLevel = ({
  parent,
  expandedSub,
  setExpandedSub,
  onNavigate,
}: {
  parent: CategoryRow;
  expandedSub: string | null;
  setExpandedSub: (id: string | null) => void;
  onNavigate: () => void;
}) => {
  const { data: subs = [], isLoading } = useCategoryChildren(parent.id);

  if (isLoading) return <div className="bg-secondary/50 px-10 py-2 text-xs text-muted-foreground">Loading…</div>;

  if (subs.length === 0) {
    // No children — provide direct link to the top-level category
    return (
      <div className="bg-secondary/50">
        <Link
          to={`/search?category=${parent.slug}`}
          className="block pl-10 pr-5 py-2.5 text-sm hover:bg-secondary transition-colors"
          onClick={onNavigate}
        >
          Browse all {parent.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-secondary/50">
      {subs.map((sub) => {
        const isOpen = expandedSub === sub.id;
        return (
          <div key={sub.id}>
            <button
              onClick={() => setExpandedSub(isOpen ? null : sub.id)}
              className="w-full flex items-center justify-between pl-10 pr-5 py-2.5 text-sm hover:bg-secondary transition-colors"
            >
              <span>{sub.name}</span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && <LeafLevel parent={sub} onNavigate={onNavigate} />}
          </div>
        );
      })}
    </div>
  );
};

const LeafLevel = ({ parent, onNavigate }: { parent: CategoryRow; onNavigate: () => void }) => {
  const { data: children = [], isLoading } = useCategoryChildren(parent.id);

  if (isLoading) return <div className="bg-secondary/80 pl-14 py-2 text-xs text-muted-foreground">Loading…</div>;

  if (children.length === 0) {
    return (
      <div className="bg-secondary/80">
        <Link
          to={`/search?category=${parent.slug}`}
          className="block pl-14 pr-5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          onClick={onNavigate}
        >
          Browse all {parent.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-secondary/80">
      {children.map((child) => (
        <Link
          key={child.id}
          to={`/search?category=${child.slug}`}
          className="block pl-14 pr-5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          onClick={onNavigate}
        >
          {child.name}
        </Link>
      ))}
    </div>
  );
};

export default SidebarMenu;

export const MobileMegaMenu = ({ onNavigate }: { onNavigate?: () => void }) => null;
