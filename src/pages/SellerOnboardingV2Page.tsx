import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, Clock3, CreditCard, FileCheck2, Loader2, Save, Send, ShieldCheck, Store, User, UserRound, BriefcaseBusiness, Pencil, ClipboardCheck, FileText, CheckCircle2 } from "lucide-react";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import CountrySelector from "@/components/vendor/CountrySelector";
import StoreCategoryFields from "@/components/vendor/StoreCategoryFields";
import StoreLogoUpload from "@/components/vendor/StoreLogoUpload";
import SellerKycUpload from "@/components/vendor/SellerKycUpload";
import SellerAgreements, { SELLER_POLICY_CODES } from "@/components/vendor/SellerAgreements";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { countryByCode } from "@/lib/countries";
import { INITIAL_SELLER_DRAFT, SellerDraft, validateSellerStep } from "@/lib/sellerOnboarding";
import { cn } from "@/lib/utils";
import { sellerRequiredAddressFields, type SellerCountryRule } from "@/lib/sellerCountryPolicy";
import { toast } from "sonner";

const STEPS = ["Account Information", "Business Information", "Verification (KYC)", "Store Setup", "Payments & Payouts", "Policies & Agreements", "Review & Submit"];
const STEP_TITLES = ["Create Your Account", "Business Information", "Verification (KYC)", "Store Setup", "Payments & Payouts", "Policies & Agreements", "Review & Submit"];
const STEP_ICONS = [User, Building2, ShieldCheck, Store, CreditCard, FileCheck2, Send];
type AppRow = { id:string; status:string; current_step:number; country:string|null; business_type:string|null; business_info:Record<string,unknown>; store_info:Record<string,unknown>; kyc_status:string; rules_version:string|null; review_reason:string|null; submitted_at:string|null };
type ConditionalRequirement={when_field:string;equals:boolean;required_fields?:string[];required_documents?:string[]};
type Rule = { rules_version:string; required_documents:string[]; required_fields:string[]; conditional_requirements?:ConditionalRequirement[]; stripe_connect_enabled:boolean; reviewed_at:string|null };
type DocumentRow = { id:string; requirement_code:string; verification_status:string };
type PayoutRow = { provider_account_id:string|null; verification_status:string; payouts_enabled:boolean };

const friendlyError = (message:string) => {
 const lower=message.toLowerCase();
 if(lower.includes("not yet open")||lower.includes("not enabled")) return "Applications are not yet open for this country and seller type. Your draft is safe.";
 if(lower.includes("agreement")) return "Review and accept every published seller agreement before submitting.";
 if(lower.includes("payout")) return "Complete the payout setup step before submitting.";
 if(lower.includes("document")) return "Upload every required verification document before submitting.";
 if(lower.includes("jwt")||lower.includes("authentication")) return "Your session expired. Sign in again, then continue your saved application.";
 return message;
};

export default function SellerOnboardingV2Page(){
 const {user,loading:authLoading}=useAuth();
 const navigate=useNavigate();
 const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
 const [step,setStep]=useState(1); const [draft,setDraft]=useState<SellerDraft>(INITIAL_SELLER_DRAFT);
 const [businessTypeSelection,setBusinessTypeSelection]=useState<string>("");
 const unsupportedBusinessType=["partnership","other"].includes(businessTypeSelection);
 const [application,setApplication]=useState<AppRow|null>(null); const [rule,setRule]=useState<Rule|null>(null);
 const [documents,setDocuments]=useState<DocumentRow[]>([]); const [payout,setPayout]=useState<PayoutRow|null>(null);
 const [accepted,setAccepted]=useState<string[]>([]); const [reviewConfirmed,setReviewConfirmed]=useState(false);
 const editable=!application||["draft","more_information_required"].includes(application.status);
 const requiredAddressFields=sellerRequiredAddressFields(draft.country||"CA");
 const set=(key:keyof SellerDraft,value:SellerDraft[keyof SellerDraft])=>setDraft(current=>({...current,[key]:value}));

 const refreshRelated=useCallback(async(app:AppRow|null)=>{
  if(!app){setDocuments([]);setPayout(null);setAccepted([]);return;}
  const [docsResult,payoutResult,agreementsResult]=await Promise.all([
   supabase.from("seller_verification_documents").select("id,requirement_code,verification_status").eq("application_id",app.id),
   supabase.from("seller_payout_accounts").select("provider_account_id,verification_status,payouts_enabled").eq("application_id",app.id).eq("provider","stripe").maybeSingle(),
   supabase.from("seller_agreement_acceptances").select("policy_code").eq("application_id",app.id),
  ]);
  setDocuments((docsResult.data||[]) as DocumentRow[]); setPayout((payoutResult.data||null) as PayoutRow|null); setAccepted((agreementsResult.data||[]).map(x=>x.policy_code));
 },[]);

 useEffect(()=>{ if(authLoading)return; if(!user){navigate("/auth",{replace:true,state:{from:"/vendor/register"}});return;}
  void (async()=>{setLoading(true);
   const [appResult,profileResult,vendorResult]=await Promise.all([
    supabase.from("seller_applications").select("*").eq("user_id",user.id).maybeSingle(),
    supabase.from("profiles").select("full_name,phone").eq("user_id",user.id).maybeSingle(),
    supabase.from("vendors").select("status").eq("user_id",user.id).maybeSingle(),
   ]);
   if(vendorResult.data?.status==="approved"){navigate("/vendor/dashboard",{replace:true});return;}
   const app=(appResult.data||null) as AppRow|null; const business=app?.business_info||{}; const store=app?.store_info||{};
   setApplication(app); setStep(Math.min(7,Math.max(1,app?.current_step||1)));
   setDraft({...INITIAL_SELLER_DRAFT,
    full_name:String(business.full_name||profileResult.data?.full_name||user.user_metadata?.full_name||""), phone:String(business.phone||profileResult.data?.phone||""),
    country:app?.country||"CA", business_type:(app?.business_type||"") as SellerDraft["business_type"], legal_name:String(business.legal_name||""),
    registration_number:String(business.registration_number||""), tax_identifier:String(business.tax_identifier||""), address_line1:String(business.address_line1||""), address_line2:String(business.address_line2||""), city:String(business.city||""), region:String(business.region||""), postal_code:String(business.postal_code||""), is_business_registered:business.is_business_registered===true, address:String(business.address||""), category:String(business.category||""),
    store_name:String(store.store_name||""), store_description:String(store.store_description||""), logo_url:String(store.logo_url||""),
    product_categories:Array.isArray(store.product_categories)?store.product_categories.map(String):[], ship_from:String(store.ship_from||""), return_address:String(store.return_address||""),
   });
   await refreshRelated(app); setLoading(false);
  })();
 },[authLoading,user,navigate,refreshRelated]);

 useEffect(()=>{ if(!draft.country||!draft.business_type){setRule(null);return;}
  void supabase.from("seller_country_requirements").select("rules_version,required_documents,required_fields,conditional_requirements,stripe_connect_enabled,reviewed_at").eq("country",draft.country).eq("business_type",draft.business_type).order("reviewed_at",{ascending:false,nullsFirst:false}).limit(1).maybeSingle().then(({data})=>setRule((data||null) as Rule|null));
 },[draft.country,draft.business_type]);

 const save=async(targetStep=step,quiet=false)=>{
  if(!user)return null; if(unsupportedBusinessType){toast.error("Partnership and Other require backend registration support before saving. No business type has been submitted.");return null;} setBusy(true);
  const {data,error}=await supabase.rpc("save_seller_application_draft",{p_current_step:targetStep,p_country:draft.country||null,p_business_type:draft.business_type||null,
   p_business_info:{full_name:draft.full_name.trim(),phone:draft.phone.trim(),legal_name:draft.legal_name.trim(),registration_number:draft.registration_number.trim(),tax_identifier:draft.tax_identifier.trim(),address_line1:draft.address_line1.trim(),address_line2:draft.address_line2.trim(),city:draft.city.trim(),region:draft.region.trim(),postal_code:draft.postal_code.trim(),is_business_registered:draft.is_business_registered,address:[draft.address_line1,draft.address_line2,draft.city,draft.region,draft.postal_code,draft.address].map(x=>x.trim()).filter(Boolean).join(", "),category:draft.category.trim()},
   p_store_info:{store_name:draft.store_name.trim(),store_description:draft.store_description.trim(),logo_url:draft.logo_url,product_categories:draft.product_categories,ship_from:draft.ship_from.trim(),return_address:draft.return_address.trim()}});
  setBusy(false); if(error){toast.error(friendlyError(error.message));return null;} const app=data as unknown as AppRow;setApplication(app); if(!quiet)toast.success("Draft saved");return app;
 };
 const ruleEnabled=Boolean(rule?.stripe_connect_enabled&&rule?.reviewed_at);
 const effectiveDocuments=useMemo(()=>{
  const codes=new Set(rule?.required_documents||[]);
  for(const condition of rule?.conditional_requirements||[]){
   if(condition.when_field!=="is_business_registered"||typeof condition.equals!=="boolean") continue;
   if(draft.is_business_registered===condition.equals) for(const code of condition.required_documents||[]) if(typeof code==="string") codes.add(code);
  }
  return [...codes];
 },[rule,draft.is_business_registered]);
 const sellerCountryRule: SellerCountryRule | null = rule && draft.business_type ? { country:draft.country, businessType:draft.business_type, requiredFields:rule.required_fields || [], requiredDocuments:rule.required_documents || [], reviewedAt:rule.reviewed_at, providerOnboardingEnabled:rule.stripe_connect_enabled } : null;
 const next=async()=>{
  if(unsupportedBusinessType){toast.error("This business type is not yet supported by seller registration. Please select a supported type or wait for backend support.");return;}
  const validation=validateSellerStep(step,draft,sellerCountryRule); if(validation){toast.error(validation);return;}
  if(step===3&&rule&&effectiveDocuments.length>0&&!effectiveDocuments.every(code=>documents.some(d=>d.requirement_code===code))){toast.error("Upload each required verification document before continuing.");return;}
  if(step===5&&rule&&!payout?.provider_account_id){toast.error("Start secure payout onboarding before continuing.");return;}
  if(step===6&&rule){if(!SELLER_POLICY_CODES.every(code=>accepted.includes(code))){toast.error("Accept all six published seller agreements before continuing.");return;} const {error}=await supabase.rpc("accept_seller_agreements",{p_codes:[...SELLER_POLICY_CODES]});if(error){toast.error(friendlyError(error.message));return;}}
  const nextStep=Math.min(7,step+1); const app=await save(nextStep,true);if(app)setStep(nextStep);
 };
 const connectStripe=async()=>{
  const app=application||await save(5,true); if(!app)return;
  setBusy(true);const {data,error}=await supabase.functions.invoke("seller-stripe-connect");setBusy(false);
  if(error||!data?.url){toast.error(data?.error||"Secure payout onboarding is not available yet.");return;}
  try{const url=new URL(data.url);if(url.protocol!=="https:"||!url.hostname.endsWith("stripe.com")){throw new Error();}window.location.assign(url.toString());}catch{toast.error("Stripe returned an invalid onboarding link.");}
 };
 const submit=async()=>{if(!SELLER_POLICY_CODES.every(code=>accepted.includes(code))){toast.error("Accept all required agreements before submitting.");return;}if(!payout?.provider_account_id){toast.error("Connect your payout account before submitting.");return;}if(!reviewConfirmed){toast.error("Confirm the accuracy of your application before submitting.");return;}if(unsupportedBusinessType){toast.error("This business type cannot be submitted until backend support is added.");return;}const validation=[1,2,4].map(s=>validateSellerStep(s,draft,sellerCountryRule)).find(Boolean);if(validation){toast.error(validation);return;}setBusy(true);const {data,error}=await supabase.rpc("submit_seller_application");setBusy(false);if(error){toast.error(friendlyError(error.message));return;}setApplication(data as unknown as AppRow);toast.success("Application submitted for review");window.scrollTo({top:0,behavior:"smooth"});};

 if(authLoading||loading)return <MarketplaceLayout><div className="container flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div></MarketplaceLayout>;
 if(!user)return null;
 if(application&&!editable)return <MarketplaceLayout><div className="container max-w-2xl py-12"><Card><CardHeader className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Clock3 className="h-7 w-7 text-primary"/></div><CardTitle>Application {application.status.replace(/_/g," ")}</CardTitle><CardDescription>Your seller approval and payout verification are tracked separately.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2"><Status label="Application" value={application.status}/><Status label="Identity verification" value={application.kyc_status}/><Status label="Payout setup" value={payout?.verification_status||"not started"}/><Status label="Submitted" value={application.submitted_at?new Date(application.submitted_at).toLocaleDateString():"—"}/></div>{application.review_reason&&<Alert><AlertTitle>Review note</AlertTitle><AlertDescription>{application.review_reason}</AlertDescription></Alert>}<div className="flex justify-center"><Button asChild variant="outline"><Link to="/account">Go to my account</Link></Button></div></CardContent></Card></div></MarketplaceLayout>;

 return <MarketplaceLayout><div className="mx-auto max-w-[1200px] px-5 py-8 md:px-7 md:py-10">
  <header className="mb-6"><h1 className="text-3xl font-extrabold tracking-tight text-[#08143f] md:text-[42px]">Become a Seller on Barakaz</h1><p className="mt-1 text-lg text-[#536895]">{step===7?"Review your information and submit your application.":"Create your seller account in a few simple steps."}</p></header>
  {application?.status==="more_information_required"&&<Alert className="mb-6"><AlertTitle>More information required</AlertTitle><AlertDescription>{application.review_reason||"Review your application, update the requested information, and submit it again."}</AlertDescription></Alert>}
  <nav aria-label="Seller registration progress" className="mb-7"><ol className="grid grid-cols-7 gap-1 md:gap-2">{["Account Information","Business Information","Verification (KYC)","Store Setup","Payments & Payouts","Policies & Agreements","Review & Submit"].map((name,index)=>{const number=index+1;const reached=Math.max(step,application?.current_step||1);const completed=number<step;const current=number===step;return <li key={name} className="relative flex min-w-0 flex-col items-center text-center">{index>0&&<span aria-hidden className={cn("absolute right-1/2 top-[18px] h-[2px] w-full md:top-7",number<=step?"bg-[#ff4d0b]":"bg-slate-200")}/>}<button type="button" disabled={busy||number>reached} aria-current={current?"step":undefined} onClick={()=>setStep(number)} className={cn("relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-bold md:h-14 md:w-14 md:text-xl",number<=step?"border-[#ff4d0b] bg-[#ff4d0b] text-white":"border-slate-200 bg-white text-[#08143f]")}>{completed?<Check className="h-6 w-6"/>:number}</button><span className={cn("mt-2 max-w-[120px] text-[10px] leading-tight md:text-sm",current?"font-extrabold text-[#08143f]":"text-[#536895]")}>{name}</span></li>})}</ol></nav>
  <Card className="border-slate-200 shadow-sm"><CardHeader className="flex-row items-center gap-4 space-y-0"><div className="hidden"/><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50">{(()=>{const Icon=STEP_ICONS[step-1];return <Icon className="h-6 w-6 text-primary"/>;})()}</div><div><CardTitle className="text-2xl font-extrabold text-[#08143f] md:text-3xl">{step}. {STEP_TITLES[step-1]}</CardTitle><CardDescription className="mt-1">{STEP_DESCRIPTIONS[step-1]}</CardDescription></div></CardHeader><CardContent className="space-y-5">
   {step===1&&<><Field label="Full legal name" required><Input value={draft.full_name} onChange={e=>set("full_name",e.target.value)} autoComplete="name"/></Field><Field label="Account email"><Input value={user.email||""} disabled/><p className="text-xs text-muted-foreground">Email and password are managed in your Barakaz account.</p></Field><Field label="Phone number" required><Input value={draft.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 416 555 0123" inputMode="tel" autoComplete="tel"/><p className="text-xs text-muted-foreground">Include the country calling code.</p></Field></>}
   {step===2&&<><Field label="Country" required><CountrySelector value={draft.country} onChange={value=>{setDraft(d=>({...d,country:value}));setAccepted([]);}}/></Field><Field label="Business Type" required><Select value={businessTypeSelection||draft.business_type} onValueChange={value=>{setBusinessTypeSelection(value);setDraft(d=>({...d,business_type:value==="partnership"||value==="other"?"":value as SellerDraft["business_type"]}));setAccepted([]);}}><SelectTrigger><SelectValue placeholder="Choose business type"/></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="sole_proprietor">Sole Proprietorship</SelectItem><SelectItem value="company">Corporation</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>{unsupportedBusinessType&&<p className="mt-2 text-sm text-amber-700" role="status">This business type is available for selection, but seller registration cannot save or submit it until the backend supports it.</p>}</Field><div className="grid gap-5 md:grid-cols-2"><Field label="Legal business name" required><Input value={draft.legal_name} onChange={e=>set("legal_name",e.target.value)}/></Field><Field label="Registration / business number" required={draft.business_type==="company"||(draft.business_type==="sole_proprietor"&&draft.is_business_registered)}><Input value={draft.registration_number} onChange={e=>set("registration_number",e.target.value)} disabled={draft.business_type==="individual"||(draft.business_type==="sole_proprietor"&&!draft.is_business_registered)}/></Field></div>{draft.business_type==="sole_proprietor"&&<div className="flex items-start gap-3 rounded-lg border p-4"><Checkbox id="business-registered" checked={draft.is_business_registered} onCheckedChange={checked=>setDraft(d=>({...d,is_business_registered:checked===true,registration_number:checked===true?d.registration_number:""}))}/><div><Label htmlFor="business-registered">This sole proprietorship is registered</Label><p className="text-xs text-muted-foreground">Select this only if the business has been formally registered. Registration evidence will then be required.</p></div></div>}<div className="grid gap-4 md:grid-cols-2"><Field label="Registered street address" required><Input value={draft.address_line1} onChange={e=>set("address_line1",e.target.value)} autoComplete="address-line1"/></Field><Field label="Address line 2"><Input value={draft.address_line2} onChange={e=>set("address_line2",e.target.value)} autoComplete="address-line2"/></Field><Field label="City" required><Input value={draft.city} onChange={e=>set("city",e.target.value)} autoComplete="address-level2"/></Field><Field label="State / province / region" required={requiredAddressFields.includes("region")}><Input value={draft.region} onChange={e=>set("region",e.target.value)} autoComplete="address-level1"/></Field><Field label="Postal / ZIP code" required={requiredAddressFields.includes("postal_code")}><Input value={draft.postal_code} onChange={e=>set("postal_code",e.target.value)} autoComplete="postal-code"/></Field><Field label="Tax identification / VAT / GST number (if applicable)"><Input value={draft.tax_identifier} onChange={e=>set("tax_identifier",e.target.value)}/></Field></div><Field label="Additional registered address details"><Textarea value={draft.address} onChange={e=>set("address",e.target.value)} placeholder="Building, district or other address details"/></Field><Field label="Business category" required><Input value={draft.category} onChange={e=>set("category",e.target.value)} placeholder="Describe the main type of products you sell"/></Field>{draft.country&&draft.business_type&&!rule&&<Alert><AlertTitle>Drafts are welcome worldwide</AlertTitle><AlertDescription>Applications from {countryByCode(draft.country)?.name||draft.country} are not open for final submission until Barakaz verifies local KYC, payout, tax, and compliance requirements.</AlertDescription></Alert>}</>}
   {step===3&&application?<SellerKycUpload applicationId={application.id} userId={user.id} requirements={effectiveDocuments} documents={documents} rulesAvailable={Boolean(rule)} onChanged={()=>refreshRelated(application)}/>:step===3&&<Alert><AlertDescription>Save the previous steps to create your secure document area.</AlertDescription></Alert>}
   {step===4&&<><StoreLogoUpload userId={user.id} value={draft.logo_url} onChange={value=>set("logo_url",value)}/><Field label="Store name" required><Input value={draft.store_name} onChange={e=>set("store_name",e.target.value)}/></Field><Field label="Store description" required><Textarea value={draft.store_description} onChange={e=>set("store_description",e.target.value)} placeholder="Tell customers what your store offers"/></Field><Field label="Product categories" required><StoreCategoryFields value={draft.product_categories} onChange={value=>set("product_categories",value)}/></Field><Field label="Ship-from address" required><Textarea value={draft.ship_from} onChange={e=>set("ship_from",e.target.value)} placeholder="Complete physical dispatch address"/></Field><Field label="Return address" required><Textarea value={draft.return_address} onChange={e=>set("return_address",e.target.value)} placeholder="Complete address for eligible returns"/></Field><Alert><AlertDescription>Use real operational addresses. Barakaz will not invent or substitute warehouse, customs, or carrier details.</AlertDescription></Alert></>}
   {step===5&&<div className="space-y-5"><div className="rounded-xl border p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-primary"/><div><h3 className="font-semibold">Secure payout onboarding</h3><p className="mt-1 text-sm text-muted-foreground">Connect a supported Stripe account where verified for your country. Payout verification remains separate from seller approval.</p></div></div><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" disabled={busy||!ruleEnabled} onClick={()=>void connectStripe()}>{payout?.provider_account_id?"Continue Stripe setup":"Connect with Stripe"}</Button><Badge variant="outline">{payout?.verification_status?.replace(/_/g," ")||"not started"}</Badge></div></div>{!rule&&<Alert><AlertDescription>Payout onboarding is unavailable until Barakaz verifies support for this country and seller type.</AlertDescription></Alert>}</div>}
   {step===6&&<SellerAgreements rulesVersion={rule?.rules_version||null} accepted={accepted} onChange={setAccepted}/>}
   {step===7&&<div className="space-y-5"><div className="grid gap-3 md:grid-cols-2">
<Review title="Account Information" icon={<UserRound className="h-8 w-8 text-blue-600"/>} tone="bg-blue-50" edit={()=>setStep(1)} rows={[["Name",draft.full_name],["Email",user.email||""],["Phone",draft.phone]]}/>
<Review title="Business Information" icon={<BriefcaseBusiness className="h-8 w-8 text-orange-600"/>} tone="bg-orange-50" edit={()=>setStep(2)} rows={[["Business Type",businessTypeSelection||draft.business_type.replace(/_/g," ")],["Business Name",draft.legal_name],["Country",countryByCode(draft.country)?.name||draft.country]]}/>
<Review title="Verification (KYC)" icon={<ShieldCheck className="h-8 w-8 text-green-600"/>} tone="bg-green-50" edit={()=>setStep(3)} rows={[["Documents",`${documents.length} uploaded`],["Status",application?.kyc_status||"not started"]]}/>
<Review title="Store Setup" icon={<Store className="h-8 w-8 text-violet-600"/>} tone="bg-violet-50" edit={()=>setStep(4)} rows={[["Store Name",draft.store_name],["Category",draft.category||`${draft.product_categories.length} selected`],["Location",draft.ship_from],["Return Address",draft.return_address]]}/>
<Review title="Payments & Payouts" icon={<CreditCard className="h-8 w-8 text-red-600"/>} tone="bg-red-50" edit={()=>setStep(5)} rows={[["Payout Method",payout?.provider_account_id?"Stripe Connect bank payouts":"Not connected"],["Verification",payout?.verification_status||"not started"],["Payouts Enabled",payout?.payouts_enabled?"Yes":"Not yet"]]}/>
<Review title="Policies & Agreements" icon={<FileText className="h-8 w-8 text-orange-600"/>} tone="bg-amber-50" edit={()=>setStep(6)} rows={SELLER_POLICY_CODES.map(code=>[({"seller_terms":"Seller Agreement","commission_payout":"Commission & Payout Terms","shipping_fulfillment":"Shipping Policy","returns_refunds":"Return & Refund Policy","prohibited_products":"Prohibited Products Policy","product_authenticity":"Product Authenticity Confirmation"} as Record<string,string>)[code],accepted.includes(code)?"✓ Accepted":"Not accepted"])}/>
</div><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-[#08143f]"><Checkbox checked={reviewConfirmed} onCheckedChange={v=>setReviewConfirmed(v===true)} aria-label="Confirm information is accurate and complete" className="mt-0.5 h-5 w-5 shrink-0 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"/><span>I confirm that all information provided is accurate and complete. I have reviewed the required seller agreements and understand that submission does not automatically approve my store.</span></label>{!ruleEnabled&&<Alert><AlertTitle>Submission unavailable</AlertTitle><AlertDescription>Final submission is closed until country-specific requirements are verified and enabled.</AlertDescription></Alert>}<div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" className="h-14 min-w-44 border-orange-600 text-lg font-bold text-orange-600 hover:bg-orange-50" onClick={()=>setStep(6)}><ArrowLeft className="mr-3 h-5 w-5"/>Back</Button><Button className="h-14 min-w-64 bg-[#ff4d0b] text-lg font-bold text-white hover:bg-orange-700" disabled={busy||!reviewConfirmed||!ruleEnabled||!SELLER_POLICY_CODES.every(code=>accepted.includes(code))||!payout?.provider_account_id} onClick={()=>void submit()}>{busy?<Loader2 className="mr-2 h-5 w-5 animate-spin"/>:"Submit Application"}<ArrowRight className="ml-4 h-5 w-5"/></Button></div></div>}
   <div className={cn("flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between",step===7&&"hidden")}><div>{step>1&&<Button variant="outline" onClick={()=>setStep(step-1)}><ArrowLeft className="mr-2 h-4 w-4"/>Back</Button>}</div><div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={()=>void save(step)}><Save className="mr-2 h-4 w-4"/>Save draft</Button>{step<7&&<Button disabled={busy} onClick={()=>void next()}>Save & continue<ArrowRight className="ml-2 h-4 w-4"/></Button>}</div></div>
  </CardContent></Card>
 </div></MarketplaceLayout>;
}

const STEP_DESCRIPTIONS=["Confirm the account details linked to this application.","Tell us who is legally selling and where the business operates.","Provide the documents required for your country and seller type.","Create your storefront and provide real shipping and return locations.","Set up a supported payout account. This does not activate payments.","Read and accept the current seller policies.","Check every detail before sending the application to Barakaz."];
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}{required&&" *"}</Label>{children}</div>}
function Status({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium capitalize">{value.replace(/_/g," ")}</p></div>}
function Review({title,rows,icon,tone,edit}:{title:string;rows:string[][];icon:React.ReactNode;tone:string;edit:()=>void}){return <section className="flex min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-4"><div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-xl md:h-20 md:w-20",tone)}>{icon}</div><div className="min-w-0 flex-1"><div className="mb-3 flex items-start justify-between gap-2"><h3 className="text-base font-extrabold text-[#08143f]">{title}</h3><button type="button" onClick={edit} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:underline"><Pencil className="h-4 w-4"/>Edit</button></div><dl className="space-y-2">{rows.map(([label,value])=><div key={label} className="grid grid-cols-[minmax(95px,40%)_minmax(0,1fr)] gap-2 text-sm"><dt className="font-semibold text-[#243562]">{label}:</dt><dd className="break-words text-slate-600">{value||"—"}</dd></div>)}</dl></div></section>}
