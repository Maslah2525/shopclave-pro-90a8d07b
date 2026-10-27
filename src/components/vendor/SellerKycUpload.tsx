import { useMemo, useState } from "react";
import { CheckCircle2, CloudUpload, FileText, IdCard, Lightbulb, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DocumentRow={id:string;requirement_code:string;verification_status:string};
const displayName=(code:string)=>code.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const isIdentity=(code:string)=>/identity|government|passport|national_id|driver|personal_id|photo_id/.test(code);
export default function SellerKycUpload({ applicationId, userId, requirements, documents, rulesAvailable, onChanged }: { applicationId:string; userId:string; requirements:string[]; documents:DocumentRow[]; rulesAvailable:boolean; onChanged:()=>Promise<void>|void }) {
 const [busy,setBusy]=useState<string|null>(null);
 const uploaded=useMemo(()=>new Map(documents.map(d=>[d.requirement_code,d])),[documents]);
 const upload=async(code:string,file?:File)=>{
  if(!file)return;
  if(!["image/jpeg","image/png","application/pdf"].includes(file.type)||file.size>10*1024*1024){toast.error("Upload a JPG, PNG, or PDF no larger than 10 MB.");return;}
  setBusy(code);
  try{
   const ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";
   const path=`${userId}/${applicationId}/${crypto.randomUUID()}.${ext}`;
   const {error:uploadError}=await supabase.storage.from("seller-kyc-private").upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError){toast.error("Secure document upload failed.");return;}
   const {error}=await supabase.rpc("register_seller_kyc_upload",{p_requirement_code:code,p_storage_path:path});
   if(error){toast.error(error.message);return;}
   toast.success("Document uploaded securely for review.");await onChanged();
  }finally{setBusy(null);}
 };
 if(!rulesAvailable)return <Alert><AlertDescription>Verification requirements for this country and seller type are not available yet. You may save your draft, but cannot submit it yet.</AlertDescription></Alert>;
 if(!requirements.length)return <Alert><AlertDescription>No additional Barakaz documents are required for this seller type. Identity and payout verification are completed securely through Stripe before Barakaz can approve the application.</AlertDescription></Alert>;
 const identity=requirements.filter(isIdentity);
 const business=requirements.filter(code=>!isIdentity(code));
 const groups=[{title:"Government ID",description:"Provide the identity document required for your country and seller type.",codes:identity,icon:IdCard},{title:"Business Documents",description:"Upload the business evidence required by your registration rules.",codes:business,icon:FileText}].filter(group=>group.codes.length);
 return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
  <div className="space-y-7">
   {groups.map((group,index)=><section key={group.title} className="space-y-3"><div><h3 className="text-xl font-bold text-[#08143f]">{index+1}. {group.title} <span className="text-orange-600">*</span></h3><p className="mt-1 text-sm text-slate-600">{group.description}</p></div>
    {group.codes.map(code=>{const doc=uploaded.get(code);return <div key={code} className="space-y-3">
     <div className="flex items-center justify-between gap-3"><label className="text-sm font-semibold text-[#08143f]" htmlFor={`kyc-${code}`}>{displayName(code)}</label>{doc&&<Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>{doc.verification_status.replace(/_/g," ")}</Badge>}</div>
     <label htmlFor={`kyc-${code}`} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center transition hover:border-orange-400 hover:bg-orange-50/40">
      {busy===code?<Loader2 className="mb-2 h-9 w-9 animate-spin text-orange-600"/>:<CloudUpload className="mb-2 h-9 w-9 text-[#08143f]"/>}
      <span className="font-bold text-[#08143f]">{doc?"Replace":"Upload"} {displayName(code)}</span>
      <span className="mt-1 text-sm text-slate-500">Choose a file to upload securely</span><span className="text-xs text-slate-500">JPG, PNG, PDF (Max 10MB)</span>
      <input id={`kyc-${code}`} className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy!==null} onChange={e=>{void upload(code,e.target.files?.[0]);e.target.value="";}}/>
     </label>
    </div>;})}
   </section>)}
  </div>
  <aside className="space-y-5">
   <section className="rounded-xl bg-blue-50 p-5"><h3 className="flex items-center gap-3 text-lg font-bold text-[#08143f]"><FileText className="h-7 w-7 text-blue-600"/> Accepted Formats</h3><div className="mt-5 space-y-3">{["JPG, PNG, PDF","Clear and readable","Full document visible","No blur or glare","Valid and not expired","Max size: 10MB per file"].map(t=><p key={t} className="flex items-start gap-3 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-green-600"/>{t}</p>)}</div></section>
   <section className="rounded-xl bg-amber-50 p-5"><h3 className="flex items-center gap-3 text-lg font-bold text-[#08143f]"><Lightbulb className="h-7 w-7 text-amber-500"/> Important Notes</h3><ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-slate-700"><li>Document names should match your application information.</li><li>Documents must be valid and not expired.</li><li>Ensure all text and details are clearly visible.</li><li>Uploads are private and used for verification review.</li></ul></section>
   <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0"/> Uploading documents does not mean verification is complete.</p>
  </aside>
 </div>;
}
