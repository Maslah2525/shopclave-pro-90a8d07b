import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, addressFormat, countryByName } from "@/lib/countries";
import { customerDetailsError, customerDetailsParams, detailsFromSaved, type CustomerDetails } from "@/lib/customerDetails";

export default function CustomerDetailsForm({ userId, email }: { userId: string; email: string }) {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<CustomerDetails>({ fullName: "", phone: "", addressLine: "", city: "", country: "Canada", state: "", zip: "" });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-details", userId],
    queryFn: async () => {
      const [profile, address] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("user_id", userId).maybeSingle(),
        supabase.from("addresses").select("*").eq("user_id", userId).eq("is_default", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (address.error) throw address.error;
      return { profile: profile.data, address: address.data };
    },
  });
  useEffect(() => {
    if (!data || dirty) return;
    if (data.address) setDetails(detailsFromSaved(data.address));
    else setDetails(prev => ({ ...prev, fullName: data.profile?.full_name ?? "", phone: data.profile?.phone ?? "" }));
  }, [data, dirty]);
  const update = (field: keyof CustomerDetails, value: string) => { setDirty(true); setDetails(prev => ({ ...prev, [field]: value })); };
  const format = addressFormat(countryByName(details.country)?.code ?? "");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = customerDetailsError(details);
    if (validation) { toast.error(validation); return; }
    setSaving(true);
    try {
      const { data: saved, error } = await supabase.rpc("save_customer_details", customerDetailsParams(details));
      if (error) throw error;
      if (!saved) throw new Error("Your details could not be saved. Please try again.");
      setDetails(detailsFromSaved(saved));
      setDirty(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["customer-details", userId] }), queryClient.invalidateQueries({ queryKey: ["user-address", userId] }), queryClient.invalidateQueries({ queryKey: ["profile", userId] })]);
      toast.success("Profile and delivery address saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save your details"); }
    finally { setSaving(false); }
  };
  if (isLoading) return <p className="mb-6 text-muted-foreground">Loading your details…</p>;
  if (isError) return <div role="alert" className="mb-6 space-y-2"><p>Unable to load your details.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>;
  return <section className="mb-8 border-b border-border pb-6">
    <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><User className="h-5 w-5" /> Profile & delivery address</h2>
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="customer-name">Full name</Label><Input id="customer-name" autoComplete="name" value={details.fullName} onChange={e => update("fullName", e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="customer-phone">Telephone</Label><Input id="customer-phone" type="tel" autoComplete="tel" value={details.phone} onChange={e => update("phone", e.target.value)} required /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="customer-email">Account email</Label><Input id="customer-email" type="email" value={email} readOnly /></div>
      <div className="space-y-1"><Label htmlFor="customer-address">Street address / apartment</Label><Input id="customer-address" autoComplete="street-address" value={details.addressLine} onChange={e => update("addressLine", e.target.value)} required /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="customer-city">City</Label><Input id="customer-city" autoComplete="address-level2" value={details.city} onChange={e => update("city", e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="customer-country">Country</Label><Select value={details.country} onValueChange={value => { setDirty(true); setDetails(prev => ({ ...prev, country: value, state: "", zip: "" })); }}><SelectTrigger id="customer-country"><SelectValue /></SelectTrigger><SelectContent><Input aria-label="Search countries" placeholder="Search countries" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} onKeyDown={e => e.stopPropagation()} />{COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="customer-state">{format.regionLabel}</Label><Input id="customer-state" autoComplete="address-level1" value={details.state} onChange={e => update("state", e.target.value)} required={countryByName(details.country)?.code === "CA"} /></div>
        <div className="space-y-1"><Label htmlFor="customer-postal">{format.postalLabel}</Label><Input id="customer-postal" autoComplete="postal-code" value={details.zip} onChange={e => update("zip", e.target.value)} required={format.postalRequired} /></div>
      </div>
      <Button type="submit" disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save profile & address"}</Button>
    </form>
  </section>;
}