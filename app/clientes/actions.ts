"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createClientRecord(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const dni = String(formData.get("dni") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!fullName) redirect("/clientes?error=El%20nombre%20es%20obligatorio");

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .limit(1)
    .maybeSingle();

  const code = "CLI-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("clients").insert({
    client_code: code,
    full_name: fullName,
    dni: dni || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: email || null,
    organization_id: membership.organization_id,
    branch_id: branch?.branch_id ?? null
  });

  if (error) {
    redirect("/clientes?error=No%20se%20pudo%20guardar%20el%20cliente");
  }

  redirect("/clientes?created=1");
}