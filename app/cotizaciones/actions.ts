"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createQuote(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  let clientId = String(formData.get("client_id") ?? "") || null;
  const leadId = String(formData.get("lead_id") ?? "") || null;
  const discount = Number(formData.get("discount") ?? 0);
  const newClientName = String(formData.get("new_client_full_name") ?? "").trim();
  const newClientDni = String(formData.get("new_client_dni") ?? "").trim();
  const newClientPhone = String(formData.get("new_client_phone") ?? "").trim();
  const newClientWhatsapp = String(formData.get("new_client_whatsapp") ?? "").trim();
  const newClientEmail = String(formData.get("new_client_email") ?? "").trim();
  const newClientSource = String(formData.get("new_client_source") ?? "Presencial").trim();
  const newClientMarketingOptIn = formData.get("new_client_marketing_opt_in") === "on";
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId && !newClientName) redirect("/cotizaciones?error=Busca%20un%20cliente%20registrado%20o%20completa%20los%20datos%20del%20nuevo%20cliente");
  if (!clientId && newClientDni && !/^\d{6,15}$/.test(newClientDni)) redirect("/cotizaciones?error=Revisa%20el%20documento%20del%20cliente");

  if (!clientId && newClientName) {
    if (newClientDni) {
      const { data: duplicate } = await supabase.from("clients").select("id").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("dni",newClientDni).maybeSingle();
      if (duplicate) redirect("/cotizaciones?error=Ya%20existe%20un%20cliente%20con%20ese%20documento.%20Selecciónalo%20en%20la%20lista.");
    }
    const { data: createdClient, error: clientError } = await supabase.from("clients").insert({
      full_name:newClientName,
      dni:newClientDni||null,
      phone:newClientPhone||null,
      whatsapp:newClientWhatsapp||null,
      email:newClientEmail||null,
      source:newClientSource||"Presencial",
      marketing_opt_in:newClientMarketingOptIn,
      preferred_channel:newClientWhatsapp?"WhatsApp":newClientEmail?"Email":null,
      organization_id:membership.organization_id,
      branch_id:branch.branch_id
    }).select("id").single();
    if (clientError || !createdClient) redirect("/cotizaciones?error=No%20se%20pudo%20crear%20la%20ficha%20del%20cliente");
    clientId=createdClient.id;
  }

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
    if (!priceRaw || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0 || price < 0) {
      redirect("/cotizaciones?error=Completa%20un%20precio%20válido%20para%20cada%20componente");
    }
    items.push({
      product_id: productId || null,
      component_type: componentType,
      description: description || undefined,
      quantity,
      unit_price: price,
      unit_cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
      discount: Number.isFinite(itemDiscount) && itemDiscount >= 0 ? itemDiscount : 0,
    });
  }

  if (!items.length) redirect("/cotizaciones?error=Agrega%20al%20menos%20un%20ítem");

  const { data, error } = await supabase.rpc("create_quote_transaction", {
    target_org: membership.organization_id,
    target_branch: branch.branch_id,
    target_client: clientId,
    target_lead: leadId,
    target_discount: Number.isFinite(discount) && discount >= 0 ? discount : 0,
    target_expires_at: expiresAtRaw ? new Date(expiresAtRaw + "T23:59:59").toISOString() : null,
    target_notes: notes || null,
    items,
  });

  if (error) redirect("/cotizaciones?error=No%20se%20pudo%20crear%20la%20cotización");
  const result = data as { quote_id?: string; quote_code?: string } | null;
  const quoteId = result?.quote_id;
  const code = result?.quote_code ? String(result.quote_code) : "cotización";
  if (!quoteId) redirect("/cotizaciones?error=La%20cotización%20se%20creó%20pero%20no%20pudo%20obtenerse%20su%20código");

  const configuration = {
    intended_use:String(formData.get("intended_use")??"").trim()||null,
    priority:String(formData.get("priority")??"").trim()||null,
    budget_reference:String(formData.get("budget_reference")??"").trim()||null,
    client_preference:String(formData.get("client_preference")??"").trim()||null,
    sale_channel:String(formData.get("sale_channel")??"Presencial").trim()||"Presencial"
  };
  const { error: workflowError } = await supabase.from("quotes").update({
    quote_kind:"initial",
    workflow_stage:"initial_quote",
    requires_measurement:true,
    measurement_status:"not_started",
    optical_configuration:configuration
  }).eq("id",quoteId).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id);
  if(workflowError) redirect("/cotizaciones?error=La%20cotización%20se%20creó%2C%20pero%20no%20se%20pudo%20actualizar%20su%20flujo");
  redirect("/atencion?created=" + encodeURIComponent(code));
}

export async function updateQuoteStatus(formData: FormData) {
  const id = String(formData.get("quote_id") ?? "");
  const status = String(formData.get("status") ?? "draft");
  const allowed = ["draft", "sent", "accepted", "rejected", "expired", "cancelled"];
  if (!id || !allowed.includes(status)) redirect("/cotizaciones?error=Datos%20inválidos");
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) redirect("/cotizaciones?error=No%20se%20pudo%20actualizar");
  redirect("/cotizaciones?updated=1");
}

export async function convertQuoteToSale(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const paid = Number(formData.get("paid_amount") ?? 0);
  const responsible = String(formData.get("responsible") ?? "").trim();
  if (!quoteId) redirect("/cotizaciones?error=Cotización%20inválida");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quote_to_sale_transaction", {
    target_quote: quoteId,
    target_payment_method: paymentMethod || null,
    target_paid: Number.isFinite(paid) && paid >= 0 ? paid : 0,
    target_responsible: responsible || null,
  });
  if (error) redirect("/cotizaciones?error=No%20se%20pudo%20convertir%20la%20cotización");
  const saleCode = typeof data === "object" && data && "sale_code" in data ? String((data as { sale_code: string }).sale_code) : "venta";
  redirect("/cotizaciones?converted=" + encodeURIComponent(saleCode));
}


export async function deleteQuote(formData: FormData) {
  const id = String(formData.get("quote_id") ?? "");
  if (!id) redirect("/cotizaciones?error=Cotización%20inválida");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const { data: quote } = await supabase.from("quotes").select("id,status,sale_id").eq("id", id).eq("organization_id", membership.organization_id).eq("branch_id", branch.branch_id).maybeSingle();
  if (!quote) redirect("/cotizaciones?error=Cotización%20no%20encontrada");
  if (quote.sale_id || !["draft","cancelled","rejected","expired"].includes(quote.status)) {
    redirect("/cotizaciones?error=Solo%20se%20pueden%20eliminar%20cotizaciones%20sin%20venta");
  }

  const { error } = await supabase.from("quotes").delete()
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .eq("branch_id", branch.branch_id);

  if (error) redirect("/cotizaciones?error=No%20se%20pudo%20eliminar%20la%20cotización");
  redirect("/cotizaciones?deleted=1");
}
