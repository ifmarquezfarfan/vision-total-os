"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");
  return { supabase, user, organizationId: membership.organization_id, branchId: branch.branch_id };
}

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const withOffset = value.length === 16 ? value + ":00-05:00" : value;
  const date = new Date(withOffset);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDateToEndIso(value: string) {
  if (!value) return null;
  const date = new Date(value + "T23:59:59-05:00");
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function friendlyError(message: string) {
  if (message.includes("Quote not found") || message.includes("Initial quote not found")) return "No encontramos la cotización.";
  if (message.includes("not waiting for measurement")) return "La cotización no está esperando una medición externa.";
  if (message.includes("Measurement is required")) return "Registra y confirma la medición antes de preparar la cotización final.";
  if (message.includes("final quote already exists")) return "Esta cotización ya tiene una cotización final activa.";
  if (message.includes("Axis must")) return "El eje debe estar entre 1° y 180°.";
  if (message.includes("pupillary distance")) return "Revisa las distancias pupilares.";
  if (message.includes("Prism base")) return "Cada prisma necesita una base válida.";
  if (message.includes("At least one prescription power")) return "Registra al menos una potencia de la receta.";
  if (message.includes("Prescription type")) return "Selecciona el tipo o uso de receta.";
  if (message.includes("Payment method is required")) return "Selecciona el medio de pago.";
  if (message.includes("Payment exceeds")) return "El pago supera el total de la cotización.";
  if (message.includes("Not authorized")) return "Tu usuario no tiene permiso para esta operación.";
  return "No se pudo completar el paso. Revisa los datos e inténtalo de nuevo.";
}

export async function sendQuoteToMeasurement(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const provider = String(formData.get("measurement_provider") ?? "").trim();
  const notes = String(formData.get("measurement_notes") ?? "").trim();
  if (!quoteId || !provider) redirect("/atencion?error=Indica%20el%20centro%20o%20profesional%20que%20realizará%20la%20medición");

  const { supabase, organizationId, branchId } = await getContext();
  const { data: quote } = await supabase.from("quotes")
    .select("id,workflow_stage,quote_kind")
    .eq("id", quoteId).eq("organization_id", organizationId).eq("branch_id", branchId).maybeSingle();
  if (!quote || quote.workflow_stage !== "initial_quote" || quote.quote_kind !== "initial") {
    redirect("/atencion?error=Esta%20cotización%20ya%20no%20está%20en%20la%20etapa%20inicial");
  }
  const { error } = await supabase.from("quotes").update({
    workflow_stage: "measurement_pending",
    measurement_status: "pending",
    measurement_provider: provider,
    measurement_sent_at: new Date().toISOString(),
    measurement_notes: notes || null
  }).eq("id", quoteId).eq("organization_id", organizationId).eq("branch_id", branchId);
  if (error) redirect("/atencion?error=No%20se%20pudo%20registrar%20el%20envío%20a%20medición");
  redirect("/atencion?sent_to_measurement=1");
}

export async function receiveQuoteMeasurement(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) redirect("/atencion?error=Cotización%20inválida");

  const numericFields = [
    "od_sphere","od_cylinder","od_axis","od_add","os_sphere","os_cylinder","os_axis","os_add",
    "od_near_sphere","od_near_cylinder","od_near_axis","os_near_sphere","os_near_cylinder","os_near_axis",
    "od_prism_horizontal","od_prism_vertical","os_prism_horizontal","os_prism_vertical","pd","pd_od","pd_os"
  ];
  const rx: Record<string, string | number | null> = {};
  for (const field of numericFields) {
    const raw = String(formData.get(field) ?? "").trim();
    rx[field] = raw ? Number(raw) : null;
    if (raw && !Number.isFinite(Number(raw))) redirect("/atencion?error=Hay%20un%20valor%20numérico%20inválido%20en%20la%20receta");
  }

  const axisFields = ["od_axis","os_axis","od_near_axis","os_near_axis"];
  if (axisFields.some((field) => rx[field] !== null && (!Number.isInteger(Number(rx[field])) || Number(rx[field]) < 1 || Number(rx[field]) > 180))) {
    redirect("/atencion?error=El%20eje%20debe%20estar%20entre%201%20y%20180");
  }
  for (const field of ["pd","pd_od","pd_os"]) {
    if (rx[field] !== null && (Number(rx[field]) <= 0 || Number(rx[field]) > (field === "pd" ? 100 : 50))) redirect("/atencion?error=Revisa%20la%20distancia%20pupilar");
  }
  for (const field of ["od_prism_horizontal","od_prism_vertical","os_prism_horizontal","os_prism_vertical"]) {
    if (rx[field] !== null && Number(rx[field]) < 0) redirect("/atencion?error=El%20prisma%20no%20puede%20ser%20negativo");
  }

  const stringFields = ["rx_type","cylinder_notation","prescriber_name","prescriber_license","rx_source","prescription_notes","measurement_notes"];
  for (const field of stringFields) rx[field] = String(formData.get(field) ?? "").trim() || null;
  const baseFields = ["od_prism_horizontal_base","od_prism_vertical_base","os_prism_horizontal_base","os_prism_vertical_base"];
  for (const field of baseFields) rx[field] = String(formData.get(field) ?? "").trim() || null;
  rx.exam_at = localDateTimeToIso(String(formData.get("exam_at") ?? "")) ?? new Date().toISOString();
  rx.expires_at = localDateToEndIso(String(formData.get("expires_at") ?? ""));

  if (!rx.rx_type) redirect("/atencion?error=Selecciona%20el%20tipo%20de%20receta");
  if (!["positive","negative"].includes(String(rx.cylinder_notation))) redirect("/atencion?error=Selecciona%20el%20formato%20del%20cilindro");
  const hasPower = ["od_sphere","od_cylinder","os_sphere","os_cylinder","od_near_sphere","os_near_sphere"].some((field) => rx[field] !== null);
  if (!hasPower) redirect("/atencion?error=Registra%20al%20menos%20una%20potencia");

  const prismPairs: Array<[string,string,string[]]> = [
    ["od_prism_horizontal","od_prism_horizontal_base",["BI","BO"]],
    ["od_prism_vertical","od_prism_vertical_base",["BU","BD"]],
    ["os_prism_horizontal","os_prism_horizontal_base",["BI","BO"]],
    ["os_prism_vertical","os_prism_vertical_base",["BU","BD"]]
  ];
  const badPrism = prismPairs.some(([amountName,baseName,allowed]) => {
    const amount = rx[amountName] === null ? null : Number(rx[amountName]);
    const base = String(rx[baseName] ?? "");
    return (amount !== null && amount > 0 && !allowed.includes(base)) || (base !== "" && !allowed.includes(base)) || (amount === null && base !== "");
  });
  if (badPrism) redirect("/atencion?error=Completa%20el%20valor%20y%20la%20base%20del%20prisma");

  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc("receive_quote_measurement", { target_quote: quoteId, rx });
  if (error) redirect("/atencion?error=" + encodeURIComponent(friendlyError(error.message || "")));
  const result = data as { prescription_id?: string } | null;
  redirect("/atencion?measurement_received=1&prescription=" + encodeURIComponent(result?.prescription_id ?? ""));
}

export async function createFinalQuoteFromMeasurement(formData: FormData) {
  const parentId = String(formData.get("parent_quote_id") ?? "");
  const discountPercent = Number(formData.get("discount_percent") ?? 0);
  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const recipeConfirmed = formData.get("recipe_confirmed") === "on";
  const intendedUse = String(formData.get("final_intended_use") ?? "").trim();
  const priority = String(formData.get("final_priority") ?? "").trim();
  const mountingType = String(formData.get("final_mounting_type") ?? "").trim();
  const rightLensSpec = String(formData.get("right_lens_spec") ?? "").trim();
  const leftLensSpec = String(formData.get("left_lens_spec") ?? "").trim();
  const treatmentNotes = String(formData.get("final_treatment_notes") ?? "").trim();
  const shareFinalQuote = formData.get("share_final_quote") === "on";
  if (!parentId) redirect("/atencion?error=Cotización%20de%20origen%20inválida");
  if (!recipeConfirmed) redirect("/atencion?error=Confirma%20que%20revisaste%20receta%2C%20montura%20y%20configuración%20con%20el%20cliente");
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) redirect("/atencion?error=El%20descuento%20debe%20estar%20entre%200%25%20y%20100%25");

  const itemCountRaw = Number(formData.get("item_count") ?? 0);
  const itemCount = Number.isFinite(itemCountRaw) ? Math.min(Math.max(Math.trunc(itemCountRaw), 1), 60) : 1;
  const items: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= itemCount; i++) {
    const productId = String(formData.get(`product_${i}`) ?? "");
    const componentType = String(formData.get(`component_${i}`) ?? "other");
    const description = String(formData.get(`description_${i}`) ?? "").trim();
    const quantity = Number(formData.get(`quantity_${i}`) ?? 0);
    const priceRaw = String(formData.get(`price_${i}`) ?? "").trim();
    const price = Number(priceRaw);
    const cost = Number(formData.get(`cost_${i}`) ?? 0);
    const itemDiscount = Number(formData.get(`discount_${i}`) ?? 0);
    if (!productId && !description && !priceRaw) continue;
    if (!priceRaw || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(itemDiscount) || itemDiscount < 0) redirect("/atencion?error=Completa%20un%20precio%20válido%20para%20cada%20componente");
    items.push({
      product_id: productId || null, component_type: componentType,
      description: description || undefined, quantity, unit_price: price,
      unit_cost: Number.isFinite(cost) && cost >= 0 ? cost : 0, discount: itemDiscount
    });
  }
  if (!items.length) redirect("/atencion?error=Agrega%20al%20menos%20un%20componente");
  const subtotalBeforeGlobal = items.reduce((sum, item) =>
    sum + Math.max(Number(item.quantity || 1) * Number(item.unit_price || 0) - Number(item.discount || 0), 0), 0);
  const discount = Math.round((subtotalBeforeGlobal * discountPercent / 100 + Number.EPSILON) * 100) / 100;

  const { supabase, organizationId, branchId } = await getContext();
  const { data: parent } = await supabase.from("quotes").select("id,organization_id,branch_id,workflow_stage,quote_kind,measurement_status,prescription_id,optical_configuration").eq("id",parentId).eq("organization_id",organizationId).eq("branch_id",branchId).maybeSingle();
  if (!parent || parent.workflow_stage !== "measurement_received" || parent.measurement_status !== "received" || !parent.prescription_id || parent.quote_kind !== "initial") redirect("/atencion?error=Primero%20debes%20registrar%20la%20medición%20externa");

  const parentConfiguration = parent.optical_configuration && typeof parent.optical_configuration === "object" ? parent.optical_configuration as Record<string,unknown> : {};
  const allowedLensFamilies = ["Monofocal (lejos)", "Monofocal (cerca)", "Progresivo/Bifocal"];
  const allowedLensMaterials = ["Resina simple", "Cristal-Vidrio", "CR-39 (NK-55)", "Policarbonato", "Trivex", "High Index (Premium)"];
  const allowedLensTreatments = ["Antirrayas","Antirreflejo","Antiempañante","Protección UV 400","Filtro Azul-Violeta","Hidrofóbico/Oleofóbico","Polarizado","Fotocromático"];
  const allowedLensSeries = ["pending_measurement","1era serie (0.25-2.00)","2da serie (2.25-4.00)","3ra serie (4.25-6.00)","4ta serie (>6.25)"];
  const lensFamilyRaw = String(formData.get("lens_family") ?? "").trim();
  const lensMaterialRaw = String(formData.get("lens_material") ?? "").trim();
  const lensSeriesRaw = String(formData.get("lens_series") ?? "").trim();
  if (lensFamilyRaw && !allowedLensFamilies.includes(lensFamilyRaw)) redirect("/atencion?error=Tipo%20de%20luna%20inválido");
  if (lensMaterialRaw && !allowedLensMaterials.includes(lensMaterialRaw)) redirect("/atencion?error=Material%20óptico%20inválido");
  if (lensSeriesRaw && !allowedLensSeries.includes(lensSeriesRaw)) redirect("/atencion?error=Serie%20óptica%20inválida");
  const lensTreatmentsSubmitted = formData.get("lens_options_submitted") === "1";
  const submittedTreatments = [...new Set(formData.getAll("lens_treatments").map((value) => String(value).trim()).filter((value) => allowedLensTreatments.includes(value)))];
  const finalConfiguration = {
    ...parentConfiguration,
    intended_use:intendedUse||parentConfiguration.intended_use||null,
    priority:priority||parentConfiguration.priority||null,
    lens_family:lensFamilyRaw||parentConfiguration.lens_family||null,
    lens_material:lensMaterialRaw||parentConfiguration.lens_material||null,
    lens_treatments:lensTreatmentsSubmitted?submittedTreatments:(parentConfiguration.lens_treatments||[]),
    lens_series:lensSeriesRaw||parentConfiguration.lens_series||"pending_measurement",
    package_brand:String(formData.get("package_brand")??"").trim().slice(0,180)||parentConfiguration.package_brand||null,
    price_note:String(formData.get("price_note")??"").trim().slice(0,300)||parentConfiguration.price_note||"Precio confirmado después de la medición",
    mounting_type:mountingType||null,
    right_lens_spec:rightLensSpec||null,
    left_lens_spec:leftLensSpec||null,
    final_treatment_notes:treatmentNotes||null,
    recipe_and_configuration_confirmed:true,
    share_final_quote:shareFinalQuote,
    final_configuration_confirmed_at:new Date().toISOString()
  };
  const { data, error } = await supabase.rpc("create_final_quote_transaction", {
    target_parent: parentId,
    target_discount: discount,
    target_expires_at: localDateToEndIso(expiresRaw),
    target_notes: notes || null,
    items,
    target_configuration: finalConfiguration
  });
  if (error) redirect("/atencion?error=" + encodeURIComponent(friendlyError(error.message || "")));
  const result = data as { quote_code?: string; share_token?: string } | null;
  redirect("/atencion?final_created=" + encodeURIComponent(result?.quote_code || "1") + (result?.share_token ? "&share=" + encodeURIComponent(result.share_token) : ""));
}

export async function completeFinalQuoteSale(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const paidAmount = Number(formData.get("paid_amount") ?? 0);
  const responsible = String(formData.get("responsible") ?? "").trim();
  if (!quoteId || !Number.isFinite(paidAmount) || paidAmount < 0) redirect("/atencion?error=Revisa%20el%20pago");
  if (paidAmount > 0 && !paymentMethod) redirect("/atencion?error=Selecciona%20el%20medio%20de%20pago");

  const { supabase, organizationId, branchId, user } = await getContext();
  const { data: quote } = await supabase.from("quotes").select("id,workflow_stage,quote_kind,client_id,total").eq("id",quoteId).eq("organization_id",organizationId).eq("branch_id",branchId).maybeSingle();
  if (!quote || quote.workflow_stage !== "final_quote" || quote.quote_kind !== "final" || !quote.client_id) redirect("/atencion?error=Solo%20una%20cotización%20final%20con%20cliente%20puede%20pasar%20a%20pago");
  if (paidAmount <= 0) redirect("/atencion?error=Registra%20un%20adelanto%20o%20el%20pago%20total%20para%20confirmar%20la%20venta");

  const { data, error } = await supabase.rpc("convert_quote_to_sale_transaction", {
    target_quote: quoteId,
    target_payment_method: paymentMethod || null,
    target_paid: paidAmount,
    target_responsible: responsible || user.email || null
  });
  if (error) redirect("/atencion?error=" + encodeURIComponent(friendlyError(error.message || "")));
  const result = data as { sale_id?: string; sale_code?: string } | null;
  if (!result?.sale_id) redirect("/atencion?error=La%20venta%20se%20registró%2C%20pero%20no%20se%20obtuvo%20su%20código");
  redirect("/ventas/" + encodeURIComponent(result.sale_id) + "/comprobante?created=" + encodeURIComponent(result.sale_code || "1"));
}
