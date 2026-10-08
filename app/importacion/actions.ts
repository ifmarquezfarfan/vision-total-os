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

function parseFile(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(row)) {
      const normalizedKey = key(rawKey);
      if (rawValue instanceof Date) {
        normalized[normalizedKey] = rawValue.toISOString();
      } else if (typeof rawValue === "number" && /fecha|date|at$/.test(normalizedKey)) {
        const parsed = XLSX.SSF.parse_date_code(rawValue);
        if (parsed) {
          normalized[normalizedKey] = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0)).toISOString();
        } else {
          normalized[normalizedKey] = String(rawValue);
        }
      } else {
        normalized[normalizedKey] = String(rawValue ?? "").trim();
      }
    }
    return normalized;
  });
}

function truthy(value: string) {
  return ["true", "1", "si", "sí", "yes", "x"].includes(value.trim().toLowerCase());
}

function numberValue(value: string) {
  const normalized = value.replace(/[^0-9.,-]/g,"").replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function integerValue(value: string) {
  return Math.max(0, Math.floor(numberValue(value)));
}

function optionalDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function mapClientStatus(value: string) {
  const v = value.trim().toLowerCase();
  if (/inactiv|baja|perdido/.test(v)) return "inactive";
  return "active";
}

export async function importClientsFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/importacion?error=Adjunta%20un%20archivo%20Excel%20o%20CSV");
  if (file.size > 5_000_000) redirect("/importacion?error=El%20archivo%20supera%205MB");

  const { supabase, organizationId, branchId } = await getContext();

  let rows: Record<string, string>[] = [];
  try {
    rows = parseFile(await file.arrayBuffer());
  } catch {
    redirect("/importacion?error=No%20se%20pudo%20leer%20el%20archivo");
  }

  const get = (row: Record<string, string>, ...names: string[]) => {
    for (const name of names) {
      const value = row[key(name)] ?? "";
      if (value.trim()) return value.trim();
    }
    return "";
  };

  const clean = rows
    .filter((row) => get(row, "full_name", "nombre_completo", "nombre"))
    .slice(0, 1000);

  if (!clean.length) redirect("/importacion?error=No%20se%20encontraron%20filas%20válidas%20con%20nombre");

  const { data: existing } = await supabase
    .from("clients")
    .select("dni,client_code")
    .eq("organization_id", organizationId)
    .limit(5000);

  const existingDnis = new Set<string>();
  const existingCodes = new Set<string>();
  for (const item of existing ?? []) {
    if (item.dni) existingDnis.add(String(item.dni).trim());
    if (item.client_code) existingCodes.add(String(item.client_code).trim());
  }

  const seenDnis = new Set(existingDnis);
  const seenCodes = new Set(existingCodes);

  const payload = clean.flatMap((row) => {
    const sourceCode = get(row, "id_cliente", "codigo_cliente", "codigo");
    const dni = get(row, "dni");

    if (dni && seenDnis.has(dni)) return [];
    if (sourceCode && seenCodes.has(sourceCode)) return [];

    if (dni) seenDnis.add(dni);
    if (sourceCode) seenCodes.add(sourceCode);

    return [{
      client_code: /^VT-\d{1,8}$/i.test(sourceCode) ? sourceCode.toUpperCase() : "",
      full_name: get(row, "full_name", "nombre_completo", "nombre"),
      dni,
      phone: get(row, "phone", "telefono", "teléfono"),
      whatsapp: get(row, "whatsapp", "celular"),
      email: get(row, "email", "correo"),
      district: get(row, "district", "distrito"),
      preferred_channel: get(row, "preferred_channel", "canal_preferido", "canal"),
      marketing_opt_in: truthy(get(row, "marketing_opt_in", "autorizacion", "autorizado")),
      status: mapClientStatus(get(row, "estado_de_cliente", "estado_cliente", "status")),
      client_type: get(row, "tipo_de_cliente", "tipo_cliente", "client_type"),
      last_purchase_at: optionalDate(get(row, "fecha_ultima_compra", "ultima_compra", "last_purchase_at")),
      purchase_type: get(row, "tipo_de_compra", "purchase_type"),
      frame_characteristics: get(row, "marca_caracteristicas_de_monturas", "marca_caracteristicas_monturas", "monturas", "frame_characteristics"),
      lens_characteristics: get(row, "caracteristicas_de_lunas", "lunas", "lens_characteristics"),
      frame_amount: numberValue(get(row, "monto_monturas", "monto_montura", "frame_amount")),
      lens_amount: numberValue(get(row, "monto_lunas", "monto_luna", "lens_amount")),
      total_amount: numberValue(get(row, "monto_total_de_compra", "monto_total", "total_amount")),
      visit_count: integerValue(get(row, "compras_visitas", "compras", "visitas", "visit_count")),
      next_action: get(row, "proxima_accion", "próxima_accion", "next_action"),
      observations: get(row, "observaciones", "notes")
    }];
  });

  if (!payload.length) redirect("/importacion?error=No%20hay%20clientes%20nuevos%20para%20importar");

  const { data, error } = await supabase.rpc("import_clients_transaction", {
    target_org: organizationId,
    target_branch: branchId,
    rows: payload
  });

  if (error) redirect("/importacion?error=" + encodeURIComponent(error.message || "No se pudo importar la cartera"));

  const result = typeof data === "object" && data ? data as { imported?: number; skipped?: number } : {};
  redirect("/importacion?imported=" + encodeURIComponent(String(result.imported ?? payload.length)) + "&skipped=" + encodeURIComponent(String(result.skipped ?? 0)));
}

export async function importInventoryFile(formData: FormData) {
  const file = formData.get("inventory_file");
  if (!(file instanceof File)) redirect("/importacion?error=Adjunta%20un%20archivo%20de%20inventario");
  if (file.size > 5_000_000) redirect("/importacion?error=El%20archivo%20supera%205MB");

  const { supabase, organizationId, branchId } = await getContext();

  let rows: Record<string, string>[] = [];
  try {
    rows = parseFile(await file.arrayBuffer(), file.name);
  } catch {
    redirect("/importacion?error=No%20se%20pudo%20leer%20el%20inventario");
  }

  const get = (row: Record<string, string>, ...names: string[]) => {
    for (const name of names) {
      const value = row[key(name)] ?? "";
      if (value.trim()) return value.trim();
    }
    return "";
  };

  const clean = rows.slice(0, 1000).filter((row) =>
    get(row, "id_del_articulo", "id_articulo", "codigo", "codigo_producto", "product_code") ||
    get(row, "marca", "brand") ||
    get(row, "modelo_referencia", "modelo", "model")
  );

  if (!clean.length) redirect("/importacion?error=No%20se%20encontraron%20filas%20válidas%20de%20inventario");

  const { data: existing } = await supabase
    .from("products")
    .select("product_code")
    .eq("organization_id", organizationId)
    .limit(5000);

  const existingCodes = new Set((existing ?? []).map((item) => String(item.product_code).trim()).filter(Boolean));
  const seenCodes = new Set<string>();

  const payload = clean.flatMap((row) => {
    const rawCode = get(row, "id_del_articulo", "id_articulo", "codigo", "codigo_producto", "product_code");
    const code = rawCode && !seenCodes.has(rawCode) && !existingCodes.has(rawCode) ? rawCode : "";
    if (rawCode) seenCodes.add(rawCode);

    const rawCategory = get(row, "tipo_de_producto", "tipo_producto", "categoria", "category");
    const category =
      /montura|armaz/i.test(rawCategory) ? "Montura" :
      /luna|lente/i.test(rawCategory) ? "Lentes" :
      /tratamiento/i.test(rawCategory) ? "Tratamiento" :
      /accesorio/i.test(rawCategory) ? "Accesorio" :
      /servicio/i.test(rawCategory) ? "Servicio" : (rawCategory || "Montura");

    return [{
      product_code: code,
      brand: get(row, "marca", "brand"),
      model: get(row, "modelo_referencia", "modelo", "referencia", "model"),
      category,
      description: get(row, "descripcion", "description"),
      color: get(row, "color"),
      material: get(row, "material"),
      cost: numberValue(get(row, "precio_de_costo", "costo", "cost")),
      sale_price: numberValue(get(row, "precio_de_venta_actual", "precio_venta", "sale_price", "precio")),
      quantity: Math.max(0, Math.floor(numberValue(get(row, "unidades", "stock", "cantidad")))),
      min_stock: Math.max(0, Math.floor(numberValue(get(row, "stock_minimo", "min_stock")))),
      legacy_location: get(row, "ubicacion_actual", "ubicacion", "location"),
      displayed: booleanValue(get(row, "exhibida", "exhibido", "displayed")),
      physical_status: get(row, "estado_fisico", "estado") || "Bueno",
      notes: get(row, "observaciones", "notas", "notes"),
      entry_at: parseOptionalDate(get(row, "fecha_de_ingreso", "fecha_ingreso", "entry_at"))
    }];
  });

  const deduped = payload.filter((row, index) => {
    const code = row.product_code;
    return !code || payload.findIndex((candidate) => candidate.product_code === code) === index;
  });

  if (!deduped.length) redirect("/importacion?error=No%20hay%20artículos%20nuevos%20para%20importar");

  const { data, error } = await supabase.rpc("import_inventory_transaction", {
    target_org: organizationId,
    target_branch: branchId,
    rows: deduped
  });

  if (error) redirect("/importacion?error=" + encodeURIComponent(error.message || "No se pudo importar el inventario"));

  const result = typeof data === "object" && data ? data as { imported?: number; skipped?: number } : {};
  redirect("/importacion?inventory_imported=" + encodeURIComponent(String(result.imported ?? deduped.length)) + "&inventory_skipped=" + encodeURIComponent(String(result.skipped ?? 0)));
}

