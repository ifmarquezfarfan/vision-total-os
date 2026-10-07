import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { bootstrapOrganization } from "./actions";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/dashboard");

  const params = await searchParams;

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <div className="logo-mark">VT</div>
        <h1 className="page-title" style={{ fontSize: 25 }}>Configurar Visión Total</h1>
        <p className="subtitle">Primero creamos la organización y la sucursal principal. Después empieza la operación.</p>

        {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}

        <form action={bootstrapOrganization} className="form" style={{ marginTop: 24 }}>
          <div className="field">
            <label>Nombre de la organización</label>
            <input name="name" defaultValue="Visión Total" required />
          </div>
          <div className="field">
            <label>Sucursal inicial</label>
            <input name="branch_name" defaultValue="Principal" required />
          </div>
          <button className="btn btn-primary">Crear estructura</button>
        </form>
      </section>
    </main>
  );
}