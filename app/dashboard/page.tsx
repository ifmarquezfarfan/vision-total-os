import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const [{ count: clients }, { count: leads }, { count: sales }, { count: followUps }] =
    await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("sales").select("*", { count: "exact", head: true }),
      supabase.from("follow_ups").select("*", { count: "exact", head: true })
    ]);

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Centro de control</strong>
          <span className="muted">{user.email}</span>
        </header>

        <div className="content">
          <h1 className="page-title">Buenos días. Aquí empieza el sistema.</h1>
          <p className="subtitle">Una sola memoria para clientes, ventas, seguimiento e inventario.</p>

          <section className="grid grid-4 section">
            <div className="card"><div className="metric-label">Clientes</div><div className="metric-value">{clients ?? 0}</div></div>
            <div className="card"><div className="metric-label">Leads</div><div className="metric-value">{leads ?? 0}</div></div>
            <div className="card"><div className="metric-label">Ventas</div><div className="metric-value">{sales ?? 0}</div></div>
            <div className="card"><div className="metric-label">Seguimientos</div><div className="metric-value">{followUps ?? 0}</div></div>
          </section>

          <section className="section card">
            <h2>Arquitectura inicial</h2>
            <p className="muted">
              Visión Total OS ya está conectado a autenticación y preparado para trabajar sobre la base central de Supabase.
              El siguiente crecimiento será convertir cada módulo en una pieza operativa real.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}