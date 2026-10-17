import { useEffect } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { VendorSidebar } from "./VendorSidebar";
import { Button } from "@/components/ui/button";
import { Store, ExternalLink } from "lucide-react";

const VendorLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: vendor, isLoading: vendorLoading, error: vendorError, refetch } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("vendors").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // payment_details and warehouse_address are restricted at the column level;
      // fetch them via the owner-scoped SECURITY DEFINER RPC.
      const { data: priv, error: privateFieldsError } = await supabase.rpc("get_vendor_private_fields_v2", {
        _vendor_id: data.id,
      });
      if (privateFieldsError) throw privateFieldsError;
      const privRow = Array.isArray(priv) ? priv[0] : null;
      return {
        ...data,
        payment_details: privRow?.payment_details ?? {},
        warehouse_address: privRow?.warehouse_address ?? {},
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user || vendorLoading) return null;

  if (vendorError) return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center"><p>Your store could not be loaded. Your saved settings have not been changed.</p><Button onClick={()=>void refetch()}>Try again</Button></div>;

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--vendor-surface))]">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No vendor account yet</h2>
            <p className="text-sm text-muted-foreground">Set up your storefront to start selling on Barakaz.</p>
          </div>
          <Link to="/vendor/register"><Button>Register as Vendor</Button></Link>
        </div>
      </div>
    );
  }

  const statusStyles =
    vendor.status === "approved"
      ? "bg-success/10 text-success border-success/20"
      : vendor.status === "pending"
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-destructive/10 text-destructive border-destructive/20";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[hsl(var(--vendor-surface))]">
        <VendorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 gap-3 bg-card sticky top-0 z-20">
            <SidebarTrigger />
            <div className="flex items-center gap-2 min-w-0">
              <Store className="h-4 w-4 text-primary shrink-0" />
              <h1 className="font-display text-base font-semibold truncate">{vendor.store_name}</h1>
              <span className={`status-pill border ${statusStyles} capitalize`}>{vendor.status}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {vendor.slug && vendor.status === "approved" && (
                <Link to={`/store/${vendor.slug}`} target="_blank">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> View store
                  </Button>
                </Link>
              )}
            </div>
          </header>
          {vendor.status !== "approved" && location.pathname !== "/vendor/settings" && (
            <Link to="/vendor/settings" className="block bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium">
              {vendor.submitted_for_review_at && vendor.status === "pending"
                ? "Your application is under review. We'll email you once approved."
                : "Finish your store setup to proceed → Store Settings"}
            </Link>
          )}
          <main key={location.pathname} className="flex-1 p-4 md:p-6 overflow-auto animate-fade-in">
            <Outlet context={{ vendor }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default VendorLayout;
