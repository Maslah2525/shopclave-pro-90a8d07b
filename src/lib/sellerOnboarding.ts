export type SellerDraft = {
 full_name:string; phone:string; country:string; business_type:""|"individual"|"sole_proprietor"|"company";
 legal_name:string; registration_number:string; tax_identifier:string; address_line1:string; address_line2:string; city:string; region:string; postal_code:string; is_business_registered:boolean; address:string; category:string;
 store_name:string; store_description:string; logo_url:string; product_categories:string[]; ship_from:string; return_address:string;
};
export const INITIAL_SELLER_DRAFT:SellerDraft={full_name:"",phone:"",country:"CA",business_type:"",legal_name:"",registration_number:"",tax_identifier:"",address_line1:"",address_line2:"",city:"",region:"",postal_code:"",is_business_registered:false,address:"",category:"",store_name:"",store_description:"",logo_url:"",product_categories:[],ship_from:"",return_address:""};
export function validateSellerStep(step:number,d:SellerDraft){
 if(step===1&&(!d.full_name.trim()||!/^\+?[1-9]\d{7,14}$/.test(d.phone.replace(/[\s()-]/g,""))))return "Enter your full name and a valid international phone number.";
 if(step===2&&(!d.country||!d.business_type||!d.legal_name.trim()||!d.address.trim()||!d.category.trim()))return "Complete all required business information.";
 if(step===2&&(!d.address_line1.trim()||!d.city.trim()))return "Enter the registered street address and city.";
 if(step===2&&d.business_type==="company"&&!d.registration_number.trim())return "Enter the company registration / business number.";
 if(step===2&&d.business_type==="sole_proprietor"&&d.is_business_registered&&!d.registration_number.trim())return "Enter the registered business number.";
 if(step===4&&(!d.store_name.trim()||!d.store_description.trim()||!d.logo_url||!d.product_categories.length||!d.ship_from.trim()||!d.return_address.trim()))return "Complete all required store information.";
 return null;
}
