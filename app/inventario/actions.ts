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

export async function createProduct(formData:FormData){
  const brand=String(formData.get("brand")??"").trim();
  const model=String(formData.get("model")??"").trim();
  const category=String(formData.get("category")??"Montura").trim();
  const description=String(formData.get("description")??"").trim();
  const cost=Number(formData.get("cost")??0);
  const salePrice=Number(formData.get("sale_price")??0);
  const initialStock=Math.max(0,Math.floor(Number(formData.get("initial_stock")??0)));
  const color=String(formData.get("color")??"").trim();
  const material=String(formData.get("material")??"").trim();
  const displayed=formData.get("displayed")==="on";
  const physicalStatus=String(formData.get("physical_status")??"Bueno").trim();
  const entryAtRaw=String(formData.get("entry_at")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const inventoryMode=String(formData.get("inventory_mode")??"stock").trim();
  const lensDesign=String(formData.get("lens_design")??"").trim();
  const lensMaterial=String(formData.get("lens_material")??"").trim();
  const lensIndexRaw=String(formData.get("lens_index")??"").trim();
  const lensIndex=lensIndexRaw?Number(lensIndexRaw):null;
  const lensPhiRaw=String(formData.get("lens_phi_mm")??"").trim();
  const lensPhi=lensPhiRaw?Number(lensPhiRaw):null;
  const lensCoatingOptions=["Antirreflejo","Filtro UV","Filtro azul","Fotocromático","Polarizado","Antirrayas","Hidrofóbico","Oleofóbico","Espejado"];
  const lensCoatings=[...new Set(formData.getAll("lens_coatings").map(v=>String(v).trim()).filter(v=>lensCoatingOptions.includes(v)))];
  const lensPrismCapable=formData.get("lens_prism_capable")==="on";
  const optionalNumber=(name:string)=>{const raw=String(formData.get(name)??"").trim();if(!raw)return null;const value=Number(raw);return Number.isFinite(value)?value:null;};
  const rxSphereMin=optionalNumber("lens_sphere_min");
  const rxSphereMax=optionalNumber("lens_sphere_max");
  const rxCylinderMin=optionalNumber("lens_cylinder_min");
  const rxCylinderMax=optionalNumber("lens_cylinder_max");
  const productNumberNames=["lens_sphere_min","lens_sphere_max","lens_cylinder_min","lens_cylinder_max"];
  if(!brand&&!model&&!description) redirect("/inventario?error=Ingresa%20al%20menos%20marca%2C%20modelo%20o%20descripción");
  if(!["stock","on_demand","service"].includes(inventoryMode)) redirect("/inventario?error=Modo%20de%20inventario%20inválido");
  if(lensIndexRaw&&(!Number.isFinite(Number(lensIndexRaw))||lensIndex===null||lensIndex<1||lensIndex>2)) redirect("/inventario?error=El%20índice%20debe%20estar%20entre%201.00%20y%202.00");
  if(lensPhiRaw&&(!Number.isFinite(Number(lensPhiRaw))||lensPhi===null||lensPhi<=0||lensPhi>120)) redirect("/inventario?error=Revisa%20el%20PHI%20o%20diámetro");
  if(productNumberNames.some(name=>String(formData.get(name)??"").trim()!==""&&!Number.isFinite(Number(formData.get(name))))) redirect("/inventario?error=Hay%20un%20rango%20de%20graduación%20inválido");
  if(rxSphereMin!==null&&rxSphereMax!==null&&rxSphereMin>rxSphereMax) redirect("/inventario?error=El%20mínimo%20esférico%20supera%20el%20máximo");
  if(rxCylinderMin!==null&&rxCylinderMax!==null&&rxCylinderMin>rxCylinderMax) redirect("/inventario?error=El%20mínimo%20cilíndrico%20supera%20el%20máximo");

  const {supabase,organizationId,branchId}=await getContext();
  const {data:location}=await supabase.from("inventory_locations").select("id").eq("branch_id",branchId).eq("code","PRINCIPAL").eq("active",true).limit(1).maybeSingle();

  const {data:product,error}=await supabase.from("products").insert({
    product_code:"",
    category,
    brand:brand||null,model:model||null,description:description||null,
    color:color||null,material:material||null,
    lens_design:category==="Lentes"?(lensDesign||null):null,
    lens_material:category==="Lentes"?(lensMaterial||null):null,
    lens_index:category==="Lentes"?lensIndex:null,
    lens_phi_mm:category==="Lentes"?lensPhi:null,
    lens_coatings:category==="Lentes"?lensCoatings:[],
    lens_prism_capable:category==="Lentes"?lensPrismCapable:false,
    lens_sphere_min:category==="Lentes"?rxSphereMin:null,
    lens_sphere_max:category==="Lentes"?rxSphereMax:null,
    lens_cylinder_min:category==="Lentes"?rxCylinderMin:null,
    lens_cylinder_max:category==="Lentes"?rxCylinderMax:null,
    cost:Number.isFinite(cost)&&cost>=0?cost:0,
    sale_price:Number.isFinite(salePrice)&&salePrice>=0?salePrice:0,
    inventory_mode:inventoryMode,
    displayed,
    physical_status:["Bueno","Regular","Dañado","Baja","Otro"].includes(physicalStatus)?physicalStatus:"Bueno",
    entry_at:entryAtRaw?new Date(entryAtRaw).toISOString():null,
    notes:notes||null,
    organization_id:organizationId,branch_id:branchId
  }).select("id").single();

  if(error||!product) redirect("/inventario?error=No%20se%20pudo%20guardar%20el%20producto");

  if(initialStock>0&&location&&inventoryMode==="stock"){
    const {error:movementError}=await supabase.rpc("adjust_inventory",{target_org:organizationId,target_branch:branchId,target_product:product.id,target_location:location.id,delta:initialStock,movement_note:"Stock inicial"});
    if(movementError) redirect("/inventario?error=Producto%20creado%2C%20pero%20no%20se%20pudo%20registrar%20el%20stock%20inicial");
  }


  redirect("/inventario?created=1");
}

export async function adjustStock(formData:FormData){
  const productId=String(formData.get("product_id")??"");
  const locationId=String(formData.get("location_id")??"");
  const delta=Math.floor(Number(formData.get("delta")??0));
  const note=String(formData.get("note")??"").trim();
  if(!productId||!locationId||!delta) redirect("/inventario?error=Completa%20producto%2C%20ubicación%20y%20cantidad");

  const {supabase,organizationId,branchId}=await getContext();
  const {error}=await supabase.rpc("adjust_inventory",{target_org:organizationId,target_branch:branchId,target_product:productId,target_location:locationId,delta,movement_note:note||null});
  if(error) redirect("/inventario?error="+encodeURIComponent(error.message.includes("Insufficient stock")?"Stock insuficiente":"No se pudo ajustar el inventario"));
  redirect("/inventario?adjusted=1");
}

export async function deactivateProduct(formData:FormData){
  const productId=String(formData.get("product_id")??"");
  if(!productId) redirect("/inventario?error=Producto%20inválido");
  const {supabase,organizationId,branchId}=await getContext();
  const {data:product}=await supabase.from("products").select("id,stock_qty").eq("id",productId).eq("organization_id",organizationId).eq("branch_id",branchId).maybeSingle();
  if(!product) redirect("/inventario?error=Producto%20no%20encontrado");
  if(Number(product.stock_qty)>0) redirect("/inventario?error=No%20puedes%20dar%20de%20baja%20un%20producto%20con%20stock");
  const {error}=await supabase.from("products").update({active:false}).eq("id",productId).eq("organization_id",organizationId).eq("branch_id",branchId);
  if(error) redirect("/inventario?error=No%20se%20pudo%20dar%20de%20baja%20el%20producto");
  redirect("/inventario?deactivated=1");
}
