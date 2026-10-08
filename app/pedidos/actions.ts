"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();

  if (!membership || !branch) redirect("/onboarding");

  const clientId = String(formData.get("client_id") ?? "") || null;
  const saleId = String(formData.get("sale_id") ?? "") || null;
  const status = String(formData.get("status") ?? "received");
  const lab = String(formData.get("lab") ?? "").trim();
  const promisedAtRaw = String(formData.get("promised_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId) redirect("/pedidos?error=El%20cliente%20es%20obligatorio");

  const code = "PED-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("optical_orders").insert({
    order_code: code,
    client_id: clientId,
    sale_id: saleId,
    status,
    lab: lab || null,
    promised_at: promisedAtRaw ? new Date(promisedAtRaw).toISOString() : null,
    notes: notes || null,
    organization_id: membership.organization_id,
    branch_id: branch.branch_id
  });

  if (error) redirect("/pedidos?error=No%20se%20pudo%20crear%20el%20pedido");
  redirect("/pedidos?created=" + encodeURIComponent(code));
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "received");
  if (!orderId) redirect("/pedidos?error=Pedido%20inválido");

  const supabase = await createClient();
  const { error } = await supabase.from("optical_orders").update({
    status,
    delivered_at: status === "delivered" ? new Date().toISOString() : null
  }).eq("id", orderId);

  if (error) redirect("/pedidos?error=No%20se%20pudo%20actualizar%20el%20pedido");
  redirect("/pedidos?updated=1");
}
