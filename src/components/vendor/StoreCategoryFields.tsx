import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Category = {id:string;name:string;parent_id:string|null};
export default function StoreCategoryFields({value,onChange}:{value:string[];onChange:(ids:string[])=>void}) {
 const {data=[],isLoading,isError,refetch}=useQuery({
  queryKey:["seller-store-category-tree"],
  queryFn:async()=>{const {data,error}=await supabase.from("categories").select("id,name,parent_id").order("name").limit(1500);if(error)throw error;return (data||[]) as Category[];},
  staleTime:300000,retry:1
 });
 const parent=data.find(c=>c.parent_id===null&&value.includes(c.id))||data.find(c=>value.some(id=>data.find(child=>child.id===id)?.parent_id===c.id))||null;
 const children=parent?data.filter(c=>c.parent_id===parent.id):[];
 const selectedChild=children.find(c=>value.includes(c.id));
 if(isLoading)return <p className="text-sm text-slate-500">Loading store categories…</p>;
 if(isError)return <Alert><AlertDescription>Categories could not be loaded. <Button type="button" variant="link" onClick={()=>void refetch()}>Retry</Button></AlertDescription></Alert>;
 if(!data.length)return <p className="text-sm text-amber-700">No categories are available from the catalogue database.</p>;
 return <div className="space-y-5">
  <div className="space-y-2"><label className="text-sm font-semibold text-[#08143f]">Store Category <span className="text-orange-600">*</span></label><Select value={parent?.id||""} onValueChange={id=>onChange([id])}><SelectTrigger className="h-12"><SelectValue placeholder="Select store category"/></SelectTrigger><SelectContent>{data.filter(c=>c.parent_id===null).map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
  <div className="space-y-2"><label className="text-sm font-semibold text-[#08143f]">Store Sub-category {children.length>0&&<span className="text-orange-600">*</span>}</label><Select value={selectedChild?.id||""} disabled={!parent||!children.length} onValueChange={id=>onChange(parent?[parent.id,id]:[id])}><SelectTrigger className="h-12"><SelectValue placeholder={parent?children.length?"Select store sub-category":"No sub-categories available":"Choose category first"}/></SelectTrigger><SelectContent>{children.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
 </div>;
}
