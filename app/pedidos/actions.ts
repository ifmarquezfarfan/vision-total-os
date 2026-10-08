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
  return {supabase,userId:user.id,organizationId:membership.organization_id,branchId:branch.branch_id};
}

export async function createOrder(formData:FormData){
  const {supabase,organizationId,branchId}=await getContext();
  const clientId=String(formData.get("client_id")??"")||null;
  const saleId=String(formData.get("sale_id")??"")||null;
  const prescriptionId=String(formData.get("prescription_id")??"")||null;
  const frameProductId=String(formData.get("frame_product_id")??"")||null;
  const status=String(formData.get("status")??"received");
  const lab=String(formData.get("lab")??"").trim();
  const labReference=String(formData.get("lab_reference")??"").trim();
  const lensType=String(formData.get("lens_type")??"").trim();
  const treatmentOptions=formData.getAll("treatment_option").map((value)=>String(value).trim()).filter(Boolean);
  const otherTreatments=String(formData.get("treatments_other")??"").trim();
  const treatments=[...new Set([...treatmentOptions,...(otherTreatments?[otherTreatments]:[])])].join(" · ");
  const lensDiameterRaw=String(formData.get("lens_diameter_mm")??"").trim();
  const lensDiameter=lensDiameterRaw?Number(lensDiameterRaw):null;
  const lensTintColor=String(formData.get("lens_tint_color")??"").trim();
  const lensDesign=String(formData.get("lens_design")??"").trim();
  const lensMaterial=String(formData.get("lens_material")??"").trim();
  const lensIndex=String(formData.get("lens_index")??"").trim();
  const lensBrand=String(formData.get("lens_brand")??"").trim();
  const promisedAtRaw=String(formData.get("promised_at")??"").trim();
  const adaptationRaw=String(formData.get("adaptation_followup_at")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const measureNumber=(name:string)=>{const raw=String(formData.get(name)??"").trim();if(!raw)return null;const value=Number(raw);return Number.isFinite(value)?value:null;};
  const measureText=(name:string)=>String(formData.get(name)??"").trim()||null;
  const measurementNumberNames=["pd_binocular","pd_od","pd_os","pd_near_binocular","pd_near_od","pd_near_os","height_od","height_os","working_distance_cm","vertex","pantoscopic","wrap","frame_a","frame_b","frame_ed","frame_dbl","frame_temple","frame_front_width"];
  if(measurementNumberNames.some((name)=>String(formData.get(name)??"").trim()!==""&&!Number.isFinite(Number(formData.get(name))))) redirect("/pedidos?error=Hay%20una%20medida%20numérica%20inválida");
  const pdMeasures=["pd_binocular","pd_od","pd_os","pd_near_binocular","pd_near_od","pd_near_os"].map(measureNumber).filter((value):value is number=>value!==null);
  if(pdMeasures.some((value)=>value<=0||value>100)) redirect("/pedidos?error=Revisa%20las%20distancias%20pupilares");
  const measurements={
    pd_binocular:measureNumber("pd_binocular"),
    pd_od:measureNumber("pd_od"),
    pd_os:measureNumber("pd_os"),
    pd_near_binocular:measureNumber("pd_near_binocular"),
    pd_near_od:measureNumber("pd_near_od"),
    pd_near_os:measureNumber("pd_near_os"),
    height_od:measureNumber("height_od"),
    height_os:measureNumber("height_os"),
    working_distance_cm:measureNumber("working_distance_cm"),
    vertex:measureNumber("vertex"),
    pantoscopic:measureNumber("pantoscopic"),
    wrap:measureNumber("wrap"),
    frame_a:measureNumber("frame_a"),
    frame_b:measureNumber("frame_b"),
    frame_ed:measureNumber("frame_ed"),
    frame_dbl:measureNumber("frame_dbl"),
    frame_temple:measureNumber("frame_temple"),
    frame_front_width:measureNumber("frame_front_width"),
    mounting_type:measureText("mounting_type"),
    frame_reference:measureText("frame_reference"),
    measurement_notes:measureText("measurement_notes")
  };

  if(!clientId) redirect("/pedidos?error=El%20cliente%20es%20obligatorio");
  if(!["received","in_preparation","at_lab","ready"].includes(status)) redirect("/pedidos?error=Estado%20inválido");
  if(lensDiameter!==null&&(!Number.isFinite(lensDiameter)||lensDiameter<=0||lensDiameter>120)) redirect("/pedidos?error=Revisa%20el%20diámetro%20mínimo%20de%20lente");
  if(lensDiameterRaw&&!Number.isFinite(Number(lensDiameterRaw))) redirect("/pedidos?error=El%20diámetro%20de%20lente%20debe%20ser%20numérico");

  if(saleId){
    const {data:sale}=await supabase.from("sales").select("id,client_id,organization_id,branch_id").eq("id",saleId).maybeSingle();
    if(!sale||sale.organization_id!==organizationId||sale.branch_id!==branchId||sale.client_id!==clientId) redirect("/pedidos?error=La%20venta%20y%20el%20cliente%20no%20coinciden");
  }
  if(prescriptionId){
    const {data:prescription}=await supabase.from("prescriptions").select("id,client_id,organization_id,branch_id").eq("id",prescriptionId).maybeSingle();
    if(!prescription||prescription.organization_id!==organizationId||prescription.branch_id!==branchId||prescription.client_id!==clientId) redirect("/pedidos?error=La%20receta%20no%20pertenece%20al%20cliente%20seleccionado");
  }
  if(frameProductId){
    const {data:frame}=await supabase.from("products").select("id,category,organization_id,branch_id").eq("id",frameProductId).maybeSingle();
    if(!frame||frame.organization_id!==organizationId||frame.branch_id!==branchId||frame.category!=="Montura") redirect("/pedidos?error=La%20montura%20seleccionada%20no%20es%20válida");
  }

  const code="PED-"+Date.now().toString().slice(-8);
  const {data:createdOrder,error}=await supabase.from("optical_orders").insert({
    order_code:code,client_id:clientId,sale_id:saleId,prescription_id:prescriptionId,frame_product_id:frameProductId,
    status,lab:lab||null,lab_reference:labReference||null,lens_type:lensType||null,lens_design:lensDesign||null,
    lens_material:lensMaterial||null,lens_index:lensIndex||null,lens_brand:lensBrand||null,
    lens_diameter_mm:lensDiameter,lens_tint_color:lensTintColor||null,treatments:treatments||null,measurements,
    promised_at:promisedAtRaw?new Date(promisedAtRaw).toISOString():null,
    adaptation_followup_at:adaptationRaw?new Date(adaptationRaw).toISOString():null,
    notes:notes||null,organization_id:organizationId,branch_id:branchId
  }).select("id,order_code").single();
  if(error||!createdOrder) redirect("/pedidos?error=No%20se%20pudo%20crear%20el%20pedido");
  redirect("/pedidos/"+createdOrder.id+"?created=1");
}

export async function updateOrderOperational(formData:FormData){
  const orderId=String(formData.get("order_id")??"");
  const status=String(formData.get("status")??"received");
  const qcStatus=String(formData.get("qc_status")??"pending");
  const labReference=String(formData.get("lab_reference")??"").trim();
  const pickupNotified=formData.get("pickup_notified")==="on";
  const adaptationRaw=String(formData.get("adaptation_followup_at")??"").trim();
  const deliveryNotes=String(formData.get("delivery_notes")??"").trim();
  if(!orderId||!["received","in_preparation","at_lab","ready","delivered","cancelled"].includes(status)||!["pending","approved","rework"].includes(qcStatus)) redirect("/pedidos?error=Datos%20inválidos");

  const {supabase}=await getContext();
  const {data:currentOrder}=await supabase.from("optical_orders").select("id,status,qc_status").eq("id",orderId).maybeSingle();
  if(!currentOrder) redirect("/pedidos?error=Pedido%20no%20encontrado");
  if(status==="delivered"&&qcStatus!=="approved") redirect("/pedidos?error=No%20puedes%20entregar%20un%20pedido%20sin%20QC%20aprobado");
  if(status==="ready"&&qcStatus==="rework") redirect("/pedidos?error=Un%20pedido%20para%20revisión%20no%20puede%20marcarse%20como%20listo");
  if(status==="delivered"&&!pickupNotified) redirect("/pedidos?error=Marca%20que%20el%20cliente%20fue%20avisado%20antes%20de%20entregar");

  const {error}=await supabase.from("optical_orders").update({
    status,qc_status:qcStatus,lab_reference:labReference||null,
    pickup_notified_at:pickupNotified?new Date().toISOString():null,
    adaptation_followup_at:adaptationRaw?new Date(adaptationRaw).toISOString():null,
    delivered_at:status==="delivered"?(currentOrder.status==="delivered"?undefined:new Date().toISOString()):null,
    delivery_notes:deliveryNotes||null
  }).eq("id",orderId);

  if(error) redirect("/pedidos/"+orderId+"?error=No%20se%20pudo%20actualizar%20el%20pedido");
  redirect("/pedidos/"+orderId+"?updated=1");
}
