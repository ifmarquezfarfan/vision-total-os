"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateBranchRole(formData: FormData) {
  const branchId=String(formData.get("branch_id")??"");
  const userId=String(formData.get("user_id")??"");
  const role=String(formData.get("role")??"");
  const allowed=["owner","admin","manager","seller","inventory","finance","viewer","clinical"];
  if(!branchId||!userId||!allowed.includes(role)) redirect("/equipo?error=Datos%20inválidos");

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {error}=await supabase.from("branch_members").update({role}).eq("branch_id",branchId).eq("user_id",userId);
  if(error) redirect("/equipo?error=No%20se%20pudo%20actualizar%20el%20rol");
  redirect("/equipo?updated=1");
}

export async function createBranch(formData: FormData) {
  const name=String(formData.get("name")??"").trim();
  const code=String(formData.get("code")??"").trim().toUpperCase();
  if(!name||!code) redirect("/equipo?error=Nombre%20y%20código%20son%20obligatorios");

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership) redirect("/onboarding");

  const {error}=await supabase.from("branches").insert({
    organization_id:membership.organization_id,
    name,code,active:true
  });

  if(error) redirect("/equipo?error=No%20se%20pudo%20crear%20la%20sucursal");
  redirect("/equipo?branch_created=1");
}
