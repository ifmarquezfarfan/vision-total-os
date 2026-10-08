"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!category || !description || !Number.isFinite(amount) || amount <= 0) {
    redirect("/finanzas?error=Completa%20categoría%2C%20descripción%20y%20monto");
  }

  const code = "GTO-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("expenses").insert({
    expense_code: code,
    organization_id: membership.organization_id,
    branch_id: branch.branch_id,
    category,
    description,
    amount,
    payment_method: paymentMethod || null,
    supplier_name: supplierName || null,
    responsible_user_id: user.id,
    notes: notes || null
  });

  if (error) redirect("/finanzas?error=No%20se%20pudo%20registrar%20el%20gasto");
  redirect("/finanzas?created=" + encodeURIComponent(code));
}
