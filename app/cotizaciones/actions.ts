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

  let clientId = String(formData.get("client_id") ?? "").trim() || null;
  const leadId = String(formData.get("lead_id") ?? "").trim() || null;
  const parentQuoteId = String(formData.get("parent_quote_id") ?? "").trim() || null;
  const newClientName = String(formData.get("new_client_name") ?? "").trim();
  const newClientDni = String(formData.get("new_client_dni") ?? "").trim();
  const newClientPhone = String(formData.get("new_client_phone") ?? "").trim();
  const newClientWhatsapp = String(formData.get("new_client_whatsapp") ?? "").trim();
  const newClientEmail = String(formData.get("new_client_email") ?? "").trim();
  const marketingOptIn = formData.get("marketing_opt_in") === "on";
  const requiresMeasurement = formData.get("measurement_required") !== "off";
  const discount = Number(formData.get("discount") ?? 0);
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId && newClientName) {
    if (!newClientPhone && !newClientWhatsapp) {
      redirect("/cotizaciones?error=Para%20crear%20la%20cartera%20desde%20la%20cotización%20ingresa%20un%20teléfono%20o%20WhatsApp");
    }
    if (newClientDni) {
      const { data: existingByDni } = await supabase.from("clients")
        .select("id,phone,whatsapp,email")
        .eq("organization_id", membership.organization_id)
        .eq("branch_id", branch.branch_id)
        .eq("dni", newClientDni)
        .limit(1)
        .maybeSingle();
      if (existingByDni) {
        clientId = existingByDni.id;
        await supabase.from("clients").update({
          phone: existingByDni.phone || newClientPhone || null,
          whatsapp: existingByDni.whatsapp || newClientWhatsapp || null,
          email: existingByDni.email || newClientEmail || null
        }).eq("id", existingByDni.id).eq("organization_id", membership.organization_id).eq("branch_id", branch.branch_id);
      }
    }
    if (!clientId) {
      const { data: createdClient, error: clientError } = await supabase.from("clients").insert({
        full_name: newClientName,
        dni: newClientDni || null,
        phone: newClientPhone || newClientWhatsapp || null,
        whatsapp: newClientWhatsapp || newClientPhone || null,
        email: newClientEmail || null,
        preferred_channel: newClientWhatsapp ? "WhatsApp" : "Llamada",
        marketing_opt_in: marketingOptIn,
        source: "Cotización",
        organization_id: membership.organization_id,
        branch_id: branch.branch_id
      }).select("id").single();
      if (clientError || !createdClient) redirect("/cotizaciones?error=No%20se%20pudo%20registrar%20el%20cliente");
      clientId = createdClient.id;
    }
  }

  if (!clientId) redirect("/cotizaciones?error=Selecciona%20un%20cliente%20o%20registra%20sus%20datos%20antes%20de%20cotizar");

  const { data: validatedClient } = await supabase.from("clients").select("id")
    .eq("id", clientId).eq("organization_id", membership.organization_id).eq("branch_id", branch.branch_id).maybeSingle();
  if (!validatedClient) redirect("/cotizaciones?error=El%20cliente%20no%20pertenece%20a%20esta%20sucursal");

  let parentQuote: {
    id: string; client_id: string | null; workflow_stage: string; measurement_status: string;
    prescription_id: string | null; measurement_provider: string | null; measurement_sent_at: string | null;
    measurement_received_at: string | null; measurement_notes: string | null;
  } | null = null;
  if (parentQuoteId) {
    const { data: parent } = await supabase.from("quotes")
      .select("id,client_id,workflow_stage,measurement_status,prescription_id,measurement_provider,measurement_sent_at,measurement_received_at,measurement_notes")
      .eq("id", parentQuoteId).eq("organization_id", membership.organization_id).eq("branch_id", branch.branch_id).maybeSingle();
    if (!parent || parent.workflow_stage !== "measurement_received" || parent.measurement_status !== "received" || !parent.prescription_id) {
      redirect("/atencion?error=Antes%20de%20cotizar%20la%20configuración%20final%20registra%20la%20medición%20externa");
    }
    if (parent.client_id !== clientId) redirect("/atencion?error=La%20cotización%20final%20debe%20conservar%20el%20cliente%20original");
    parentQuote = parent;
  }

  const itemCountRaw = Number(formData.get("item_count") ?? 0);
  const itemCount = Number.isFinite(itemCountRaw) ? Math.min(Math.max(Math.trunc(itemCountRaw), 1), 60) : 1;
  const items: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= itemCount; i++) {
    const productId = String(formData.get(`product_${i}`) ?? "").trim();
    const componentType = String(formData.get(`component_${i}`) ?? "other");
    const description = String(formData.get(`description_${i}`) ?? "").trim();
    const quantity = Number(formData.get(`quantity_${i}`) ?? 0);
    const price = Number(formData.get(`price_${i}`) ?? 0);
    const cost = Number(formData.get(`cost_${i}`) ?? 0);
    const itemDiscount = Number(formData.get(`discount_${i}`) ?? 0);
    if (!productId && !description && !price) continue;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
      redirect("/cotizaciones?error=Ítem%20inválido");
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
  if (error || !data || typeof data !== "object" || !("quote_id" in data)) {
    redirect("/cotizaciones?error=No%20se%20pudo%20crear%20la%20cotización");
  }
  const response = data as { quote_id: string; quote_code?: string };
  const quoteId = response.quote_id;
  const quoteCode = response.quote_code || "cotización";
  const stage = parentQuote ? "final_quote" : requiresMeasurement ? "initial_quote" : "final_quote";
  const metadata = {
    quote_kind: parentQuote || !requiresMeasurement ? "final" : "initial",
    workflow_stage: stage,
    requires_measurement: parentQuote ? true : requiresMeasurement,
    measurement_status: parentQuote ? "received" : requiresMeasurement ? "not_started" : "not_required",
    measurement_provider: parentQuote?.measurement_provider || null,
    measurement_sent_at: parentQuote?.measurement_sent_at || null,
    measurement_received_at: parentQuote?.measurement_received_at || null,
    measurement_notes: parentQuote?.measurement_notes || null,
    prescription_id: parentQuote?.prescription_id || null,
    parent_quote_id: parentQuote?.id || null,
    finalized_at: stage === "final_quote" ? new Date().toISOString() : null,
  };
  const { error: metadataError } = await supabase.from("quotes").update(metadata)
    .eq("id", quoteId).eq("organization_id", membership.organization_id).eq("branch_id", branch.branch_id);
  if (metadataError) redirect("/cotizaciones?error=La%20cotización%20se%20creó%20pero%20no%20se%20pudo%20actualizar%20su%20flujo");

  redirect("/atencion?created=" + encodeURIComponent(quoteCode) + (parentQuote ? "&final=1" : ""));
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
