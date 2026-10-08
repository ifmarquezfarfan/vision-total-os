"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createFollowUp(formData: FormData) {
  const type = String(formData.get("followup_type") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const result = String(formData.get("result") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const nextActionAt = String(formData.get("next_action_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!type) redirect("/seguimientos?error=El%20tipo%20es%20obligatorio");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !branch) redirect("/onboarding");

  const code = "SEG-" + Date.now().toString().slice(-8);

  const { error } = await supabase.from("follow_ups").insert({
    followup_code: code,
    followup_type: type,
    channel: channel || null,
    result: result || null,
    next_action: nextAction || null,
    next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
    status: nextAction ? "open" : "completed",
    notes: notes || null,
    organization_id: membership.organization_id,
    branch_id: branch.branch_id
  });

  if (error) redirect("/seguimientos?error=No%20se%20pudo%20guardar%20el%20seguimiento");
  redirect("/seguimientos?created=1");
}
