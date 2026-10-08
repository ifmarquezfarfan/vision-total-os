import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateClientRecord, deleteClientRecord } from "../actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

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

  const [{ data: client }, { data: sales }, { data: followUps }, { data: leads }, { data: prescriptions }, { data: historySnapshots }, { data: membership }, { data: branch }] = await Promise.all([
    supabase.from("clients").select("id, client_code, full_name, dni, phone, whatsapp, email, district, preferred_channel, marketing_opt_in, status, created_at, last_purchase_at, last_contact_at, next_action, next_action_at, notes").eq("id", id).maybeSingle(),
    supabase.from("sales").select("id, sale_code, sale_at, total, payment_status").eq("client_id", id).order("sale_at", { ascending: false }).limit(20),
    supabase.from("follow_ups").select("id, followup_code, followup_type, channel, result, next_action, next_action_at, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("leads").select("id, lead_code, stage, product_interest, estimated_amount, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("prescriptions").select("id, exam_at, expires_at, rx_type, cylinder_notation, prescriber_name, prescriber_license, rx_source, od_sphere, od_cylinder, od_axis, od_add, os_sphere, os_cylinder, os_axis, os_add, od_near_sphere, od_near_cylinder, od_near_axis, os_near_sphere, os_near_cylinder, os_near_axis, od_prism_horizontal, od_prism_horizontal_base, od_prism_vertical, od_prism_vertical_base, os_prism_horizontal, os_prism_horizontal_base, os_prism_vertical, os_prism_vertical_base, pd, pd_od, pd_os, notes, created_at").eq("client_id", id).order("exam_at", { ascending: false }).limit(10),
    supabase.from("client_history_snapshots").select("id,last_purchase_at,purchase_type,frame_characteristics,lens_characteristics,frame_amount,lens_amount,total_amount,client_type,visit_count,next_action,observations,imported_at").eq("client_id",id).order("imported_at",{ascending:false}).limit(10),
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
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><a className="btn btn-secondary" href="/clientes">Volver a clientes</a><form action={deleteClientRecord}><input type="hidden" name="id" value={client.id}/><ConfirmSubmit message="Eliminar este cliente? Si tiene historial, se desactivará para conservar la trazabilidad.">Eliminar / desactivar</ConfirmSubmit></form></div>
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
                  const numericNames = ["od_sphere","od_cylinder","od_axis","od_add","os_sphere","os_cylinder","os_axis","os_add","od_near_sphere","od_near_cylinder","od_near_axis","os_near_sphere","os_near_cylinder","os_near_axis","od_prism_horizontal","od_prism_vertical","os_prism_horizontal","os_prism_vertical","pd","pd_od","pd_os"];
                  const numeric = (name: string) => { const raw=String(formData.get(name)??"").trim(); if (!raw) return null; const value=Number(raw); return Number.isFinite(value)?value:null; };
                  if (numericNames.some((name)=>String(formData.get(name)??"").trim()!==""&&!Number.isFinite(Number(formData.get(name))))) redirect("/clientes/"+id+"?error=Hay%20un%20valor%20numérico%20inválido%20en%20la%20receta");
                  const axisNames = ["od_axis","os_axis","od_near_axis","os_near_axis"];
                  if (axisNames.some((name)=>{const value=numeric(name);return value!==null&&(!Number.isInteger(value)||value<1||value>180);})) redirect("/clientes/"+id+"?error=El%20eje%20debe%20estar%20entre%201%20y%20180");
                  const prismPairs: Array<[string,string,string[]]> = [
                    ["od_prism_horizontal","od_prism_horizontal_base",["BI","BO"]],
                    ["od_prism_vertical","od_prism_vertical_base",["BU","BD"]],
                    ["os_prism_horizontal","os_prism_horizontal_base",["BI","BO"]],
                    ["os_prism_vertical","os_prism_vertical_base",["BU","BD"]]
                  ];
                  const invalidPrism = prismPairs.some(([amountName,baseName,allowed])=>{
                    const amount=numeric(amountName);
                    const base=String(formData.get(baseName)??"").trim();
                    return (amount!==null&&amount<0)||(base!==""&&!allowed.includes(base))||(amount!==null&&amount>0&&base==="")||(base!==""&&amount===null);
                  });
                  if(invalidPrism) redirect("/clientes/"+id+"?error=Completa%20el%20valor%20y%20la%20base%20del%20prisma");
                  const cylinderNotation = String(formData.get("cylinder_notation")??"negative");
                  if (!["negative","positive"].includes(cylinderNotation)) redirect("/clientes/"+id+"?error=Formato%20de%20cilindro%20inválido");
                  const pdValues = ["pd","pd_od","pd_os"].map(numeric).filter((v):v is number=>v!==null);
                  if (pdValues.some((value)=>value<=0||value>100)) redirect("/clientes/"+id+"?error=Revisa%20la%20distancia%20pupilar");
                  const { error } = await sb.from("prescriptions").insert({
                    organization_id: om.organization_id, branch_id: bm.branch_id, client_id: id,
                    exam_at: formData.get("exam_at") ? new Date(String(formData.get("exam_at"))).toISOString() : new Date().toISOString(),
                    expires_at: formData.get("expires_at") ? new Date(String(formData.get("expires_at"))).toISOString() : null,
                    rx_type:String(formData.get("rx_type")??"").trim()||null,
                    cylinder_notation:cylinderNotation,
                    prescriber_name:String(formData.get("prescriber_name")??"").trim()||null,
                    prescriber_license:String(formData.get("prescriber_license")??"").trim()||null,
                    rx_source:String(formData.get("rx_source")??"").trim()||null,
                    od_sphere:numeric("od_sphere"), od_cylinder:numeric("od_cylinder"), od_axis:numeric("od_axis"), od_add:numeric("od_add"),
                    os_sphere:numeric("os_sphere"), os_cylinder:numeric("os_cylinder"), os_axis:numeric("os_axis"), os_add:numeric("os_add"),
                    od_near_sphere:numeric("od_near_sphere"), od_near_cylinder:numeric("od_near_cylinder"), od_near_axis:numeric("od_near_axis"),
                    os_near_sphere:numeric("os_near_sphere"), os_near_cylinder:numeric("os_near_cylinder"), os_near_axis:numeric("os_near_axis"),
                    od_prism_horizontal:numeric("od_prism_horizontal"), od_prism_horizontal_base:String(formData.get("od_prism_horizontal_base")??"").trim()||null,
                    od_prism_vertical:numeric("od_prism_vertical"), od_prism_vertical_base:String(formData.get("od_prism_vertical_base")??"").trim()||null,
                    os_prism_horizontal:numeric("os_prism_horizontal"), os_prism_horizontal_base:String(formData.get("os_prism_horizontal_base")??"").trim()||null,
                    os_prism_vertical:numeric("os_prism_vertical"), os_prism_vertical_base:String(formData.get("os_prism_vertical_base")??"").trim()||null,
                    pd:numeric("pd"), pd_od:numeric("pd_od"), pd_os:numeric("pd_os"),
                    notes:String(formData.get("prescription_notes")??"").trim()||null,
                    created_by: currentUser.id
                  });
                  if (error) redirect("/clientes/"+id+"?error=No%20se%20pudo%20guardar%20la%20receta");
                  redirect("/clientes/"+id+"?updated=1");
                }} className="form">
                  <div className="form-grid">
                    <div className="field"><label>Fecha del examen</label><input name="exam_at" type="datetime-local" /></div>
                    <div className="field"><label>Vencimiento</label><input name="expires_at" type="date" /></div>
                    <div className="field"><label>Tipo / uso de receta</label><select name="rx_type" defaultValue=""><option value="">No especificado</option><option value="Lejos">Lejos</option><option value="Cerca">Cerca</option><option value="Lejos y cerca">Lejos y cerca</option><option value="Bifocal">Bifocal</option><option value="Progresivo">Progresivo</option><option value="Ocupacional">Ocupacional</option><option value="Otro">Otro</option></select></div>
                    <div className="field"><label>Formato de cilindro</label><select name="cylinder_notation" defaultValue="negative"><option value="negative">Cilindro negativo</option><option value="positive">Cilindro positivo</option></select><span className="field-hint">Transcribe el signo tal como aparece. No conviertas el formato por tu cuenta.</span></div>
                    <div className="field"><label>Profesional que prescribe</label><input name="prescriber_name" placeholder="Nombre y apellido" /></div>
                    <div className="field"><label>Colegiatura / registro</label><input name="prescriber_license" placeholder="N.º, si aparece" /></div>
                    <div className="field"><label>Origen del dato</label><select name="rx_source" defaultValue=""><option value="">Seleccionar</option><option value="Receta física">Receta física</option><option value="Receta digital">Receta digital</option><option value="Transcripción">Transcripción</option><option value="Otro">Otro</option></select></div>
                  </div>
                  <div className="card" style={{marginTop:14}}>
                    <h3>Graduación de lejos / principal</h3>
                    <p className="muted">Escribe cada valor y su signo exactamente como figura en la receta. Eje en grados (1–180).</p>
                    <div className="table-wrap"><table style={{minWidth:760}}><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje (°)</th><th>Adición (ADD)</th></tr></thead><tbody>
                      <tr><th>OD · Derecho</th><td><input aria-label="OD esfera" name="od_sphere" type="number" step="0.25" placeholder="+1.00" /></td><td><input aria-label="OD cilindro" name="od_cylinder" type="number" step="0.25" placeholder="-0.50" /></td><td><input aria-label="OD eje" name="od_axis" type="number" step="1" min="1" max="180" /></td><td><input aria-label="OD adición" name="od_add" type="number" step="0.25" /></td></tr>
                      <tr><th>OI · Izquierdo</th><td><input aria-label="OI esfera" name="os_sphere" type="number" step="0.25" placeholder="+1.00" /></td><td><input aria-label="OI cilindro" name="os_cylinder" type="number" step="0.25" placeholder="-0.50" /></td><td><input aria-label="OI eje" name="os_axis" type="number" step="1" min="1" max="180" /></td><td><input aria-label="OI adición" name="os_add" type="number" step="0.25" /></td></tr>
                    </tbody></table></div>
                  </div>
                  <div className="card" style={{marginTop:14}}>
                    <h3>Graduación de cerca (si la receta la especifica)</h3>
                    <p className="muted">Opcional. Si solo figura ADD, registra la ADD arriba. No calcules automáticamente la esfera de cerca.</p>
                    <div className="table-wrap"><table style={{minWidth:620}}><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje (°)</th></tr></thead><tbody>
                      <tr><th>OD · Derecho</th><td><input aria-label="OD esfera cerca" name="od_near_sphere" type="number" step="0.25" /></td><td><input aria-label="OD cilindro cerca" name="od_near_cylinder" type="number" step="0.25" /></td><td><input aria-label="OD eje cerca" name="od_near_axis" type="number" step="1" min="1" max="180" /></td></tr>
                      <tr><th>OI · Izquierdo</th><td><input aria-label="OI esfera cerca" name="os_near_sphere" type="number" step="0.25" /></td><td><input aria-label="OI cilindro cerca" name="os_near_cylinder" type="number" step="0.25" /></td><td><input aria-label="OI eje cerca" name="os_near_axis" type="number" step="1" min="1" max="180" /></td></tr>
                    </tbody></table></div>
                  </div>
                  <div className="card" style={{marginTop:14}}>
                    <h3>Prisma y base (opcional)</h3>
                    <p className="muted">Registra horizontal y vertical por separado cuando la receta lo indique. Base BI/BO = horizontal; BU/BD = vertical.</p>
                    <div className="form-grid">
                      <div className="field"><label>OD prisma horizontal (Δ)</label><input name="od_prism_horizontal" type="number" step="0.25" min="0" /></div>
                      <div className="field"><label>OD base horizontal</label><select name="od_prism_horizontal_base" defaultValue=""><option value="">Sin indicar</option><option value="BI">BI · Base interna</option><option value="BO">BO · Base externa</option></select></div>
                      <div className="field"><label>OD prisma vertical (Δ)</label><input name="od_prism_vertical" type="number" step="0.25" min="0" /></div>
                      <div className="field"><label>OD base vertical</label><select name="od_prism_vertical_base" defaultValue=""><option value="">Sin indicar</option><option value="BU">BU · Base arriba</option><option value="BD">BD · Base abajo</option></select></div>
                      <div className="field"><label>OI prisma horizontal (Δ)</label><input name="os_prism_horizontal" type="number" step="0.25" min="0" /></div>
                      <div className="field"><label>OI base horizontal</label><select name="os_prism_horizontal_base" defaultValue=""><option value="">Sin indicar</option><option value="BI">BI · Base interna</option><option value="BO">BO · Base externa</option></select></div>
                      <div className="field"><label>OI prisma vertical (Δ)</label><input name="os_prism_vertical" type="number" step="0.25" min="0" /></div>
                      <div className="field"><label>OI base vertical</label><select name="os_prism_vertical_base" defaultValue=""><option value="">Sin indicar</option><option value="BU">BU · Base arriba</option><option value="BD">BD · Base abajo</option></select></div>
                    </div>
                  </div>
                  <div className="card" style={{marginTop:14}}>
                    <h3>Distancia pupilar</h3>
                    <p className="muted">Registra milímetros. Si solo cuentas con la DP binocular, deja las monoculares vacías.</p>
                    <div className="form-grid">
                      <div className="field"><label>DP binocular (mm)</label><input name="pd" type="number" step="0.5" min="1" max="100" /></div>
                      <div className="field"><label>DP monocular OD (mm)</label><input name="pd_od" type="number" step="0.5" min="1" max="50" /></div>
                      <div className="field"><label>DP monocular OI (mm)</label><input name="pd_os" type="number" step="0.5" min="1" max="50" /></div>
                    </div>
                  </div>
                  <div className="field" style={{marginTop:14}}><label>Observaciones de receta</label><textarea name="prescription_notes" rows={3} placeholder="Indicaciones del profesional, adaptación o anotaciones sin reinterpretar la receta." /></div>
                  <button className="btn btn-primary">Guardar receta</button>
                </form>
              )}
              {!canWritePrescription && <p className="notice">Tu perfil puede consultar datos ópticos, pero no modificarlos.</p>}

              <div className="section">
                <div className="table-wrap"><table style={{minWidth: 1500}}><thead><tr><th>Examen</th><th>Uso / profesional</th><th>OD lejos</th><th>OI lejos</th><th>OD cerca</th><th>OI cerca</th><th>Prisma OD / OI</th><th>DP</th><th>Vence</th><th>Notas</th></tr></thead><tbody>
                  {(prescriptions ?? []).map((p) => <tr key={p.id}>
                    <td>{new Date(p.exam_at).toLocaleDateString("es-PE")}<div className="muted">{p.rx_source||"Origen no indicado"}</div></td>
                    <td>{p.rx_type||"·"}<div className="muted">{p.prescriber_name||"Profesional no indicado"}{p.prescriber_license?" · "+p.prescriber_license:""}</div><div className="muted">Cilindro {p.cylinder_notation==="positive"?"positivo":"negativo"}</div></td>
                    <td>{[p.od_sphere,p.od_cylinder,p.od_axis,p.od_add].map((v)=>v??"·").join(" / ")}</td>
                    <td>{[p.os_sphere,p.os_cylinder,p.os_axis,p.os_add].map((v)=>v??"·").join(" / ")}</td>
                    <td>{[p.od_near_sphere,p.od_near_cylinder,p.od_near_axis].map((v)=>v??"·").join(" / ")}</td>
                    <td>{[p.os_near_sphere,p.os_near_cylinder,p.os_near_axis].map((v)=>v??"·").join(" / ")}</td>
                    <td>OD H {p.od_prism_horizontal??"·"} {p.od_prism_horizontal_base||""}, V {p.od_prism_vertical??"·"} {p.od_prism_vertical_base||""}<br/>OI H {p.os_prism_horizontal??"·"} {p.os_prism_horizontal_base||""}, V {p.os_prism_vertical??"·"} {p.os_prism_vertical_base||""}</td>
                    <td>Bin. {p.pd??"·"}<div className="muted">OD {p.pd_od??"·"} · OI {p.pd_os??"·"}</div></td>
                    <td>{p.expires_at ? new Date(p.expires_at).toLocaleDateString("es-PE") : "·"}</td>
                    <td>{p.notes || "·"}</td>
                  </tr>)}
                  {!prescriptions?.length && <tr><td colSpan={10} className="muted">No hay recetas registradas.</td></tr>}
                </tbody></table></div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
