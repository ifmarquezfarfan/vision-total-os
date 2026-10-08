"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function roleLabel(role: string) {
  if (role === "owner") return "Dueña";
  if (role === "admin") return "Administrador";
  return "Empleado / Vendedora";
}

export async function updateBranchRole(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  const allowed = ["admin", "seller"];
  if (!branchId || !userId || !allowed.includes(role)) {
    redirect("/equipo?error=Perfil%20inválido");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect("/equipo?error=No%20tienes%20permiso%20para%20gestionar%20el%20equipo");
  }

  const { error } = await supabase
    .from("branch_members")
    .update({ role })
    .eq("branch_id", branchId)
    .eq("user_id", userId);

  if (error) {
    redirect("/equipo?error=No%20se%20pudo%20actualizar%20el%20perfil");
  }

  redirect("/equipo?updated=1");
}

export async function createBranch(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!name || !code) {
    redirect("/equipo?error=Nombre%20y%20código%20son%20obligatorios");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");
  if (!["owner", "admin"].includes(membership.role)) {
    redirect("/equipo?error=No%20tienes%20permiso%20para%20crear%20sucursales");
  }

  const { error } = await supabase.from("branches").insert({
    organization_id: membership.organization_id,
    name,
    code,
    active: true,
  });

  if (error) {
    redirect("/equipo?error=No%20se%20pudo%20crear%20la%20sucursal");
  }

  redirect("/equipo?branch_created=1");
}

export async function createInvitation(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const profile = String(formData.get("profile") ?? "seller");

  if (!email || !email.includes("@") || !["admin", "seller"].includes(profile)) {
    redirect("/equipo?error=Datos%20de%20invitación%20inválidos");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");
  if (!["owner", "admin"].includes(membership.role)) {
    redirect("/equipo?error=No%20tienes%20permiso%20para%20invitar%20miembros");
  }

  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!branch) {
    redirect("/equipo?error=Primero%20debe%20existir%20una%20sucursal");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const organizationRole = profile === "admin" ? "admin" : "member";
  const branchRole = profile === "admin" ? "admin" : "seller";

  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: membership.organization_id,
    branch_id: branch.id,
    email,
    organization_role: organizationRole,
    branch_role: branchRole,
    token_hash: tokenHash,
    status: "pending",
    invited_by: user.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    redirect("/equipo?error=No%20se%20pudo%20crear%20la%20invitación");
  }

  const h = await headers();
  const protocol = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const link = `${origin}/invitacion?token=${rawToken}`;

  redirect(`/equipo?invite_link=${encodeURIComponent(link)}&profile=${encodeURIComponent(roleLabel(profile))}`);
}
