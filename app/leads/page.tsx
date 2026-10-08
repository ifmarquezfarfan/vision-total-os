import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { QuickStart } from "@/components/quick-start";
import { createLead, updateLeadStage } from "./actions";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{ data: clients }, { data: leads }] = await Promise.all([
    supabase.from("clients").select("id,full_name,dni").order("full_name").limit(300),
    supabase.from("leads").select("id,lead_code,client_id,full_name,phone,channel,product_interest,estimated_amount,stage,next_action,next_action_at,created_at").order("created_at",{ascending:false}).limit(200)
  ]);

  const clientMap = new Map((clients ?? []).map(c => [c.id,c.full_name]));
  const params = await searchParams;
  const stageName: Record<string,string> = {new:"Nuevo",contacted:"Contactado",interested:"Interesado",quoted:"Cotizado",pending:"Pendiente",won:"Ganado",lost:"Perdido"};

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Leads</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Leads</h1>
          <p className="subtitle">Oportunidades antes de convertirse en ventas.</p>
          <QuickStart title="Inicio rápido de leads" hint="Lead = oportunidad. Cuando ya compra, el registro definitivo pasa a Ventas." items={[
            {label:"Nuevo lead",href:"#nuevo-lead",description:"Captura oportunidad",tone:"blue"},
            {label:"Cotizar",href:"/cotizaciones",description:"Convierte interés en propuesta",tone:"purple"},
            {label:"Vender",href:"/ventas",description:"Cierra la operación",tone:"green"},
            {label:"Dar seguimiento",href:"/seguimientos",description:"Define próxima acción",tone:"orange"}
          ]}/>

          {params.error && <p className="notice" style={{marginTop:18}}>{params.error}</p>}
          {params.created && <p className="notice" style={{marginTop:18}}>Lead registrado correctamente.</p>}
          {params.updated && <p className="notice" style={{marginTop:18}}>Lead actualizado.</p>}

          <section id="nuevo-lead" className="card section">
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
              <button className="btn btn-primary">Guardar lead</button>
            </form>
          </section>

          <section className="section">
            <h2>Pipeline</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Lead</th><th>Cliente</th><th>Interés</th><th>Estimado</th><th>Etapa</th><th>Próxima acción</th></tr></thead>
                <tbody>
                  {(leads ?? []).map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.lead_code}</td>
                      <td>{lead.full_name}</td>
                      <td>{lead.client_id ? clientMap.get(lead.client_id) || "Cliente" : "Prospecto"}</td>
                      <td>{lead.product_interest || "·"}</td>
                      <td>{lead.estimated_amount ? `S/ ${Number(lead.estimated_amount).toFixed(2)}` : "·"}</td>
                      <td>
                        <form action={updateLeadStage} className="inline">

                          <input type="hidden" name="lead_id" value={lead.id} />
                          <select name="stage" defaultValue={lead.stage}>
                            {Object.entries(stageName).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <span className={`status-badge ${lead.stage==="won"?"status-success":lead.stage==="lost"?"status-danger":lead.stage==="quoted"?"status-info":"status-warning"}`}>{stageName[lead.stage]||lead.stage}</span>
                          <button className="btn btn-secondary">Guardar</button>
                        </form>
                      </td>
                      <td>{lead.next_action || "·"}{lead.next_action_at ? <><br/><span className="muted">{new Date(lead.next_action_at).toLocaleDateString("es-PE")}</span></> : null}</td>
                    </tr>
                  ))}
                  {!leads?.length && <tr><td colSpan={7} className="muted">Todavía no hay leads registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
