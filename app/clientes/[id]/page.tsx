import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateClientRecord } from "../actions";

export default async function ClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: client }, { data: sales }, { data: followUps }, { data: leads }, { data: prescriptions }, { data: membership }, { data: branch }] = await Promise.all([
    supabase.from("clients").select("id, client_code, full_name, dni, phone, whatsapp, email, district, preferred_channel, marketing_opt_in, status, created_at, last_purchase_at, last_contact_at, next_action, next_action_at, notes").eq("id", id).maybeSingle(),
    supabase.from("sales").select("id, sale_code, sale_at, total, payment_status").eq("client_id", id).order("sale_at", { ascending: false }).limit(20),
    supabase.from("follow_ups").select("id, followup_code, followup_type, channel, result, next_action, next_action_at, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("leads").select("id, lead_code, stage, product_interest, estimated_amount, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("prescriptions").select("id, exam_at, expires_at, od_sphere, od_cylinder, od_axis, od_add, os_sphere, os_cylinder, os_axis, os_add, pd, notes, created_at").eq("client_id", id).order("exam_at", { ascending: false }).limit(10),
    supabase.from("organization_members").select("organization_id, role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
    supabase.from("branch_members").select("branch_id, role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle()
  ]);

  if (!client || !membership || !branch) redirect("/clientes?error=Cliente%20no%20encontrado");

  const canWritePrescription = membership.role === "owner" || membership.role === "admin" || branch.role === "clinical";

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Ficha del cliente</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <div className="spread">
            <div><h1 className="page-title">{client.full_name}</h1><p className="subtitle">{client.client_code} · desde {new Date(client.created_at).toLocaleDateString("es-PE")}</p></div>
            <a className="btn btn-secondary" href="/clientes">Volver a clientes</a>
          </div>

          {query.error && <p className="notice" style={{ marginTop: 18 }}>{query.error}</p>}
          {query.updated && <p className="notice" style={{ marginTop: 18 }}>Cliente actualizado.</p>}

          <section className="grid grid-3 section">
            <div className="card"><div className="metric-label">Última compra</div><div className="metric-value" style={{fontSize: 20}}>{client.last_purchase_at ? new Date(client.last_purchase_at).toLocaleDateString("es-PE") : "Nunca"}</div></div>
            <div className="card"><div className="metric-label">Comunicación comercial</div><div className="metric-value" style={{fontSize: 20}}>{client.marketing_opt_in ? "Autorizada" : "No autorizada"}</div></div>
            <div className="card"><div className="metric-label">Próxima acción</div><div className="metric-value" style={{fontSize: 16 }}>{client.next_action || "Sin acción definida"}</div></div>
          </section>

          <section className="card section">
            <h2>Datos</h2>
            <form action={updateClientRecord} className="form">
              <input type="hidden" name="id" value={client.id} />
              <div className="form-grid">
                <div className="field"><label>Nombre completo</label><input name="full_name" defaultValue={client.full_name} required /></div>
                <div className="field"><label>DNI</label><input name="dni" defaultValue={client.dni || ""} /></div>
                <div className="field"><label>Teléfono</label><input name="phone" defaultValue={client.phone || ""} /></div>
                <div className="field"><label>WhatsApp</label><input name="whatsapp" defaultValue={client.whatsapp || ""} /></div>
                <div className="field"><label>Correo</label><input name="email" type="email" defaultValue={client.email || ""} /></div>
                <div className="field"><label>Distrito</label><input name="district" defaultValue={client.district || ""} /></div>
                <div className="field"><label>Canal preferido</label><select name="preferred_channel" defaultValue={client.preferred_channel || ""}><option value="">Seleccionar</option><option>WhatsApp</option><option>Llamada</option><option>Instagram</option><option>Presencial</option></select></div>
              </div>
              <label className="checkline"><input type="checkbox" name="marketing_opt_in" defaultChecked={client.marketing_opt_in} /> Autoriza recibir comunicaciones comerciales y recordatorios</label>
              <button className="btn btn-primary">Guardar cambios</button>
            </form>
          </section>

          <section className="grid grid-3 section">
            <div className="card" style={{gridColumn:"span 2"}}>
              <h2>Historial de ventas</h2>
              <div className="table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Total</th><th>Pago</th></tr></thead><tbody>
                {(sales ?? []).map((s) => <tr key={s.id}><td>{s.sale_code}</td><td>{new Date(s.sale_at).toLocaleDateString("es-PE")}</td><td>S/ {Number(s.total).toFixed(2)}</td><td>{s.payment_status}</td></tr>)}
                {!sales?.length && <tr><td colSpan={4} className="muted">Sin ventas registradas.</td></tr>}
              </tbody></table></div>
            </div>
            <div className="card">
              <h2>Leads</h2>
              {(leads ?? []).map((l) => <div key={l.id} className="mini-row"><strong>{l.lead_code}</strong><span>{l.stage}</span></div>)}
              {!leads?.length && <p className="muted">Sin oportunidades asociadas.</p>}
            </div>
          </section>

          <section className="section">
            <h2>Seguimientos</h2>
            <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Canal</th><th>Resultado</th><th>Próxima acción</th><th>Estado</th></tr></thead><tbody>
              {(followUps ?? []).map((f) => <tr key={f.id}><td>{new Date(f.created_at).toLocaleString("es-PE")}</td><td>{f.followup_type}</td><td>{f.channel || "·"}</td><td>{f.result || "·"}</td><td>{f.next_action || "·"}</td><td>{f.status}</td></tr>)}
              {!followUps?.length && <tr><td colSpan={6} className="muted">Sin seguimientos registrados.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="section">
            <h2>Receta / datos ópticos</h2>
            <div className="card">
              {canWritePrescription && (
                <form action={async (formData) => {
                  "use server";
                  const sb = await createClient();
                  const { data: { user: currentUser } } = await sb.auth.getUser();
                  if (!currentUser) redirect("/login");
                  const { data: om } = await sb.from("organization_members").select("organization_id").eq("user_id", currentUser.id).eq("active", true).limit(1).maybeSingle();
                  const { data: bm } = await sb.from("branch_members").select("branch_id").eq("user_id", currentUser.id).eq("active", true).limit(1).maybeSingle();
                  if (!om || !bm) redirect("/onboarding");
                  const numeric = (name: string) => { const raw=String(formData.get(name)??"").trim(); return raw ? Number(raw) : null; };
                  const { error } = await sb.from("prescriptions").insert({
                    organization_id: om.organization_id, branch_id: bm.branch_id, client_id: id,
                    exam_at: formData.get("exam_at") ? new Date(String(formData.get("exam_at"))).toISOString() : new Date().toISOString(),
                    expires_at: formData.get("expires_at") ? new Date(String(formData.get("expires_at"))).toISOString() : null,
                    od_sphere:numeric("od_sphere"), od_cylinder:numeric("od_cylinder"), od_axis:numeric("od_axis"), od_add:numeric("od_add"),
                    os_sphere:numeric("os_sphere"), os_cylinder:numeric("os_cylinder"), os_axis:numeric("os_axis"), os_add:numeric("os_add"),
                    pd:numeric("pd"), notes:String(formData.get("prescription_notes")??"").trim()||null,
                    created_by: currentUser.id
                  });
                  if (error) redirect("/clientes/"+id+"?error=No%20se%20pudo%20guardar%20la%20receta");
                  redirect("/clientes/"+id+"?updated=1");
                }} className="form">
                  <div className="form-grid">
                    <div className="field"><label>Fecha del examen</label><input name="exam_at" type="datetime-local" /></div>
                    <div className="field"><label>Vencimiento</label><input name="expires_at" type="date" /></div>
                    <div className="field"><label>OD esfera</label><input name="od_sphere" type="number" step="0.25" /></div>
                    <div className="field"><label>OD cilindro</label><input name="od_cylinder" type="number" step="0.25" /></div>
                    <div className="field"><label>OD eje</label><input name="od_axis" type="number" step="1" min="0" max="180" /></div>
                    <div className="field"><label>OD adición</label><input name="od_add" type="number" step="0.25" /></div>
                    <div className="field"><label>OI esfera</label><input name="os_sphere" type="number" step="0.25" /></div>
                    <div className="field"><label>OI cilindro</label><input name="os_cylinder" type="number" step="0.25" /></div>
                    <div className="field"><label>OI eje</label><input name="os_axis" type="number" step="1" min="0" max="180" /></div>
                    <div className="field"><label>OI adición</label><input name="os_add" type="number" step="0.25" /></div>
                    <div className="field"><label>DP</label><input name="pd" type="number" step="0.5" /></div>
                    <div className="field"><label>Notas</label><input name="prescription_notes" /></div>
                  </div>
                  <button className="btn btn-primary">Guardar receta</button>
                </form>
              )}
              {!canWritePrescription && <p className="notice">Tu perfil puede consultar datos ópticos, pero no modificarlos.</p>}

              <div className="section">
                <div className="table-wrap"><table style={{minWidth: 1050}}><thead><tr><th>Examen</th><th>OD</th><th>OI</th><th>DP</th><th>Vence</th><th>Notas</th></tr></thead><tbody>
                  {(prescriptions ?? []).map((p) => <tr key={p.id}><td>{new Date(p.exam_at).toLocaleDateString("es-PE")}</td><td>{[p.od_sphere,p.od_cylinder,p.od_axis,p.od_add].map((v)=>v??"·").join(" / ")}</td><td>{[p.os_sphere,p.os_cylinder,p.os_axis,p.os_add].map((v)=>v??"·").join(" / ")}</td><td>{p.pd ?? "·"}</td><td>{p.expires_at ? new Date(p.expires_at).toLocaleDateString("es-PE") : "·"}</td><td>{p.notes || "·"}</td></tr>)}
                  {!prescriptions?.length && <tr><td colSpan={6} className="muted">No hay recetas registradas.</td></tr>}
                </tbody></table></div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
