import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createFollowUp } from "./actions";

export default async function FollowUpsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const [{ data: clients }, { data: leads }, { data: followUps }] = await Promise.all([
    supabase.from("clients").select("id, full_name, dni").order("full_name").limit(300),
    supabase.from("leads").select("id, lead_code, full_name, stage").order("created_at", { ascending: false }).limit(300),
    supabase.from("follow_ups").select("id, followup_code, client_id, lead_id, followup_type, channel, result, next_action, next_action_at, status, created_at").order("created_at", { ascending: false }).limit(150)
  ]);

  const params = await searchParams;
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.full_name]));
  const leadMap = new Map((leads ?? []).map(l => [l.id, l.lead_code]));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Seguimientos</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Seguimientos</h1>
          <p className="subtitle">La agenda comercial: cada interacción deja una próxima acción o un cierre.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Seguimiento registrado correctamente.</p>}

          <section className="card section">
            <h2>Registrar interacción</h2>
            <form action={createFollowUp} className="form">
              <div className="form-grid">
                <div className="field"><label>Cliente</label><select name="client_id" defaultValue=""><option value="">Sin cliente</option>{(clients ?? []).map(c => <option key={c.id} value={c.id}>{c.full_name}{c.dni ? ` · ${c.dni}` : ""}</option>)}</select></div>
                <div className="field"><label>Lead</label><select name="lead_id" defaultValue=""><option value="">Sin lead</option>{(leads ?? []).map(l => <option key={l.id} value={l.id}>{l.lead_code} · {l.full_name}</option>)}</select></div>
                <div className="field"><label>Tipo *</label><select name="followup_type" defaultValue="" required><option value="">Seleccionar</option><option>Postventa</option><option>Cotización</option><option>Reactivación</option><option>Renovación</option><option>Incidencia</option><option>Interés</option><option>Referido</option></select></div>
                <div className="field"><label>Canal</label><select name="channel" defaultValue=""><option value="">Seleccionar</option><option>WhatsApp</option><option>Llamada</option><option>Presencial</option><option>Instagram</option><option>Otro</option></select></div>
                <div className="field"><label>Resultado</label><input name="result" placeholder="Qué ocurrió" /></div>
                <div className="field"><label>Próxima acción</label><input name="next_action" placeholder="Ej. escribir en 7 días" /></div>
                <div className="field"><label>Fecha próxima acción</label><input name="next_action_at" type="datetime-local" /></div>
                <div className="field"><label>Notas</label><input name="notes" placeholder="Detalle adicional" /></div>
              </div>
              <button className="btn btn-primary">Registrar seguimiento</button>
            </form>
          </section>

          <section className="section">
            <h2>Historial</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Cliente / Lead</th><th>Tipo</th><th>Canal</th><th>Resultado</th><th>Próxima acción</th><th>Estado</th></tr></thead>
                <tbody>
                  {(followUps ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.followup_code}</td>
                      <td>{item.client_id ? clientMap.get(item.client_id) : item.lead_id ? leadMap.get(item.lead_id) : "·"}</td>
                      <td>{item.followup_type}</td>
                      <td>{item.channel || "·"}</td>
                      <td>{item.result || "·"}</td>
                      <td>{item.next_action || "·"}{item.next_action_at ? <><br/><span className="muted">{new Date(item.next_action_at).toLocaleString("es-PE")}</span></> : null}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                  {!followUps?.length && <tr><td colSpan={7} className="muted">Todavía no hay seguimientos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
