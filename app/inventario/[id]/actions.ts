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
  if(!brand&&!model&&!description) redirect("/inventario/"+encodeURIComponent(id)+"?error=Completa%20al%20menos%20una%20identificación");
  if(!["stock","on_demand","service"].includes(inventoryMode)) redirect("/inventario/"+encodeURIComponent(id)+"?error=Modo%20inválido");
  if(lensIndexRaw&&(!Number.isFinite(Number(lensIndexRaw))||lensIndex===null||lensIndex<1||lensIndex>2)) redirect("/inventario/"+encodeURIComponent(id)+"?error=El%20índice%20debe%20estar%20entre%201.00%20y%202.00");
  if(lensPhiRaw&&(!Number.isFinite(Number(lensPhiRaw))||lensPhi===null||lensPhi<=0||lensPhi>120)) redirect("/inventario/"+encodeURIComponent(id)+"?error=Revisa%20el%20PHI%20o%20diámetro");
  if(productNumberNames.some(name=>String(formData.get(name)??"").trim()!==""&&!Number.isFinite(Number(formData.get(name))))) redirect("/inventario/"+encodeURIComponent(id)+"?error=Hay%20un%20rango%20de%20graduación%20inválido");
  if(rxSphereMin!==null&&rxSphereMax!==null&&rxSphereMin>rxSphereMax) redirect("/inventario/"+encodeURIComponent(id)+"?error=El%20mínimo%20esférico%20supera%20el%20máximo");
  if(rxCylinderMin!==null&&rxCylinderMax!==null&&rxCylinderMin>rxCylinderMax) redirect("/inventario/"+encodeURIComponent(id)+"?error=El%20mínimo%20cilíndrico%20supera%20el%20máximo");

  const {supabase,organizationId,branchId}=await getContext();
  const {data:product}=await supabase.from("products").select("id,stock_qty,inventory_mode").eq("id",id).eq("organization_id",organizationId).eq("branch_id",branchId).maybeSingle();
  if(!product) redirect("/inventario?error=Producto%20no%20encontrado");
  if(product.inventory_mode==="on_demand"&&inventoryMode==="stock"&&Number(product.stock_qty)===0){
    // Allowed: the manager is explicitly converting a product back to tracked stock.
  }

  const {error}=await supabase.from("products").update({
    category,brand:brand||null,model:model||null,description:description||null,
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
    cost:Number.isFinite(cost)&&cost>=0?cost:0,sale_price:Number.isFinite(salePrice)&&salePrice>=0?salePrice:0,
    min_stock:minStock,inventory_mode:inventoryMode,
    physical_status:["Bueno","Regular","Dañado","Baja","Otro"].includes(physicalStatus)?physicalStatus:"Bueno",
    displayed,entry_at:entryAtRaw?new Date(entryAtRaw).toISOString():null,notes:notes||null
  }).eq("id",id).eq("organization_id",organizationId).eq("branch_id",branchId);

  if(error) redirect("/inventario/"+encodeURIComponent(id)+"?error=No%20se%20pudo%20actualizar");


  redirect("/inventario/"+encodeURIComponent(id)+"?updated=1");
}
