"use server";

import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function key(value: string) {
  return value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  return { supabase, userId: user.id, organizationId: membership.organization_id, branchId: branch.branch_id };
}

function parseFile(buffer: ArrayBuffer, fileName: string): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(row)) {
      normalized[key(rawKey)] = String(rawValue ?? "").trim();
    }
    return normalized;
  });
}

function truthy(value: string) {
  return ["true", "1", "si", "sí", "yes", "x"].includes(value.trim().toLowerCase());
}

export async function importClientsFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/importacion?error=Adjunta%20un%20archivo%20Excel%20o%20CSV");
  if (file.size > 5_000_000) redirect("/importacion?error=El%20archivo%20supera%205MB");

  const { supabase, organizationId, branchId } = await getContext();

  let rows: Record<string, string>[] = [];
  try {
    rows = parseFile(await file.arrayBuffer(), file.name);
  } catch {
    redirect("/importacion?error=No%20se%20pudo%20leer%20el%20archivo");
  }

  const clean = rows
    .filter((row) => (row.full_name || row.nombre_completo || "").trim())
    .slice(0, 1000);

  if (!clean.length) redirect("/importacion?error=No%20se%20encontraron%20filas%20válidas%20con%20nombre");

  const get = (row: Record<string, string>, ...names: string[]) => {
    for (const name of names) {
      const value = row[key(name)] ?? "";
      if (value.trim()) return value.trim();
    }
    return "";
  };

  const dniValues = clean.map((row) => get(row, "dni")).filter(Boolean);
  const existingDnis = new Set<string>();

  if (dniValues.length) {
    const { data: existing } = await supabase
      .from("clients")
      .select("dni")
      .eq("organization_id", organizationId)
      .not("dni", "is", null)
      .limit(5000);

    for (const item of existing ?? []) {
      if (item.dni) existingDnis.add(String(item.dni).trim());
    }
  }

  const seenDnis = new Set(existingDnis);
  const payload = clean.flatMap((row) => {
    const dni = get(row, "dni");
    if (dni && seenDnis.has(dni)) return [];
    if (dni) seenDnis.add(dni);

    return [{
      full_name: get(row, "full_name", "nombre_completo", "nombre"),
      dni: dni || null,
      phone: get(row, "phone", "telefono", "teléfono") || null,
      whatsapp: get(row, "whatsapp", "celular") || null,
      email: get(row, "email", "correo") || null,
      district: get(row, "district", "distrito") || null,
      preferred_channel: get(row, "preferred_channel", "canal_preferido", "canal") || null,
      marketing_opt_in: truthy(get(row, "marketing_opt_in", "autorizacion", "autorizado")),
      organization_id: organizationId,
      branch_id: branchId
    }];
  });

  if (!payload.length) redirect("/importacion?error=No%20hay%20clientes%20nuevos%20para%20importar");

  const { error } = await supabase.from("clients").insert(payload);
  if (error) redirect("/importacion?error=No%20se%20pudo%20importar%20el%20archivo");

  redirect("/importacion?imported=" + encodeURIComponent(String(payload.length)));
}
