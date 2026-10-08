"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateBranchRole(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const allowed = ["owner","admin","manager","seller","inventory","finance","viewer","clinical"];
  if (!branchId || !userId || !allowed.includes(role)) redirect("/equipo?error=Datos%20inválidos");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("branch_members").update({role}).eq("branch_id",branchId).eq("user_id",userId);
  if (error) redirect("/equipo?error=No%20se%20pudo%20actualizar%20el%20rol");
  redirect("/equipo?updated=1");
}
