"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");
  return {supabase,organizationId:membership.organization_id,branchId:branch.branch_id};
}

export async function createSale(formData:FormData){
  const {supabase,organizationId,branchId}=await getContext();
  const clientId=String(formData.get("client_id")??"")||null;
  const leadId=String(formData.get("lead_id")??"")||null;
  const paymentMethod=String(formData.get("payment_method")??"").trim();
  const paidAmount=Number(formData.get("paid_amount")??0);
  const saleDiscount=Number(formData.get("sale_discount")??0);
  const responsible=String(formData.get("responsible")??"").trim();
  const itemCountRaw=Number(formData.get("item_count")??0);
  const itemCount=Number.isFinite(itemCountRaw)?Math.min(Math.max(Math.trunc(itemCountRaw),1),60):1;
  const items:Array<Record<string,unknown>>=[];
  for(let i=1;i<=itemCount;i++){
    const productId=String(formData.get(`product_${i}`)??"");
    const componentType=String(formData.get(`component_${i}`)??"other");
    const description=String(formData.get(`description_${i}`)??"").trim();
    const quantity=Number(formData.get(`quantity_${i}`)??1);
    const unitPrice=Number(formData.get(`price_${i}`)??0);
    const unitCost=Number(formData.get(`cost_${i}`)??0);
    const discount=Number(formData.get(`discount_${i}`)??0);
    if(!productId&&!description&&!String(formData.get(`price_${i}`)??"").trim()) continue;
    if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0||!Number.isFinite(discount)||discount<0) redirect("/ventas?error=Hay%20un%20ítem%20inválido");
    items.push({product_id:productId||null,component_type:componentType,description:description||undefined,quantity,unit_price:unitPrice,unit_cost:Number.isFinite(unitCost)&&unitCost>=0?unitCost:0,discount});
  }
  if(!items.length) redirect("/ventas?error=Agrega%20al%20menos%20un%20ítem");
  if(!Number.isFinite(paidAmount)||paidAmount<0) redirect("/ventas?error=Pago%20inicial%20inválido");
  if(!Number.isFinite(saleDiscount)||saleDiscount<0) redirect("/ventas?error=Descuento%20inválido");

  const {data,error}=await supabase.rpc("create_sale_transaction",{
    target_org:organizationId,target_branch:branchId,target_client:clientId,target_lead:leadId,
    target_payment_method:paymentMethod||null,target_paid:paidAmount,target_discount:saleDiscount,
    target_responsible:responsible||null,items
  });
  if(error){
    const message=error.message||"";
    const friendly=message.includes("Insufficient stock")?"Stock insuficiente para uno de los productos":
      message.includes("Payment exceeds sale total")?"El pago inicial supera el total de la venta":
      message.includes("Payment method is required")?"Selecciona el medio de pago para el adelanto":
      message.includes("Product not found")?"Uno de los productos ya no está disponible":
      message.includes("Client not found")?"El cliente seleccionado ya no está disponible":
      "No se pudo registrar la venta";
    redirect("/ventas?error="+encodeURIComponent(friendly));
  }
  const saleId=typeof data==="object"&&data&&"sale_id" in data?String((data as {sale_id:string}).sale_id):"";
  const saleCode=typeof data==="object"&&data&&"sale_code" in data?String((data as {sale_code:string}).sale_code):"venta";
  redirect(saleId?"/ventas/"+saleId+"?created="+encodeURIComponent(saleCode):"/ventas?created="+encodeURIComponent(saleCode));
}