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
  return { supabase, organizationId: membership.organization_id, branchId: branch.branch_id };
}

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/compras?error=El%20nombre%20del%20proveedor%20es%20obligatorio");
  const { supabase, organizationId } = await getContext();
  const { error } = await supabase.from("suppliers").insert({
    organization_id: organizationId,
    name,
    tax_id: String(formData.get("tax_id") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null
  });
  if (error) redirect("/compras?error=No%20se%20pudo%20guardar%20el%20proveedor");
  redirect("/compras?created_supplier=1");
}

export async function createPurchase(formData: FormData) {
  const { supabase, organizationId, branchId } = await getContext();
  const supplierId = String(formData.get("supplier_id") ?? "") || null;
  const discount = Number(formData.get("discount") ?? 0);
  const paidAmount = Number(formData.get("paid_amount") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const items = [];
  for (let i = 1; i <= 5; i++) {
    const productId = String(formData.get(`product_${i}`) ?? "");
    const description = String(formData.get(`description_${i}`) ?? "").trim();
    const quantity = Math.floor(Number(formData.get(`quantity_${i}`) ?? 0));
    const unitCost = Number(formData.get(`cost_${i}`) ?? 0);
    if (!productId && !description && !unitCost) continue;
    if (quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) redirect("/compras?error=Hay%20un%20ítem%20de%20compra%20inválido");
    items.push({ product_id: productId || null, description: description || undefined, quantity, unit_cost: unitCost });
  }
  if (!items.length) redirect("/compras?error=Agrega%20al%20menos%20un%20ítem");
  if (paidAmount > 0 && !paymentMethod) redirect("/compras?error=Selecciona%20el%20medio%20de%20pago");

  const { data, error } = await supabase.rpc("receive_purchase_transaction", {
    target_org: organizationId,
    target_branch: branchId,
    target_supplier: supplierId,
    target_discount: Number.isFinite(discount) && discount >= 0 ? discount : 0,
    target_paid: Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : 0,
    target_payment_method: paymentMethod || null,
    target_notes: notes || null,
    items
  });

  if (error) redirect("/compras?error=No%20se%20pudo%20registrar%20la%20compra");
  const purchaseCode = typeof data === "object" && data && "purchase_code" in data ? String((data as { purchase_code: string }).purchase_code) : "compra";
  redirect("/compras?created=" + encodeURIComponent(purchaseCode));
}
