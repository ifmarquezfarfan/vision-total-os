"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !branch) redirect("/onboarding");
  return { supabase, userId: user.id, organizationId: membership.organization_id, branchId: branch.branch_id };
}

export async function createClientRecord(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const dni = String(formData.get("dni") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const preferredChannel = String(formData.get("preferred_channel") ?? "").trim();
  const marketingOptIn = formData.get("marketing_opt_in") === "on";

  if (!fullName) redirect("/clientes?error=El%20nombre%20es%20obligatorio");

  const { supabase, organizationId, branchId } = await getContext();
  const code = "CLI-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("clients").insert({
    client_code: code,
    full_name: fullName,
    dni: dni || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: email || null,
    district: district || null,
    preferred_channel: preferredChannel || null,
    marketing_opt_in: marketingOptIn,
    organization_id: organizationId,
    branch_id: branchId
  });

  if (error) redirect("/clientes?error=No%20se%20pudo%20guardar%20el%20cliente");
  redirect("/clientes?created=1");
}

export async function updateClientRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/clientes?error=Cliente%20inválido");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const dni = String(formData.get("dni") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const preferredChannel = String(formData.get("preferred_channel") ?? "").trim();
  const marketingOptIn = formData.get("marketing_opt_in") === "on";

  if (!fullName) redirect("/clientes/" + encodeURIComponent(id) + "?error=El%20nombre%20es%20obligatorio");

  const { supabase } = await getContext();

  const { error } = await supabase.from("clients").update({
    full_name: fullName,
    dni: dni || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: email || null,
    district: district || null,
    preferred_channel: preferredChannel || null,
    marketing_opt_in: marketingOptIn
  }).eq("id", id);

  if (error) redirect("/clientes/" + encodeURIComponent(id) + "?error=No%20se%20pudo%20actualizar%20el%20cliente");
  redirect("/clientes/" + encodeURIComponent(id) + "?updated=1");
}
