"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field.trim()); field = ""; }
    else if (ch === '\n') { row.push(field.trim()); field = ""; if (row.some(Boolean)) rows.push(row); row = []; }
    else if (ch !== '\r') field += ch;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function key(value: string) {
  return value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

export async function importClientsCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/importacion?error=Adjunta%20un%20CSV");
  if (file.size > 2_000_000) redirect("/importacion?error=El%20archivo%20supera%202MB");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const rows = parseCsv(await file.text());
  if (rows.length < 2) redirect("/importacion?error=El%20CSV%20no%20contiene%20datos");

  const headers = rows[0].map(key);
  const findIndex = (a: string, b: string) => headers.indexOf(a) >= 0 ? headers.indexOf(a) : headers.indexOf(b);
  const nameIndex = findIndex("full_name", "nombre_completo");
  if (nameIndex < 0) redirect("/importacion?error=Falta%20la%20columna%20full_name");

  const dniIndex = headers.indexOf("dni");
  const phoneIndex = headers.indexOf("phone");
  const whatsappIndex = headers.indexOf("whatsapp");
  const emailIndex = headers.indexOf("email");
  const districtIndex = headers.indexOf("district");
  const preferredIndex = headers.indexOf("preferred_channel");
  const optInIndex = headers.indexOf("marketing_opt_in");

  const clean = rows.slice(1).filter(r => r[nameIndex]?.trim()).slice(0, 1000);
  const existingDnis = new Set<string>();

  if (clean.some(r => r[dniIndex]?.trim())) {
    const { data: existing } = await supabase.from("clients").select("dni").eq("organization_id", membership.organization_id).not("dni", "is", null).limit(5000);
    for (const row of existing ?? []) if (row.dni) existingDnis.add(String(row.dni).trim());
  }

  const payload = clean.flatMap((r, i) => {
    const dni = dniIndex >= 0 ? r[dniIndex]?.trim() : "";
    if (dni && existingDnis.has(dni)) return [];
    return [{
      client_code: "CLI-IMP-" + Date.now().toString().slice(-6) + "-" + String(i + 1).padStart(3, "0"),
      full_name: r[nameIndex].trim(),
      dni: dni || null,
      phone: phoneIndex >= 0 ? (r[phoneIndex]?.trim() || null) : null,
      whatsapp: whatsappIndex >= 0 ? (r[whatsappIndex]?.trim() || null) : null,
      email: emailIndex >= 0 ? (r[emailIndex]?.trim() || null) : null,
      district: districtIndex >= 0 ? (r[districtIndex]?.trim() || null) : null,
      preferred_channel: preferredIndex >= 0 ? (r[preferredIndex]?.trim() || null) : null,
      marketing_opt_in: optInIndex >= 0 ? ["true","1","si","sí","yes"].includes((r[optInIndex] ?? "").trim().toLowerCase()) : false,
      organization_id: membership.organization_id,
      branch_id: branch.branch_id
    }];
  });

  if (!payload.length) redirect("/importacion?error=No%20hay%20clientes%20nuevos%20para%20importar");
  const { error } = await supabase.from("clients").insert(payload);
  if (error) redirect("/importacion?error=No%20se%20pudo%20importar%20el%20archivo");
  redirect("/importacion?imported=" + encodeURIComponent(String(payload.length)));
}
