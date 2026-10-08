"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function registerPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const saleId = String(formData.get("sale_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!saleId || !Number.isFinite(amount) || amount <= 0 || !method) {
    redirect("/ventas/" + saleId + "?error=Datos%20de%20pago%20inválidos");
  }

  const { error } = await supabase.rpc("register_sale_payment", {
    target_sale: saleId,
    amount,
    method,
    reference: reference || null,
    payment_note: notes || null
  });

  if (error) redirect("/ventas/" + saleId + "?error=No%20se%20pudo%20registrar%20el%20pago");
  redirect("/ventas/" + saleId + "?paid=1");
}
