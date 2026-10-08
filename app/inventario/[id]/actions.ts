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

export async function updateProduct(formData:FormData){
  const id=String(formData.get("id")??"");
  if(!id) redirect("/inventario?error=Producto%20inválido");

  const category=String(formData.get("category")??"Montura").trim();
  const brand=String(formData.get("brand")??"").trim();
  const model=String(formData.get("model")??"").trim();
  const description=String(formData.get("description")??"").trim();
  const color=String(formData.get("color")??"").trim();
  const material=String(formData.get("material")??"").trim();
  const cost=Number(formData.get("cost")??0);
  const salePrice=Number(formData.get("sale_price")??0);
  const minStock=Math.max(0,Math.floor(Number(formData.get("min_stock")??0)));
  const inventoryMode=String(formData.get("inventory_mode")??"stock").trim();
  const physicalStatus=String(formData.get("physical_status")??"Bueno").trim();
  const displayed=formData.get("displayed")==="on";
  const entryAtRaw=String(formData.get("entry_at")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const photo=formData.get("photo");
  if(photo instanceof File && photo.size>0){
    if(photo.size>5*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(photo.type)){
      redirect("/inventario/"+encodeURIComponent(id)+"?error=La%20foto%20debe%20ser%20JPG%2C%20PNG%20o%20WEBP%20y%20menor%20a%205%20MB");
    }
  }

  if(!brand&&!model&&!description) redirect("/inventario/"+encodeURIComponent(id)+"?error=Completa%20al%20menos%20una%20identificación");
  if(!["stock","on_demand","service"].includes(inventoryMode)) redirect("/inventario/"+encodeURIComponent(id)+"?error=Modo%20inválido");

  const {supabase,organizationId,branchId}=await getContext();
  const {data:product}=await supabase.from("products").select("id,stock_qty,inventory_mode").eq("id",id).eq("organization_id",organizationId).eq("branch_id",branchId).maybeSingle();
  if(!product) redirect("/inventario?error=Producto%20no%20encontrado");
  if(product.inventory_mode==="on_demand"&&inventoryMode==="stock"&&Number(product.stock_qty)===0){
    // Allowed: the manager is explicitly converting a product back to tracked stock.
  }

  const {error}=await supabase.from("products").update({
    category,brand:brand||null,model:model||null,description:description||null,
    color:color||null,material:material||null,
    cost:Number.isFinite(cost)&&cost>=0?cost:0,sale_price:Number.isFinite(salePrice)&&salePrice>=0?salePrice:0,
    min_stock:minStock,inventory_mode:inventoryMode,
    physical_status:["Bueno","Regular","Dañado","Baja","Otro"].includes(physicalStatus)?physicalStatus:"Bueno",
    displayed,entry_at:entryAtRaw?new Date(entryAtRaw).toISOString():null,notes:notes||null
  }).eq("id",id).eq("organization_id",organizationId).eq("branch_id",branchId);

  if(error) redirect("/inventario/"+encodeURIComponent(id)+"?error=No%20se%20pudo%20actualizar");

  if(photo instanceof File && photo.size>0){
    const extension=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg";
    const path=`${organizationId}/${product.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await supabase.storage.from("product-images").upload(path,photo,{contentType:photo.type,upsert:false});
    if(uploadError) redirect("/inventario/"+encodeURIComponent(id)+"?updated=1&error=Los%20datos%20se%20guardaron%2C%20pero%20la%20foto%20no%20pudo%20subirse");
    const {data:publicData}=supabase.storage.from("product-images").getPublicUrl(path);
    await supabase.from("products").update({photo_url:publicData.publicUrl}).eq("id",product.id).eq("organization_id",organizationId).eq("branch_id",branchId);
  }

  redirect("/inventario/"+encodeURIComponent(id)+"?updated=1");
}
