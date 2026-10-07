"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function bootstrapOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "Visión Total").trim();
  const branchName = String(formData.get("branch_name") ?? "Principal").trim();

  const supabase = await createClient();

  const { error } = await supabase.rpc("bootstrap_organization", {
    org_name: name,
    org_slug: "vision-total",
    branch_name: branchName,
    branch_code: "VT-01"
  });

  if (error) {
    redirect("/onboarding?error=No%20se%20pudo%20crear%20la%20organización");
  }

  redirect("/dashboard");
}