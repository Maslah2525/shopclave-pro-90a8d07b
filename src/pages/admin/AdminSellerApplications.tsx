import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import AdminSellerDocuments from "@/components/admin/AdminSellerDocuments";

const AdminSellerApplications = () => {
 const qc=useQueryClient();
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const {data=[],isLoading,error}=useQuery({
  queryKey:["admin-seller-applications"],
  queryFn:async()=>{
   const {data,error}=await supabase.from("seller_applications" as any)
    .select("id,user_id,status,country,business_type,business_info,store_info,kyc_status,submitted_at,review_reason")
    .neq("status","draft").order("submitted_at",{ascending:false}).limit(100);
   if(error)throw error;
   return (data||[]) as any[];
  }
 });
 const kycReview=useMutation({
  mutationFn:async({id,result}:{id:string;result:string})=>{
   const {error}=await supabase.rpc("record_seller_kyc_review" as any,{
    p_application_id:id,p_result:result,p_reason:reasons[id]?.trim()||null
   });
   if(error)throw error;
  },
  onSuccess:()=>{toast.success("KYC decision recorded");void qc.invalidateQueries({queryKey:["admin-seller-applications"]});},
  onError:(e:Error)=>toast.error(e.message)
 });
 const approve=useMutation({
  mutationFn:async(id:string)=>{
   const {error}=await supabase.rpc("approve_seller_application" as any,{p_application_id:id});
   if(error)throw error;
  },
  onSuccess:()=>{toast.success("Seller approved; Stripe payout verification remains separate");void qc.invalidateQueries({queryKey:["admin-seller-applications"]});},
  onError:(e:Error)=>toast.error(e.message)
 });
 const review=useMutation({
  mutationFn:async({id,decision}:{id:string;decision:string})=>{
   const {error}=await supabase.rpc("review_seller_application" as any,{
    p_application_id:id,p_decision:decision,p_reason:reasons[id]?.trim()||null
   });
   if(error)throw error;
  },
  onSuccess:()=>{toast.success("Review decision recorded");void qc.invalidateQueries({queryKey:["admin-seller-applications"]});},
  onError:(e:Error)=>toast.error(e.message)
 });
  const busy=kycReview.isPending||approve.isPending||review.isPending;
  return <div className="space-y-4">
   <h1 className="text-2xl font-bold">Seller Applications</h1>
   {isLoading&&<p>Loading…</p>}
   {error&&<p role="alert" className="text-destructive">Couldn't load applications.</p>}
   {!isLoading&&!error&&data.length===0&&<p className="text-sm text-muted-foreground">No submitted applications yet. Sellers appear here after they finish step 7.</p>}
   {data.map(a=>{
    const note=reasons[a.id]?.trim();
    const rejected=a.status==="rejected";
    const kycOk=a.kyc_status==="verified";
    const canApprove=["submitted","under_review"].includes(a.status);
    return <article key={a.id} className="rounded-xl border p-4 space-y-3">
     <div className="flex flex-wrap gap-2 justify-between items-center">
      <h2 className="font-semibold">{a.store_info?.store_name||a.business_info?.legal_name||"Unnamed"}</h2>
      <span className="text-xs rounded-full bg-muted px-2 py-1 capitalize">{a.status.replace(/_/g," ")} · KYC {(a.kyc_status||"not started").replace(/_/g," ")}</span>
     </div>
     <p className="text-xs text-muted-foreground">{a.country||"—"} · {a.business_type?.replace(/_/g," ")||"—"} · {a.submitted_at?new Date(a.submitted_at).toLocaleDateString():"—"}</p>
     {a.review_reason&&<p className="text-sm">Note: {a.review_reason}</p>}
     <details><summary className="text-sm cursor-pointer text-muted-foreground">Documents</summary>
      <AdminSellerDocuments applicationId={a.id} onReviewed={()=>void qc.invalidateQueries({queryKey:["admin-seller-applications"]})} />
     </details>
     <Textarea value={reasons[a.id]||""} onChange={e=>setReasons(x=>({...x,[a.id]:e.target.value}))} placeholder="Note (needed to verify KYC, request info or reject)" rows={2} />
     <div className="flex flex-wrap gap-2">
      {rejected?
       <Button disabled={busy} onClick={()=>review.mutate({id:a.id,decision:"under_review"})}>Reconsider</Button>
      :<>
       {canApprove&&!kycOk&&<Button variant="outline" disabled={busy||!note} onClick={()=>kycReview.mutate({id:a.id,result:"verified"})}>Verify KYC</Button>}
       {canApprove&&<Button disabled={busy||!kycOk} title={kycOk?"":"Verify KYC first"} onClick={()=>approve.mutate(a.id)}>Approve</Button>}
       {a.status==="submitted"&&<Button variant="outline" disabled={busy} onClick={()=>review.mutate({id:a.id,decision:"under_review"})}>Under review</Button>}
       {a.status!=="approved"&&<Button variant="secondary" disabled={busy||!note} onClick={()=>review.mutate({id:a.id,decision:"more_information_required"})}>Request info</Button>}
       {a.status!=="approved"&&<Button variant="destructive" disabled={busy||!note} onClick={()=>review.mutate({id:a.id,decision:"rejected"})}>Reject</Button>}
      </>}
     </div>
    </article>;})}
  </div>;
};
export default AdminSellerApplications;
