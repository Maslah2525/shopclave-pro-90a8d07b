import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DocumentRow={id:string;requirement_code:string;verification_status:string};
export default function SellerKycUpload({ applicationId, userId, requirements, documents, rulesAvailable, onChanged }: { applicationId:string; userId:string; requirements:string[]; documents:DocumentRow[]; rulesAvailable:boolean; onChanged:()=>Promise<void>|void }) {
 const [busy,setBusy]=useState<string|null>(null);
 const uploaded=useMemo(()=>new Map(documents.map(d=>[d.requirement_code,d])),[documents]);
 const upload=async(code:string,file?:File)=>{
  if(!file)return;
  if(!["image/jpeg","image/png","application/pdf"].includes(file.type)||file.size>10*1024*1024){toast.error("Upload a JPG, PNG, or PDF under 10 MB.");return;}
  setBusy(code);
  const ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";
  const path=`${userId}/${applicationId}/${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await supabase.storage.from("seller-kyc-private").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError){toast.error("Secure document upload failed.");setBusy(null);return;}
  const {error}=await supabase.rpc("register_seller_kyc_upload",{p_requirement_code:code,p_storage_path:path});
  if(error){toast.error(error.message);setBusy(null);return;}
  toast.success("Document uploaded securely for review.");await onChanged();setBusy(null);
 };
 if(!rulesAvailable)return <Alert><AlertDescription>Verification requirements for this country and seller type are not available yet. You may save your draft, but cannot submit it yet.</AlertDescription></Alert>;
 if(!requirements.length)return <Alert><AlertDescription>No additional Barakaz documents are required for this seller type. Identity and payout verification are completed securely through Stripe before Barakaz can approve the application.</AlertDescription></Alert>;
 return <div className="space-y-3">
  <Alert><AlertDescription>Upload only genuine, current documents. Files are private and an upload does not mean your identity is verified.</AlertDescription></Alert>
  {requirements.map(code=>{const doc=uploaded.get(code);return <div key={code} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
   <div><p className="font-medium capitalize">{code.replace(/_/g," ")}</p><p className="text-xs text-muted-foreground">JPG, PNG, or PDF · maximum 10 MB</p></div>
   <div className="flex items-center gap-2">{doc&&<Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>{doc.verification_status}</Badge>}
    <Button type="button" size="sm" variant="outline" disabled={busy===code} asChild><label className="cursor-pointer">{busy===code?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FileUp className="mr-2 h-4 w-4"/>}{doc?"Replace":"Upload"}<input className="hidden" type="file" accept="image/jpeg,image/png,application/pdf" onChange={e=>void upload(code,e.target.files?.[0])}/></label></Button>
   </div>
  </div>})}
 </div>;
}
