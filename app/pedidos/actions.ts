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
  const legacyLensProductId=String(formData.get("lens_product_id")??"")||null;
  const rightLensProductId=String(formData.get("right_lens_product_id")??legacyLensProductId??"")||null;
  const leftLensProductId=String(formData.get("left_lens_product_id")??legacyLensProductId??"")||null;
  const status=String(formData.get("status")??"received");
  const lab=String(formData.get("lab")??"").trim();
  const labReference=String(formData.get("lab_reference")??"").trim();
  const lensType=String(formData.get("lens_type")??"").trim();
  const lensUsage=String(formData.get("lens_usage")??"").trim();
  const treatmentOptions=formData.getAll("treatment_option").map((value)=>String(value).trim()).filter(Boolean);
  const otherTreatments=String(formData.get("treatments_other")??"").trim();
  const rightCoatings=[...new Set(formData.getAll("right_lens_coatings").map(value=>String(value).trim()).filter(Boolean))];
  const leftCoatings=[...new Set(formData.getAll("left_lens_coatings").map(value=>String(value).trim()).filter(Boolean))];
  const allowedLensCoatings=new Set(["Antirreflejo","Filtro UV","Filtro azul","Fotocromático","Polarizado","Antirrayas","Hidrofóbico","Oleofóbico","Espejado"]);
  if([...treatmentOptions,...rightCoatings,...leftCoatings].some(value=>!allowedLensCoatings.has(value)&&!["Limpieza","Otro"].includes(value))) redirect("/pedidos?error=Tratamiento%20inválido");
  const perEyeTreatments=[
    ...(rightCoatings.length?["OD: "+rightCoatings.join(", ")]:[]),
    ...(leftCoatings.length?["OI: "+leftCoatings.join(", ")]:[])
  ];
  const treatments=[...new Set([...treatmentOptions,...perEyeTreatments,...(otherTreatments?[otherTreatments]:[])])].join(" · ");
  const lensDiameterRaw=String(formData.get("lens_diameter_mm")??"").trim();
  const lensDiameter=lensDiameterRaw?Number(lensDiameterRaw):null;
  const lensCenterThicknessRaw=String(formData.get("lens_center_thickness_mm")??"").trim();
  const lensCenterThickness=lensCenterThicknessRaw?Number(lensCenterThicknessRaw):null;
  const lensEdgeThicknessRaw=String(formData.get("lens_edge_thickness_mm")??"").trim();
  const lensEdgeThickness=lensEdgeThicknessRaw?Number(lensEdgeThicknessRaw):null;
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
  if(lensDiameterRaw&&(!Number.isFinite(Number(lensDiameterRaw))||lensDiameter===null||lensDiameter<=0||lensDiameter>120)) redirect("/pedidos?error=Revisa%20el%20diámetro%20mínimo%20de%20lente");
  if(lensCenterThicknessRaw&&(!Number.isFinite(Number(lensCenterThicknessRaw))||lensCenterThickness===null||lensCenterThickness<=0||lensCenterThickness>20)) redirect("/pedidos?error=Revisa%20el%20espesor%20central");
  if(lensEdgeThicknessRaw&&(!Number.isFinite(Number(lensEdgeThicknessRaw))||lensEdgeThickness===null||lensEdgeThickness<=0||lensEdgeThickness>20)) redirect("/pedidos?error=Revisa%20el%20espesor%20de%20borde");

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

  type CatalogLens = {
    id:string;product_code:string;category:string;organization_id:string;branch_id:string;
    brand:string|null;model:string|null;description:string|null;cost:number|string|null;sale_price:number|string|null;
    lens_design:string|null;lens_material:string|null;lens_index:number|string|null;lens_phi_mm:number|string|null;
    lens_coatings:string[]|null;lens_prism_capable:boolean|null;
  };
  const loadCatalogLens=async(productId:string|null):Promise<CatalogLens|null>=>{
    if(!productId)return null;
    const {data:lens}=await supabase.from("products").select("id,product_code,category,organization_id,branch_id,brand,model,description,cost,sale_price,lens_design,lens_material,lens_index,lens_phi_mm,lens_coatings,lens_prism_capable").eq("id",productId).eq("active",true).maybeSingle();
    if(!lens||lens.organization_id!==organizationId||lens.branch_id!==branchId||lens.category!=="Lentes") redirect("/pedidos?error=Una%20de%20las%20lunas%20seleccionadas%20no%20pertenece%20al%20catálogo%20de%20esta%20sucursal");
    return lens as CatalogLens;
  };
  const [rightCatalogLens,leftCatalogLens]=await Promise.all([
    loadCatalogLens(rightLensProductId),
    leftLensProductId===rightLensProductId?loadCatalogLens(null):loadCatalogLens(leftLensProductId)
  ]);
  const catalogLens=rightCatalogLens||leftCatalogLens;
  const commonLensSame=Boolean(rightCatalogLens&&leftLensProductId&&rightLensProductId===leftLensProductId);
  const finalLensDesign=lensDesign||catalogLens?.lens_design||"";
  const finalLensMaterial=lensMaterial||catalogLens?.lens_material||"";
  const finalLensIndex=lensIndex||(catalogLens?.lens_index===null||catalogLens?.lens_index===undefined?"":String(catalogLens.lens_index));
  const finalLensBrand=lensBrand||catalogLens?.brand||"";
  const finalLensDiameter=lensDiameter??(catalogLens?.lens_phi_mm===null||catalogLens?.lens_phi_mm===undefined?null:Number(catalogLens.lens_phi_mm));
  const finalTreatments=treatments||(commonLensSame?(catalogLens?.lens_coatings??[]).join(" · "):"");
  const finalLensType=lensType||catalogLens?.lens_design||catalogLens?.description||"";

  const code="PED-"+Date.now().toString().slice(-8);
  const {data:createdOrder,error}=await supabase.from("optical_orders").insert({
    order_code:code,client_id:clientId,sale_id:saleId,prescription_id:prescriptionId,frame_product_id:frameProductId,
    lens_product_id:commonLensSame?rightLensProductId:null,
    right_lens_product_id:rightLensProductId,left_lens_product_id:leftLensProductId,
    status,lab:lab||null,lab_reference:labReference||null,lens_type:finalLensType||null,lens_design:finalLensDesign||null,
    lens_material:finalLensMaterial||null,lens_index:finalLensIndex||null,lens_brand:finalLensBrand||null,
    lens_diameter_mm:finalLensDiameter,lens_center_thickness_mm:lensCenterThickness,lens_edge_thickness_mm:lensEdgeThickness,
    lens_tint_color:lensTintColor||null,treatments:finalTreatments||null,measurements,
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
