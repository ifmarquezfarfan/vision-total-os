"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if (!membership||!branch) redirect("/onboarding");
  return {supabase,userId:user.id,organizationId:membership.organization_id,branchId:branch.branch_id};
}

export async function createOrder(formData: FormData) {
  const {supabase,organizationId,branchId}=await getContext();
  const clientId=String(formData.get("client_id")??"")||null;
  const saleId=String(formData.get("sale_id")??"")||null;
  const prescriptionId=String(formData.get("prescription_id")??"")||null;
  const frameProductId=String(formData.get("frame_product_id")??"")||null;
  const status=String(formData.get("status")??"received");
  const lab=String(formData.get("lab")??"").trim();
  const labReference=String(formData.get("lab_reference")??"").trim();
  const lensType=String(formData.get("lens_type")??"").trim();
  const treatments=String(formData.get("treatments")??"").trim();
  const lensDesign=String(formData.get("lens_design")??"").trim();
  const lensMaterial=String(formData.get("lens_material")??"").trim();
  const lensIndex=String(formData.get("lens_index")??"").trim();
  const lensBrand=String(formData.get("lens_brand")??"").trim();
  const promisedAtRaw=String(formData.get("promised_at")??"").trim();
  const adaptationRaw=String(formData.get("adaptation_followup_at")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const measurements={
    pd_binocular:String(formData.get("pd_binocular")??"").trim()||null,
    pd_od:String(formData.get("pd_od")??"").trim()||null,
    pd_os:String(formData.get("pd_os")??"").trim()||null,
    height_od:String(formData.get("height_od")??"").trim()||null,
    height_os:String(formData.get("height_os")??"").trim()||null,
    vertex:String(formData.get("vertex")??"").trim()||null,
    pantoscopic:String(formData.get("pantoscopic")??"").trim()||null,
    wrap:String(formData.get("wrap")??"").trim()||null,
    frame_a:String(formData.get("frame_a")??"").trim()||null,
    frame_b:String(formData.get("frame_b")??"").trim()||null,
    frame_dbl:String(formData.get("frame_dbl")??"").trim()||null,
    frame_temple:String(formData.get("frame_temple")??"").trim()||null
  };

  if(!clientId) redirect("/pedidos?error=El%20cliente%20es%20obligatorio");
  if(!["received","in_preparation","at_lab","ready"].includes(status)) redirect("/pedidos?error=Estado%20inválido");

  const code="PED-"+Date.now().toString().slice(-8);
  const {error}=await supabase.from("optical_orders").insert({
    order_code:code,client_id:clientId,sale_id:saleId,prescription_id:prescriptionId,frame_product_id:frameProductId,
    status,lab:lab||null,lab_reference:labReference||null,lens_type:lensType||null,lens_design:lensDesign||null,lens_material:lensMaterial||null,lens_index:lensIndex||null,lens_brand:lensBrand||null,treatments:treatments||null,measurements,
    promised_at:promisedAtRaw?new Date(promisedAtRaw).toISOString():null,
    adaptation_followup_at:adaptationRaw?new Date(adaptationRaw).toISOString():null,
    notes:notes||null,organization_id:organizationId,branch_id:branchId
  });
  if(error) redirect("/pedidos?error=No%20se%20pudo%20crear%20el%20pedido");
  redirect("/pedidos/"+encodeURIComponent(code)+"?created=1");
}

export async function updateOrderOperational(formData: FormData) {
  const orderId=String(formData.get("order_id")??"");
  const status=String(formData.get("status")??"received");
  const qcStatus=String(formData.get("qc_status")??"pending");
  const labReference=String(formData.get("lab_reference")??"").trim();
  const pickupNotified=formData.get("pickup_notified")==="on";
  const adaptationRaw=String(formData.get("adaptation_followup_at")??"").trim();
  const deliveryNotes=String(formData.get("delivery_notes")??"").trim();

  if(!orderId||!["received","in_preparation","at_lab","ready","delivered","cancelled"].includes(status)||!["pending","approved","rework"].includes(qcStatus)) redirect("/pedidos?error=Datos%20inválidos");

  const {supabase}=await getContext();
  const {error}=await supabase.from("optical_orders").update({
    status,qc_status,lab_reference:labReference||null,
    pickup_notified_at:pickupNotified?new Date().toISOString():null,
    adaptation_followup_at:adaptationRaw?new Date(adaptationRaw).toISOString():null,
    delivered_at:status==="delivered"?new Date().toISOString():null,
    delivery_notes:deliveryNotes||null
  }).eq("id",orderId);

  if(error) redirect("/pedidos?error=No%20se%20pudo%20actualizar%20el%20pedido");
  redirect("/pedidos?updated=1");
}
