import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SELLER_POLICY_CODES = ["seller_terms","commission_payout","shipping_fulfillment","returns_refunds","prohibited_products","product_authenticity"] as const;
const fallback: Record<string,string> = {
 seller_terms:"Barakaz Seller Terms & Conditions", commission_payout:"Commission & Payout Terms",
 shipping_fulfillment:"Shipping & Fulfillment Policy", returns_refunds:"Returns & Refunds Policy",
 prohibited_products:"Prohibited Products Policy", product_authenticity:"Product Authenticity and Legal-Sale Confirmation",
};
type Policy={policy_code:string;policy_version:string;title:string;document_url:string};
export default function SellerAgreements({ rulesVersion, accepted, onChange }: { rulesVersion: string | null; accepted: string[]; onChange: (codes: string[]) => void }) {
 const [policies,setPolicies]=useState<Policy[]>([]);
 useEffect(()=>{ if(!rulesVersion){setPolicies([]);return;} void supabase.from("seller_policy_documents").select("policy_code,policy_version,title,document_url").eq("policy_version",rulesVersion).not("published_at","is",null).then(({data})=>setPolicies((data||[]) as Policy[])); },[rulesVersion]);
 const allPublished=SELLER_POLICY_CODES.every(code=>policies.some(p=>p.policy_code===code));
 return <div className="space-y-3">
  {!rulesVersion && <Alert><AlertDescription>Agreement documents become available only after your country and seller type have verified onboarding rules.</AlertDescription></Alert>}
  {rulesVersion && !allPublished && <Alert><AlertDescription>Seller agreements for this location are not fully published yet. You can save your draft, but submission remains closed.</AlertDescription></Alert>}
  {SELLER_POLICY_CODES.map(code=>{const policy=policies.find(p=>p.policy_code===code);return <label key={code} className="flex items-start gap-3 rounded-lg border p-4">
   <Checkbox disabled={!policy} checked={accepted.includes(code)} onCheckedChange={checked=>onChange(checked?[...accepted,code]:accepted.filter(x=>x!==code))}/>
   <span className="text-sm leading-5"><span className="font-medium">I have read and accept {policy?.title||fallback[code]}.</span>
    {policy&&<a className="ml-2 inline-flex items-center text-primary hover:underline" href={policy.document_url} target="_blank" rel="noopener noreferrer">Read policy <ExternalLink className="ml-1 h-3 w-3"/></a>}
   </span>
  </label>})}
 </div>;
}
