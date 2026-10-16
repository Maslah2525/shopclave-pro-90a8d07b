import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Loader2, Save, ShieldCheck, Store, UserRound, Mail, Phone, Lightbulb, LockKeyhole, CheckCircle2, BriefcaseBusiness, ShieldCheck as VerificationShield } from "lucide-react";
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
import { addressFormat, countryByCode } from "@/lib/countries";
import { INITIAL_SELLER_DRAFT, SellerDraft, validateSellerStep } from "@/lib/sellerOnboarding";
import { cn } from "@/lib/utils";
import type { SellerCountryRule } from "@/lib/sellerCountryPolicy";
import { toast } from "sonner";

const STEPS = ["Account", "Business", "Verification", "Store", "Payout", "Agreements", "Submit"];
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
 const [businessWebsite,setBusinessWebsite]=useState("");
 const unsupportedBusinessType=["partnership","other"].includes(businessTypeSelection);
 const [application,setApplication]=useState<AppRow|null>(null); const [rule,setRule]=useState<Rule|null>(null);
 const [documents,setDocuments]=useState<DocumentRow[]>([]); const [payout,setPayout]=useState<PayoutRow|null>(null);
 const [accepted,setAccepted]=useState<string[]>([]);
 const editable=!application||["draft","more_information_required"].includes(application.status);
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
  if(step===6&&rule){if(accepted.length!==SELLER_POLICY_CODES.length){toast.error("Accept all six published seller agreements before continuing.");return;} const {error}=await supabase.rpc("accept_seller_agreements",{p_codes:[...SELLER_POLICY_CODES]});if(error){toast.error(friendlyError(error.message));return;}}
  const nextStep=Math.min(7,step+1); const app=await save(nextStep,true);if(app)setStep(nextStep);
 };
 const connectStripe=async()=>{
  const app=application||await save(5,true); if(!app)return;
  setBusy(true);const {data,error}=await supabase.functions.invoke("seller-stripe-connect");setBusy(false);
  if(error||!data?.url){toast.error(data?.error||"Secure payout onboarding is not available yet.");return;}
  try{const url=new URL(data.url);if(url.protocol!=="https:"||!url.hostname.endsWith("stripe.com")){throw new Error();}window.location.assign(url.toString());}catch{toast.error("Stripe returned an invalid onboarding link.");}
 };
 const submit=async()=>{if(unsupportedBusinessType){toast.error("This business type cannot be submitted until backend support is added.");return;}const validation=[1,2,4].map(s=>validateSellerStep(s,draft,sellerCountryRule)).find(Boolean);if(validation){toast.error(validation);return;}setBusy(true);const {data,error}=await supabase.rpc("submit_seller_application");setBusy(false);if(error){toast.error(friendlyError(error.message));return;}setApplication(data as unknown as AppRow);toast.success("Application submitted for review");window.scrollTo({top:0,behavior:"smooth"});};

 if(authLoading||loading)return <MarketplaceLayout><div className="container flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div></MarketplaceLayout>;
 if(!user)return null;
 if(application&&!editable)return <MarketplaceLayout><div className="container max-w-2xl py-12"><Card><CardHeader className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Clock3 className="h-7 w-7 text-primary"/></div><CardTitle>Application {application.status.replace(/_/g," ")}</CardTitle><CardDescription>Your seller approval and payout verification are tracked separately.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2"><Status label="Application" value={application.status}/><Status label="Identity verification" value={application.kyc_status}/><Status label="Payout setup" value={payout?.verification_status||"not started"}/><Status label="Submitted" value={application.submitted_at?new Date(application.submitted_at).toLocaleDateString():"—"}/></div>{application.review_reason&&<Alert><AlertTitle>Review note</AlertTitle><AlertDescription>{application.review_reason}</AlertDescription></Alert>}<div className="flex justify-center"><Button asChild variant="outline"><Link to="/account">Go to my account</Link></Button></div></CardContent></Card></div></MarketplaceLayout>;

 return <MarketplaceLayout><div className="mx-auto max-w-[1120px] px-4 py-8 md:px-6 md:py-10">
  <header className="mb-7 text-center"><h1 className="text-3xl font-extrabold tracking-tight text-[#08143f] md:text-4xl">Become a Seller on Barakaz</h1><p className="mt-3 text-base text-slate-600 md:text-lg">Create your seller account in a few simple steps.</p></header>
  {application?.status==="more_information_required"&&<Alert className="mb-6"><AlertTitle>More information required</AlertTitle><AlertDescription>{application.review_reason||"Review your application, update the requested information, and submit it again."}</AlertDescription></Alert>}
  <nav aria-label="Seller registration progress" className="mb-7"><ol className="grid grid-cols-7 gap-1 md:gap-3">{["Account Information","Business Information","Verification (KYC)","Store Setup","Payments & Payouts","Policies & Agreements","Review & Submit"].map((name,index)=><li key={name} className="relative flex min-w-0 flex-col items-center text-center"><button type="button" aria-current={index+1===step?"step":undefined} disabled={index+1>Math.max(step,application?.current_step||1)} onClick={()=>setStep(index+1)} className={cn("relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition md:h-14 md:w-14 md:text-xl",index+1===step?"border-[#ff4d0b] bg-[#ff4d0b] text-white":index+1<step?"border-[#ff4d0b] bg-orange-50 text-[#ff4d0b]":"border-slate-200 bg-white text-[#08143f]")}>{index+1<step?<Check className="h-5 w-5"/>:index+1}</button><span className={cn("mt-2 max-w-28 text-[10px] leading-tight md:text-sm",index+1===step?"font-bold text-[#08143f]":"text-slate-600")}>{name}</span>{index<6&&<span aria-hidden="true" className="absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-[18px] h-px bg-slate-300 md:left-[calc(50%+30px)] md:right-[calc(-50%+30px)] md:top-[28px]"/>}</li>)}</ol></nav>
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
   <div className={cn("grid gap-7",step===1?"lg:grid-cols-[minmax(0,1fr)_290px]":"")}>
    <div className="min-w-0">
     <div className="mb-7 flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">{step===1?<UserRound className="h-9 w-9"/>:step===2?<BriefcaseBusiness className="h-9 w-9"/>:step===3?<VerificationShield className="h-9 w-9"/>:<Store className="h-9 w-9"/>}</div><div><h2 className="text-2xl font-extrabold text-[#08143f] md:text-3xl">{step===1?"1. Create Your Account":step===2?"2. Business Information":step===3?"3. Verification (KYC)":step===4?"4. Store Setup":STEPS[step-1]}</h2><p className="mt-1 text-slate-600">{step===1?"Let's get started. Confirm your Barakaz seller account details.":STEP_DESCRIPTIONS[step-1]}</p></div></div>
   {step===1&&<div className="space-y-5">
    <Field label="Full Name" required><div className="relative"><UserRound className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><Input className="h-12 pl-11" value={draft.full_name} onChange={e=>set("full_name",e.target.value)} placeholder="Enter your full name" autoComplete="name"/></div></Field>
    <Field label="Email Address" required><div className="relative"><Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><Input className="h-12 bg-slate-50 pl-11" value={user.email||""} disabled/></div><p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-blue-700">Your email is managed and verified through your Barakaz account.</p></Field>
    <Field label="Phone Number" required><div className="relative"><Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><Input className="h-12 pl-11" value={draft.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 416 555 0123" inputMode="tel" autoComplete="tel"/></div><p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-blue-700">Include your international calling code. Phone verification is not yet available in this form.</p></Field>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-[#08143f]"><Mail className="h-5 w-5 text-blue-600"/> Email verification</div><p className="mt-2 text-sm text-slate-600">Use your existing account verification. No additional code is required here.</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-[#08143f]"><LockKeyhole className="h-5 w-5 text-blue-600"/> Password security</div><p className="mt-2 text-sm text-slate-600">Your password is managed securely through account authentication.</p></div></div>
    <div className="rounded-xl bg-sky-50 p-5"><h3 className="flex items-center gap-2 font-bold text-blue-800"><LockKeyhole className="h-6 w-6"/> Account Security Tips</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{["Use a strong, unique password","Keep your account email accessible","Use your correct international phone number","Never share verification codes"].map(t=><span key={t} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 shrink-0 text-green-600"/>{t}</span>)}</div></div>
   </div>}
   {step===2&&<div className="space-y-6">
    <div className="grid gap-x-9 gap-y-5 md:grid-cols-2">
     <Field label="Business Type" required><Select value={businessTypeSelection||draft.business_type} onValueChange={value=>{setBusinessTypeSelection(value);setDraft(d=>({...d,business_type:value==="partnership"||value==="other"?"":value as SellerDraft["business_type"]}));setAccepted([]);}}><SelectTrigger className="h-12"><SelectValue placeholder="Select business type"/></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="sole_proprietor">Sole Proprietorship</SelectItem><SelectItem value="company">Corporation / Registered Company</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Choose the structure that best describes your business.</p>{unsupportedBusinessType&&<p className="text-sm text-amber-700" role="status">This type cannot be saved or submitted until backend support is enabled.</p>}{businessTypeSelection==="other"&&<div className="mt-2"><Label htmlFor="other-business-type">Specify your business type</Label><Input id="other-business-type" placeholder="Enter your business structure" disabled title="Requires backend support before saving"/></div>}</Field>
     <Field label="Legal Business Name" required><Input className="h-12" value={draft.legal_name} onChange={e=>set("legal_name",e.target.value)} placeholder="Enter your legal business name"/><p className="text-xs text-slate-500">This is your official legal business name.</p></Field>
     <Field label="Business Registration Number (if applicable)" required={draft.business_type==="company"||(draft.business_type==="sole_proprietor"&&draft.is_business_registered)}><Input className="h-12" value={draft.registration_number} onChange={e=>set("registration_number",e.target.value)} placeholder="Enter registration number" disabled={draft.business_type==="individual"||(draft.business_type==="sole_proprietor"&&!draft.is_business_registered)}/><p className="text-xs text-slate-500">Include your business registration or licence number.</p></Field>
     <Field label="Business Website (Optional)"><Input className="h-12" type="url" value={businessWebsite} onChange={e=>setBusinessWebsite(e.target.value)} placeholder="https://yourwebsite.com"/><p className="text-xs text-slate-500">Add your business website or online store (optional). Not saved until backend support is added.</p></Field>
    </div>
    {draft.business_type==="sole_proprietor"&&<div className="flex items-start gap-3 rounded-lg border p-4"><Checkbox id="business-registered" checked={draft.is_business_registered} onCheckedChange={checked=>setDraft(d=>({...d,is_business_registered:checked===true,registration_number:checked===true?d.registration_number:""}))}/><div><Label htmlFor="business-registered">This sole proprietorship is registered</Label><p className="text-xs text-slate-500">Registration evidence is required when selected.</p></div></div>}
    <div className="border-t border-slate-200 pt-6"><div className="mb-5 flex items-center gap-3"><span className="text-3xl text-orange-600">●</span><div><h3 className="text-xl font-bold text-[#08143f]">Business Address</h3><p className="text-sm text-slate-600">Enter your official business address. This will be used for verification and correspondence.</p></div></div>
    <div className="grid gap-x-9 gap-y-5 md:grid-cols-2">
     <Field label="Country" required><CountrySelector value={draft.country} onChange={value=>{setDraft(d=>({...d,country:value,region:"",postal_code:""}));setAccepted([]);}}/></Field>
     <Field label="Unit / Suite / Floor Number (Optional)"><Input className="h-12" value={draft.address_line2} onChange={e=>set("address_line2",e.target.value)} placeholder="e.g. Unit 5, Suite 200, Floor 3"/></Field>
     <Field label="Street Address" required><Input className="h-12" value={draft.address_line1} onChange={e=>set("address_line1",e.target.value)} placeholder="Enter street address" autoComplete="address-line1"/></Field>
     <Field label="City" required><Input className="h-12" value={draft.city} onChange={e=>set("city",e.target.value)} placeholder="Enter city" autoComplete="address-level2"/></Field>
     <Field label={addressFormat(draft.country).regionLabel} required><Input className="h-12" value={draft.region} onChange={e=>set("region",e.target.value)} placeholder={draft.country==="CA"?"Enter province or territory":draft.country==="US"?"Enter state":"Enter region"} autoComplete="address-level1"/></Field>
     <Field label={addressFormat(draft.country).postalLabel} required={addressFormat(draft.country).postalRequired}><Input className="h-12" value={draft.postal_code} onChange={e=>set("postal_code",e.target.value)} placeholder={addressFormat(draft.country).postalExample||"Enter postal code"} autoComplete="postal-code"/></Field>
    </div></div>
    <div className="grid gap-5 md:grid-cols-2"><Field label="Tax identification / VAT / GST (if applicable)"><Input value={draft.tax_identifier} onChange={e=>set("tax_identifier",e.target.value)}/></Field><Field label="Business category" required><Input value={draft.category} onChange={e=>set("category",e.target.value)} placeholder="Main type of products sold"/></Field></div>
    <Field label="Additional registered address details"><Textarea value={draft.address} onChange={e=>set("address",e.target.value)} placeholder="Building, district or other details"/></Field>
    {draft.country&&draft.business_type&&!rule&&<Alert><AlertTitle>Drafts are welcome worldwide</AlertTitle><AlertDescription>Applications from {countryByCode(draft.country)?.name||draft.country} are not open for final submission until Barakaz verifies local KYC, payout, tax, and compliance requirements.</AlertDescription></Alert>}
   </div>}
   {step===3&&application?<SellerKycUpload applicationId={application.id} userId={user.id} requirements={effectiveDocuments} documents={documents} rulesAvailable={Boolean(rule)} onChanged={()=>refreshRelated(application)}/>:step===3&&<Alert><AlertDescription>Save the previous steps to create your secure document area.</AlertDescription></Alert>}
   {step===4&&<div className="grid gap-x-9 gap-y-6 md:grid-cols-2">
    <div className="space-y-5">
     <Field label="Store Name" required><Input className="h-12" maxLength={50} value={draft.store_name} onChange={e=>set("store_name",e.target.value)} placeholder="Enter your store name"/><div className="flex justify-between text-xs text-slate-500"><span>Choose a unique and memorable store name.</span><span>{draft.store_name.length}/50</span></div></Field>
     <Field label="Store Logo" required><StoreLogoUpload userId={user.id} value={draft.logo_url} onChange={value=>set("logo_url",value)}/></Field>
     <Field label="Store Banner (Optional)"><div className="rounded-lg border border-dashed bg-slate-50 p-5 text-center"><p className="font-medium text-[#08143f]">Store banner</p><p className="mt-1 text-xs text-slate-500">Banner uploads will be available when storage and seller draft persistence are configured.</p></div></Field>
     <Field label="Store Description" required><Textarea className="min-h-32" maxLength={500} value={draft.store_description} onChange={e=>set("store_description",e.target.value)} placeholder="Tell customers about your store, products and what makes it special"/><div className="flex justify-between text-xs text-slate-500"><span>Describe your products and what makes your store special.</span><span>{draft.store_description.length}/500</span></div></Field>
    </div>
    <div className="space-y-5">
     <StoreCategoryFields value={draft.product_categories} onChange={value=>set("product_categories",value)}/>
     <Field label="Store Location" required><CountrySelector value={draft.country} onChange={value=>{setDraft(d=>({...d,country:value}));setAccepted([]);}}/><p className="text-xs text-slate-500">Your registered seller country. Changing it may affect verification requirements.</p></Field>
     <Field label="Warehouse / Shipping Origin" required><Textarea value={draft.ship_from} onChange={e=>set("ship_from",e.target.value)} placeholder="Enter your complete warehouse or shipping origin address"/><p className="text-xs text-slate-500">This is where products will be shipped from.</p></Field>
     <Field label="Estimated Processing Time"><Select disabled><SelectTrigger className="h-12"><SelectValue placeholder="Available after store approval"/></SelectTrigger><SelectContent><SelectItem value="1-3">1–3 business days</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Processing-time configuration is not yet supported by seller application drafts.</p></Field>
     <Field label="Return Policy"><Select disabled><SelectTrigger className="h-12"><SelectValue placeholder="Configured after store approval"/></SelectTrigger><SelectContent><SelectItem value="7">7 days return</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Return policy selection will be enabled after supported policy settings are connected.</p></Field>
     <Field label="Return Address" required><Textarea value={draft.return_address} onChange={e=>set("return_address",e.target.value)} placeholder="Enter your complete returns address"/></Field>
    </div>
   </div>}
   {step===5&&<div className="space-y-5"><div className="rounded-xl border p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-primary"/><div><h3 className="font-semibold">Secure payout onboarding</h3><p className="mt-1 text-sm text-muted-foreground">Connect a supported Stripe account where verified for your country. Payout verification remains separate from seller approval.</p></div></div><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" disabled={busy||!ruleEnabled} onClick={()=>void connectStripe()}>{payout?.provider_account_id?"Continue Stripe setup":"Connect with Stripe"}</Button><Badge variant="outline">{payout?.verification_status?.replace(/_/g," ")||"not started"}</Badge></div></div>{!rule&&<Alert><AlertDescription>Payout onboarding is unavailable until Barakaz verifies support for this country and seller type.</AlertDescription></Alert>}</div>}
   {step===6&&<SellerAgreements rulesVersion={rule?.rules_version||null} accepted={accepted} onChange={setAccepted}/>}
   {step===7&&<div className="space-y-5"><Alert><AlertTitle>Review before submitting</AlertTitle><AlertDescription>Submitting sends your completed application to Barakaz for review. It does not automatically approve your store or enable payouts.</AlertDescription></Alert><div className="grid gap-4 md:grid-cols-2"><Review title="Account" rows={[["Name",draft.full_name],["Email",user.email||""],["Phone",draft.phone]]}/><Review title="Business" rows={[["Country",countryByCode(draft.country)?.name||draft.country],["Seller type",draft.business_type.replace(/_/g," ")],["Legal name",draft.legal_name],["Registration",draft.registration_number||"Not applicable"],["Address",draft.address],["Category",draft.category]]}/><Review title="Store" rows={[["Store name",draft.store_name],["Categories",`${draft.product_categories.length} selected`],["Ship from",draft.ship_from],["Returns",draft.return_address]]}/><Review title="Verification" rows={[["Documents",`${documents.length} uploaded`],["KYC status",application?.kyc_status||"not started"],["Payout",payout?.verification_status||"not started"],["Agreements",`${accepted.length} of 6 accepted`]]}/></div><Button size="lg" className="w-full" disabled={busy||!ruleEnabled||accepted.length!==6||!payout?.provider_account_id} onClick={()=>void submit()}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Store className="mr-2 h-4 w-4"/>}Submit application for approval</Button>{!ruleEnabled&&<p className="text-center text-sm text-muted-foreground">Final submission is closed until country-specific requirements are verified and enabled.</p>}</div>}
   <div className={cn("mt-6 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between",step===1&&"lg:hidden")}><div>{step>1&&<Button variant="outline" className={cn((step===2||step===3||step===4)&&"h-14 min-w-44 border-orange-600 text-lg font-bold text-orange-600 hover:bg-orange-50")} onClick={()=>setStep(step-1)}><ArrowLeft className="mr-2 h-4 w-4"/>Back</Button>}</div><div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={()=>void save(step)}><Save className="mr-2 h-4 w-4"/>Save draft</Button>{step<7&&<Button className={cn((step===2||step===3||step===4)&&"h-14 min-w-64 bg-[#ff4d0b] text-lg font-bold text-white hover:bg-orange-700")} disabled={busy} onClick={()=>void next()}>{step===2||step===3||step===4?"Continue":"Save & continue"}<ArrowRight className="ml-2 h-4 w-4"/></Button>}</div></div>
    </div>
    {step===1&&<aside className="space-y-5"><div className="rounded-xl bg-orange-50 p-5"><h3 className="flex items-center gap-2 font-bold text-[#08143f]"><ShieldCheck className="h-7 w-7 text-orange-600"/> Why Join Barakaz?</h3><div className="mt-5 space-y-4">{["Access to a global marketplace","Secure and trusted payments","Simple store setup","Seller support resources","Tools to grow your business"].map(t=><p key={t} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-orange-600"/>{t}</p>)}</div></div><div className="rounded-xl bg-sky-50 p-5"><h3 className="flex items-center gap-2 font-bold text-[#08143f]"><Lightbulb className="h-7 w-7 text-blue-600"/> Tips for a Strong Account</h3><div className="mt-5 space-y-4">{["Use a valid and active email","Provide a working phone number","Protect your password","Keep your details up to date"].map(t=><p key={t} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600"/>{t}</p>)}</div></div></aside>}
   </div>
   {step===1&&<div className="mt-6 hidden lg:block"><Button className="h-16 w-full rounded-lg bg-[#ff4d0b] text-xl font-bold text-white hover:bg-orange-700" disabled={busy} onClick={()=>void next()}>Continue <ArrowRight className="ml-4 h-6 w-6"/></Button><div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" disabled={busy} onClick={()=>void save(step)}><Save className="mr-2 h-4 w-4"/>Save draft</Button></div></div>}
   {step===1&&<p className="mt-5 text-center text-sm text-slate-600">By continuing, you agree to Barakaz's <Link className="font-semibold text-orange-600 underline" to="/terms">Terms & Conditions</Link> and <Link className="font-semibold text-orange-600 underline" to="/privacy-policy">Privacy Policy</Link>.</p>}
  </div>
 </div></MarketplaceLayout>;
}

const STEP_DESCRIPTIONS=["Confirm the account details linked to this application.","Tell us who is legally selling and where the business operates.","Provide the documents required for your country and seller type.","Create your storefront and provide real shipping and return locations.","Set up a supported payout account. This does not activate payments.","Read and accept the current seller policies.","Check every detail before sending the application to Barakaz."];
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}{required&&" *"}</Label>{children}</div>}
function Status({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium capitalize">{value.replace(/_/g," ")}</p></div>}
function Review({title,rows}:{title:string;rows:string[][]}){return <div className="rounded-lg border p-4"><h3 className="mb-3 font-semibold">{title}</h3><dl className="space-y-2">{rows.map(([label,value])=><div key={label} className="text-sm"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words capitalize">{value||"—"}</dd></div>)}</dl></div>}
