import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { missingVendorProfileItems } from "@/lib/vendorProfileCompleteness";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { settingsRecord } from "@/lib/vendorSettingsPersistence";

const VendorProfileChecklist = ({ vendor, showLink = true }: { vendor: any; showLink?: boolean }) => {
  const { data: preferences, isLoading, error, refetch } = useQuery({
    queryKey: ["vendor-settings-preferences", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_settings_preferences").select("section,settings").eq("vendor_id", vendor.id);
      if (error) throw error;
      return Object.fromEntries((data || []).map(row => [row.section, settingsRecord(row.settings)]));
    },
  });
  if (isLoading) return null;
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><p>Profile completion could not be checked.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div>;
  const missing = missingVendorProfileItems(vendor, preferences?.payouts);
  if (missing.length === 0) return null;
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4 text-primary" />
        Complete your seller profile ({missing.length} missing)
      </div>
      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
        {missing.map((m) => <li key={m}>{m}</li>)}
      </ul>
      {showLink && (
        <Button asChild size="sm"><Link to="/vendor/settings">Update details</Link></Button>
      )}
    </div>
  );
};

export default VendorProfileChecklist;
