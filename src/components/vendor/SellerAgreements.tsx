import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Lightbulb, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SELLER_POLICY_CODES = ["seller_terms","commission_payout","shipping_fulfillment","returns_refunds","prohibited_products","product_authenticity"] as const;
const fallback: Record<string,string> = {
 seller_terms:"Barakaz Seller Agreement", commission_payout:"Commission & Payout Terms",
 shipping_fulfillment:"Shipping Policy", returns_refunds:"Return & Refund Policy",
 prohibited_products:"Prohibited Products Policy", product_authenticity:"Product Authenticity & Legal Sale",
};
const descriptions:Record<string,string>={
 seller_terms:"Rules and responsibilities for selling on Barakaz.",
 commission_payout:"Commission charges, earnings and payout conditions.",
 shipping_fulfillment:"Shipping requirements and delivery expectations.",
 returns_refunds:"Rules for returns, refunds and dispute resolution.",
 prohibited_products:"Products that are not allowed on Barakaz.",
 product_authenticity:"Confirm that your products are authentic and legally offered for sale.",
};
type Policy={policy_code:string;policy_version:string;title:string;document_url:string};
export default function SellerAgreements({ rulesVersion, accepted, onChange }: { rulesVersion: string | null; accepted: string[]; onChange: (codes: string[]) => void }) {
 const [policies,setPolicies]=useState<Policy[]>([]);
 const [loadError,setLoadError]=useState(false);
 useEffect(()=>{let active=true;if(!rulesVersion){setPolicies([]);setLoadError(false);return;}void supabase.from("seller_policy_documents").select("policy_code,policy_version,title,document_url").eq("policy_version",rulesVersion).not("published_at","is",null).then(({data,error})=>{if(!active)return;setPolicies((data||[]) as Policy[]);setLoadError(Boolean(error));});return()=>{active=false;};},[rulesVersion]);
 const allPublished=SELLER_POLICY_CODES.every(code=>policies.some(p=>p.policy_code===code));
 return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
  <div className="space-y-4">
   <div><h3 className="text-xl font-extrabold text-[#08143f]">Required Agreements <span className="text-orange-600">*</span></h3><p className="mt-1 text-sm text-slate-600">Please read each policy carefully and agree to continue.</p></div>
   {!rulesVersion&&<Alert><AlertDescription>Agreement documents become available after country and business-type onboarding rules are verified.</AlertDescription></Alert>}
   {loadError&&<Alert><AlertDescription>Policy documents could not be loaded. Please try again later.</AlertDescription></Alert>}
   {rulesVersion&&!allPublished&&<Alert><AlertDescription>Some required agreements have not been published for this seller type and location. You may save your draft, but cannot submit until they are available.</AlertDescription></Alert>}
   <div className="space-y-3">{SELLER_POLICY_CODES.map(code=>{const policy=policies.find(p=>p.policy_code===code);return <div key={code} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
    <Checkbox aria-label={`Accept ${policy?.title||fallback[code]}`} disabled={!policy} checked={Boolean(policy&&accepted.includes(code))} onCheckedChange={checked=>onChange(checked===true?[...accepted.filter(x=>x!==code),code]:accepted.filter(x=>x!==code))} className="h-5 w-5 shrink-0 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"/>
    <FileText className="h-8 w-8 shrink-0 text-[#233d80]"/>
    <div className="min-w-0 flex-1"><h4 className="text-sm font-bold text-[#08143f]">{policy?.title||fallback[code]} <span className="text-orange-600">*</span></h4><p className="mt-1 text-xs text-slate-500">{descriptions[code]}</p></div>
    {policy?.document_url?<a className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:underline sm:text-sm" href={policy.document_url} target="_blank" rel="noopener noreferrer">View Document <ArrowRight className="h-4 w-4"/></a>:<span className="text-xs text-slate-400">Unavailable</span>}
   </div>;})}</div>
   <p className="text-xs text-slate-500">Optional marketing and data-sharing consent will appear only when Barakaz publishes separate consent documents and supports recording those choices. Required agreements cannot be treated as optional.</p>
  </div>
  <aside className="space-y-5">
   <div className="rounded-xl bg-blue-50 p-5"><h3 className="flex items-center gap-3 text-lg font-bold text-[#08143f]"><ShieldCheck className="h-8 w-8 text-blue-600"/> Key Points</h3><div className="mt-5 space-y-4">{["Fair and transparent marketplace rules","Safe and secure transactions","Clear shipping and return policies","Protection for buyers and sellers","Global selling subject to eligibility"].map(item=><p key={item} className="flex items-start gap-3 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-green-600"/>{item}</p>)}</div></div>
   <div className="rounded-xl bg-amber-50 p-5"><h3 className="flex items-center gap-3 text-lg font-bold text-[#08143f]"><Lightbulb className="h-8 w-8 text-amber-500"/> Please Note</h3><p className="mt-4 text-sm leading-relaxed text-slate-700">Please read each policy before accepting. Checking the boxes confirms your agreement to comply with the published Barakaz seller policies and terms.</p></div>
  </aside>
 </div>;
}
