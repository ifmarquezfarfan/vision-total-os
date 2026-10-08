import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createLead } from "./actions";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
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

  if (!membership) redirect("/onboarding");

  const { data: leads } = await supabase
    .from("leads")
    .select("id, lead_code, full_name, phone, channel, product_interest, estimated_amount, stage, next_action_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Leads</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Leads</h1>
          <p className="subtitle">Oportunidades antes de convertirse en ventas.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Lead registrado correctamente.</p>}

          <section className="card section">
            <h2>Nuevo lead</h2>
            <form action={createLead} className="form">
              <div className="form-grid">
                <div className="field"><label>Nombre completo *</label><input name="full_name" required /></div>
                <div className="field"><label>Teléfono / WhatsApp</label><input name="phone" inputMode="tel" /></div>
                <div className="field"><label>Canal</label><select name="channel" defaultValue=""><option value="">Seleccionar</option><option>WhatsApp</option><option>Instagram</option><option>Facebook</option><option>Referido</option><option>Tienda</option><option>Otro</option></select></div>
                <div className="field"><label>Producto de interés</label><input name="product_interest" placeholder="Montura, lentes, etc." /></div>
                <div className="field"><label>Necesidad</label><input name="need" placeholder="Qué busca el cliente" /></div>
                <div className="field"><label>Monto estimado</label><input name="estimated_amount" type="number" min="0" step="0.01" /></div>
              </div>
              <div><button className="btn btn-primary">Guardar lead</button></div>
            </form>
          </section>

          <section className="section">
            <h2>Últimos leads</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Nombre</th><th>Canal</th><th>Interés</th><th>Estimado</th><th>Etapa</th></tr></thead>
                <tbody>
                  {(leads ?? []).map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.lead_code}</td>
                      <td>{lead.full_name}</td>
                      <td>{lead.channel || "·"}</td>
                      <td>{lead.product_interest || "·"}</td>
                      <td>{lead.estimated_amount ? `S/ ${Number(lead.estimated_amount).toFixed(2)}` : "·"}</td>
                      <td>{lead.stage}</td>
                    </tr>
                  ))}
                  {!leads?.length && <tr><td colSpan={6} className="muted">Todavía no hay leads registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
