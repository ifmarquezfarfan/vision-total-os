"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [membershipRes, branchRes] = await Promise.all([
    supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
    supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
  ]);

  if (!membershipRes.data || !branchRes.data) redirect("/onboarding");
  return {
    supabase,
    user,
    organizationId: membershipRes.data.organization_id,
    branchId: branchRes.data.branch_id,
  };
}

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalNumber(formData: FormData, name: string): number | null {
  const raw = textValue(formData, name);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("Hay un valor numérico inválido en " + name.replaceAll("_", " ") + "."));
  }
  return value;
}

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value.length === 16 ? value + ":00-05:00" : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDateToEndIso(value: string) {
  if (!value) return null;
  const date = new Date(value + "T23:59:59-05:00");
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function friendlyError(message: string) {
  if (message.includes("Not authorized")) return "Tu usuario no tiene permiso para registrar ventas en esta sucursal.";
  if (message.includes("Client name and valid phone")) return "Completa el nombre y un teléfono válido del cliente.";
  if (message.includes("Invalid DNI")) return "El DNI debe tener exactamente 8 dígitos.";
  if (message.includes("Invalid WhatsApp phone")) return "Revisa el número de WhatsApp.";
  if (message.includes("Client identity ambiguous")) return "Hay más de una ficha con esos datos. Busca y selecciona la ficha correcta antes de continuar.";
  if (message.includes("Client identity conflict")) return "El DNI y el teléfono corresponden a fichas diferentes. Revisa los datos del cliente.";
  if (message.includes("Client not found or inactive")) return "La ficha del cliente no existe, está inactiva o pertenece a otra sucursal.";
  if (message.includes("Client not found")) return "El cliente seleccionado ya no está disponible.";
  if (message.includes("At least one prescription power")) return "Registra al menos una potencia de esfera o cilindro en la receta.";
  if (message.includes("Prescription type")) return "Selecciona el tipo o uso de receta.";
  if (message.includes("cylinder notation")) return "Selecciona el formato del cilindro.";
  if (message.includes("Axis must")) return "El eje debe ser un número entero entre 1° y 180°.";
  if (message.includes("pupillary distance")) return "Revisa la distancia pupilar.";
  if (message.includes("Prescription is required")) return "Para generar un pedido óptico debes registrar la receta.";
  if (message.includes("An optical order needs")) return "Selecciona una montura o unas lunas para crear el pedido de laboratorio.";
  if (message.includes("Frame product is invalid")) return "La montura seleccionada no corresponde a un producto activo de esta sucursal.";
  if (message.includes("Lens product is invalid")) return "Las lunas seleccionadas no corresponden a un producto activo de esta sucursal.";
  if (message.includes("Insufficient stock")) return "Stock insuficiente para uno de los productos seleccionados.";
  if (message.includes("Payment exceeds sale total")) return "El pago registrado supera el total real de la venta.";
  if (message.includes("Payment method is required")) return "Selecciona el medio de pago para registrar un adelanto.";
  if (message.includes("Product not found")) return "Uno de los productos ya no está disponible en esta sucursal.";
  if (message.includes("Lead not found")) return "El lead seleccionado ya no está disponible.";
  if (message.includes("Invalid sale item values")) return "Revisa cantidad, precio y descuento de los componentes.";
  if (message.includes("Invalid discount")) return "El descuento debe ser válido y no puede superar el subtotal.";
  return "No se pudo completar la venta. Revisa los datos e inténtalo de nuevo.";
}

export async function createCompleteOpticalSale(formData: FormData) {
  const { supabase, user, organizationId, branchId } = await getContext();

  const clientId = textValue(formData, "client_id") || null;
  const clientName = textValue(formData, "client_name");
  const clientDni = textValue(formData, "client_dni");
  const clientPhone = textValue(formData, "client_phone");
  const clientWhatsapp = textValue(formData, "client_whatsapp");
  const clientEmail = textValue(formData, "client_email");
  const marketingOptIn = formData.get("marketing_opt_in") === "on";

  if (!clientId) {
    const phoneDigits = clientPhone.replace(/\D/g, "");
    const whatsappDigits = clientWhatsapp.replace(/\D/g, "");
    if (!clientName || phoneDigits.length < 7 || phoneDigits.length > 15 ||
        !/^[+0-9 ()-]{7,20}$/.test(clientPhone)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Para registrar un cliente nuevo, completa el nombre y un teléfono válido."));
    }
    if (clientDni && !/^\d{8}$/.test(clientDni)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("El DNI debe tener exactamente 8 dígitos."));
    }
    if (clientWhatsapp && (!/^[+0-9 ()-]{7,20}$/.test(clientWhatsapp) || whatsappDigits.length < 7 || whatsappDigits.length > 15)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Revisa el número de WhatsApp."));
    }
    if (clientName.length > 160 || clientEmail.length > 200) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Uno de los datos del cliente supera la longitud permitida."));
    }
  }

  const recordPrescription = formData.get("record_prescription") === "on";
  const createOrder = formData.get("create_optical_order") === "on";

  const numericNames = [
    "od_sphere", "od_cylinder", "od_axis", "od_add",
    "os_sphere", "os_cylinder", "os_axis", "os_add", "pd",
  ];
  const rx: Record<string, string | number | null> = {};
  for (const name of numericNames) rx[name] = optionalNumber(formData, name);

  for (const name of ["od_sphere", "os_sphere"]) {
    const value = rx[name];
    if (value !== null && (Number(value) < -30 || Number(value) > 30)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("La esfera debe estar entre -30.00 y +30.00."));
    }
  }
  for (const name of ["od_cylinder", "os_cylinder"]) {
    const value = rx[name];
    if (value !== null && (Number(value) < -15 || Number(value) > 15)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("El cilindro debe estar entre -15.00 y +15.00."));
    }
  }
  for (const name of ["od_add", "os_add"]) {
    const value = rx[name];
    if (value !== null && (Number(value) < 0 || Number(value) > 10)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("La adición debe estar entre 0.00 y 10.00."));
    }
  }
  for (const name of ["od_axis", "os_axis"]) {
    const value = rx[name];
    if (value !== null && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 180)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("El eje debe ser un número entero entre 1° y 180°."));
    }
  }
  if (rx.pd !== null && (Number(rx.pd) <= 0 || Number(rx.pd) > 100)) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("La distancia pupilar debe ser mayor a 0 y no superar 100 mm."));
  }

  const rxType = textValue(formData, "rx_type");
  const cylinderNotation = textValue(formData, "cylinder_notation") || "negative";
  const prescriptionNotes = textValue(formData, "prescription_notes").slice(0, 2000);
  const prescriberName = textValue(formData, "prescriber_name").slice(0, 160);
  const prescriberLicense = textValue(formData, "prescriber_license").slice(0, 80);
  const rxSource = textValue(formData, "rx_source") || "Medición externa";

  if (recordPrescription) {
    if (!["Monofocal", "Lejos", "Cerca", "Lejos y cerca", "Bifocal", "Progresivo", "Ocupacional", "Otro"].includes(rxType)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Selecciona el tipo o uso de receta."));
    }
    if (!["negative", "positive"].includes(cylinderNotation)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Selecciona el formato del cilindro."));
    }
    if (![rx.od_sphere, rx.od_cylinder, rx.os_sphere, rx.os_cylinder].some((value) => value !== null)) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Registra al menos una potencia de esfera o cilindro en la receta."));
    }
  }

  const itemCountRaw = Number(formData.get("item_count") ?? 0);
  const itemCount = Number.isFinite(itemCountRaw) ? Math.min(Math.max(Math.trunc(itemCountRaw), 1), 60) : 1;
  const allowedComponents = new Set(["frame", "lens", "treatment", "service", "accessory", "other"]);
  const items: Array<Record<string, unknown>> = [];
  let estimatedSubtotal = 0;

  for (let i = 1; i <= itemCount; i++) {
    const productId = textValue(formData, `product_${i}`);
    const componentType = textValue(formData, `component_${i}`) || "other";
    const description = textValue(formData, `description_${i}`).slice(0, 500);
    const quantityRaw = textValue(formData, `quantity_${i}`);
    const priceRaw = textValue(formData, `price_${i}`);
    const costRaw = textValue(formData, `cost_${i}`);
    const discountRaw = textValue(formData, `discount_${i}`);
    if (!productId && !description && !priceRaw) continue;

    const quantity = Number(quantityRaw || 1);
    const unitPrice = Number(priceRaw);
    const unitCost = costRaw ? Number(costRaw) : 0;
    const discount = discountRaw ? Number(discountRaw) : 0;

    if (!allowedComponents.has(componentType) || !priceRaw ||
        !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(unitCost) || unitCost < 0 ||
        !Number.isFinite(discount) || discount < 0) {
      redirect("/ventas/nueva?error=" + encodeURIComponent("Revisa la cantidad, precio y descuento de cada componente."));
    }

    estimatedSubtotal += Math.max(quantity * unitPrice - discount, 0);
    items.push({
      product_id: productId || null,
      component_type: componentType,
      description: description || undefined,
      quantity,
      unit_price: unitPrice,
      unit_cost: unitCost,
      discount,
    });
  }

  if (!items.length) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("Agrega al menos un componente a la venta."));
  }

  const paidAmount = optionalNumber(formData, "paid_amount") ?? 0;
  const saleDiscount = optionalNumber(formData, "sale_discount") ?? 0;
  const paymentMethod = textValue(formData, "payment_method");
  const responsible = textValue(formData, "responsible").slice(0, 160) || user.email || "";
  if (paidAmount < 0) redirect("/ventas/nueva?error=" + encodeURIComponent("El pago no puede ser negativo."));
  if (saleDiscount < 0 || saleDiscount > estimatedSubtotal) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("El descuento global no puede ser negativo ni superar el subtotal estimado."));
  }
  if (paidAmount > 0 && !paymentMethod) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("Selecciona el medio de pago para registrar un adelanto."));
  }

  if (createOrder && !recordPrescription) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("Para crear un pedido de laboratorio debes registrar la receta."));
  }
  if (createOrder && !items.some((item) => item.component_type === "frame" || item.component_type === "lens")) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("Selecciona una montura o unas lunas para crear el pedido óptico."));
  }

  const examAt = localDateTimeToIso(textValue(formData, "exam_at"));
  const expiresAt = localDateToEndIso(textValue(formData, "expires_at"));
  const promisedAt = localDateToEndIso(textValue(formData, "promised_at"));
  const treatments = [...new Set(formData.getAll("treatments").map((value) => String(value).trim()).filter(Boolean))];

  const targetCustomer = clientId ? {} : {
    full_name: clientName,
    dni: clientDni,
    phone: clientPhone,
    whatsapp: clientWhatsapp,
    email: clientEmail,
    marketing_opt_in: marketingOptIn,
  };
  const targetPrescription = recordPrescription ? {
    ...rx,
    exam_at: examAt,
    expires_at: expiresAt,
    rx_type: rxType,
    cylinder_notation: cylinderNotation,
    prescription_notes: prescriptionNotes,
    prescriber_name: prescriberName,
    prescriber_license: prescriberLicense,
    rx_source: rxSource,
  } : {};
  const targetOrder = {
    lab: textValue(formData, "lab").slice(0, 160),
    lab_reference: textValue(formData, "lab_reference").slice(0, 120),
    lens_type: textValue(formData, "lens_type").slice(0, 160),
    lens_design: textValue(formData, "lens_design").slice(0, 120),
    lens_material: textValue(formData, "lens_material").slice(0, 120),
    lens_index: textValue(formData, "lens_index").slice(0, 20),
    lens_brand: textValue(formData, "lens_brand").slice(0, 120),
    treatments: treatments.join(" · "),
    promised_at: promisedAt,
    notes: textValue(formData, "order_notes").slice(0, 2000),
    measurements: {},
  };

  const { data, error } = await supabase.rpc("create_complete_optical_sale", {
    target_org: organizationId,
    target_branch: branchId,
    target_client: clientId,
    target_customer: targetCustomer,
    target_record_prescription: recordPrescription,
    target_prescription: targetPrescription,
    target_create_order: createOrder,
    target_order: targetOrder,
    target_lead: null,
    target_payment_method: paymentMethod || null,
    target_paid: paidAmount,
    target_discount: saleDiscount,
    target_responsible: responsible || null,
    items,
  });

  if (error) {
    redirect("/ventas/nueva?error=" + encodeURIComponent(friendlyError(error.message || "")));
  }

  const result = data as {
    sale_id?: string;
    sale_code?: string;
    client_id?: string;
    prescription_id?: string | null;
    order_id?: string | null;
    order_code?: string | null;
  } | null;

  if (!result?.sale_id) {
    redirect("/ventas/nueva?error=" + encodeURIComponent("La operación respondió sin un código de venta. Verifica el historial antes de intentarlo de nuevo."));
  }

  const query = new URLSearchParams({
    created: result.sale_code || "1",
  });
  if (result.order_id) query.set("order", result.order_id);
  redirect("/ventas/" + encodeURIComponent(result.sale_id) + "/comprobante?" + query.toString());
}
