"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !branch) redirect("/onboarding");
  return { supabase, organizationId: membership.organization_id, branchId: branch.branch_id };
}

export async function createLead(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const need = String(formData.get("need") ?? "").trim();
  const productInterest = String(formData.get("product_interest") ?? "").trim();
  const estimatedAmount = Number(formData.get("estimated_amount") ?? 0);

  if (!fullName) redirect("/leads?error=El%20nombre%20es%20obligatorio");

  const { supabase, organizationId, branchId } = await getContext();
  const code = "LED-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("leads").insert({
    lead_code: code,
    full_name: fullName,
    phone: phone || null,
    channel: channel || null,
    need: need || null,
    product_interest: productInterest || null,
    estimated_amount: Number.isFinite(estimatedAmount) && estimatedAmount > 0 ? estimatedAmount : null,
    organization_id: organizationId,
    branch_id: branchId,
    stage: "new"
  });

  if (error) redirect("/leads?error=No%20se%20pudo%20guardar%20el%20lead");
  redirect("/leads?created=1");
}
