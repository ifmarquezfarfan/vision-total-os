import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createQuote, updateQuoteStatus, convertQuoteToSale, deleteQuote } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { QuoteBuilder } from "@/components/quote-builder";
import { QuickStart } from "@/components/quick-start";

export default async function QuotesPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;updated?:string;converted?:string;deleted?:string;from_quote?:string;stage?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:clients},{data:leads},{data:products},{data:quotes}]=await Promise.all([
    supabase.from("clients").select("id,full_name,dni,phone,whatsapp,email").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("status","active").order("full_name").limit(500),
    supabase.from("leads").select("id,lead_code,full_name,stage").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("created_at",{ascending:false}).limit(300),
    supabase.from("products").select("id,product_code,category,brand,model,description,cost,sale_price,lens_design,lens_material,lens_index,lens_phi_mm,lens_coatings,lens_sphere_min,lens_sphere_max,lens_cylinder_min,lens_cylinder_max").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("active",true).order("brand").limit(500),
    supabase.from("quotes").select("id,quote_code,quote_at,expires_at,client_id,lead_id,subtotal,discount,total,status,sale_id,workflow_stage,quote_kind,measurement_status,requires_measurement,parent_quote_id").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("quote_at",{ascending:false}).limit(150)
  ]);

  const clientMap=new Map((clients??[]).map(c=>[c.id,c.full_name]));
  const leadMap=new Map((leads??[]).map(l=>[l.id,l.lead_code]));
  const params=await searchParams;
  const parentId=String(params.from_quote??"");
  const [{data:parentQuote},{data:parentItems}]=parentId?await Promise.all([
    supabase.from("quotes").select("id,quote_code,client_id,workflow_stage,measurement_status,prescription_id,notes,discount,measurement_provider").eq("id",parentId).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle(),
    supabase.from("quote_items").select("product_id,component_type,description,quantity,unit_price,unit_cost,discount").eq("quote_id",parentId).order("id")
  ]):[{data:null},{data:null}];
  const parentClient=parentQuote?.client_id?(clients??[]).find(c=>c.id===parentQuote.client_id):null;
  const finalMode=Boolean(parentId);

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>{finalMode?"Configuración final":"Cotización inicial"}</strong><span className="muted">{user.email}</span></header><div className="content quote-workspace">
    <div className="quote-flow-header">
      <div><div className="eyebrow">ATENCIÓN ÓPTICA · PASO 1 DE 4</div><h1 className="page-title">{finalMode?"Cerrar configuración y precio":"Entender opciones y cotizar"}</h1><p className="subtitle">{finalMode?"Con las medidas ya registradas, confirma la combinación final y prepara el cobro.":"Registra al cliente desde el primer contacto y presenta una propuesta orientativa antes de enviarlo a medirse."}</p></div>
      <a href="/atencion" className="btn btn-secondary">← Volver al flujo</a>
    </div>
    <div className="quote-steps" aria-label="Proceso de venta">
      <div className="quote-step active"><span>1</span><div><strong>Cotización</strong><small>{finalMode?"Final":"Inicial"}</small></div></div>
      <div className={"quote-step "+(finalMode?"done":"")}><span>2</span><div><strong>Medición externa</strong><small>{finalMode?"Recibida":"Después de aceptar"}</small></div></div>
      <div className={"quote-step "+(finalMode?"active":"")}><span>3</span><div><strong>Configuración final</strong><small>{finalMode?"Confirmar productos":"Con medidas correctas"}</small></div></div>
      <div className="quote-step"><span>4</span><div><strong>Pago y comprobante</strong><small>Al confirmar compra</small></div></div>
    </div>
    {params.error&&<p className="notice notice-error section">{params.error}</p>}
    {parentId&&!parentQuote&&<div className="notice notice-error section">No encontramos una cotización válida para configurar. Vuelve a Atención óptica y revisa su estado.</div>}
    {finalMode&&parentQuote&&<div className="notice quote-context-notice section"><strong>Configuración final a partir de {parentQuote.quote_code}</strong><span>Cliente: {parentClient?.full_name||"Cliente"} · La medición queda vinculada. Se copiaron los productos de la cotización inicial para ajustar solo lo necesario.</span></div>}

    <section id="nueva-cotizacion" className="card section quote-form-card">
      <div className="quote-section-head"><div><span className="eyebrow">{finalMode?"PASO 3":"PASO 1"}</span><h2>{finalMode?"Revisar la combinación definitiva":"Datos del cliente y propuesta inicial"}</h2><p className="muted">{finalMode?"Verifica materiales, diseño, precio y tratamientos con la receta ya recibida.":"Primero identifica a la persona. La cotización puede quedar como estimación hasta recibir la medición correcta."}</p></div></div>
      <form action={createQuote} className="form">
        {finalMode&&parentQuote&&<><input type="hidden" name="parent_quote_id" value={parentQuote.id}/><input type="hidden" name="quote_kind" value="final"/><input type="hidden" name="client_id" value={parentQuote.client_id||""}/></>}
        {!finalMode&&<div className="quote-client-intake">
          <div className="field"><label>Cliente registrado *</label><select name="client_id" defaultValue=""><option value="">Buscar cliente por nombre o DNI</option>{(clients??[]).map(c=><option key={c.id} value={c.id}>{c.full_name}{c.dni?" · "+c.dni:""}{c.whatsapp?" · "+c.whatsapp:""}</option>)}</select><span className="field-hint">Si es nuevo, regístralo aquí. La cotización queda en su cartera desde el primer contacto.</span></div>
          <details className="quote-new-client"><summary><span><strong>＋ Registrar nuevo cliente</strong><small>Nombre y contacto para guardar la cotización</small></span><span className="lens-spec-chevron">＋</span></summary>
            <div className="form-grid">
              <div className="field"><label>Nombre completo *</label><input name="new_client_name" autoComplete="name" placeholder="Nombre y apellidos"/></div>
              <div className="field"><label>DNI / documento (opcional)</label><input name="new_client_dni" inputMode="numeric" maxLength={15} placeholder="Documento de identidad"/></div>
              <div className="field"><label>WhatsApp</label><input name="new_client_whatsapp" type="tel" autoComplete="tel" placeholder="+51…"/></div>
              <div className="field"><label>Teléfono alternativo</label><input name="new_client_phone" type="tel" placeholder="Teléfono de contacto"/></div>
              <div className="field"><label>Correo (opcional)</label><input name="new_client_email" type="email" autoComplete="email" placeholder="cliente@correo.com"/></div>
              <label className="checkline"><input type="checkbox" name="marketing_opt_in"/> Acepta recibir novedades/promociones. No marcar sin autorización expresa.</label>
            </div>
          </details>
        </div>}
        <div className="form-grid">
          {!finalMode&&<div className="field"><label>Lead relacionado (opcional)</label><select name="lead_id" defaultValue=""><option value="">Sin lead</option>{(leads??[]).map(l=><option key={l.id} value={l.id}>{l.lead_code} · {l.full_name}</option>)}</select></div>}
          <div className="field"><label>Vigencia de la propuesta</label><input name="expires_at" type="date"/></div>
          <div className="field"><label>Descuento global (S/)</label><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></div>
          {!finalMode&&<div className="quote-measurement-toggle"><label className="checkline"><input type="checkbox" name="measurement_required" defaultChecked/> Requiere medición / receta externa antes de fijar precio final</label><span className="field-hint">Déjalo marcado para lentes oftálmicos. Desmárcalo en accesorios, reparaciones u operaciones sin graduación.</span></div>}
          <div className="field" style={{gridColumn:"1 / -1"}}><label>Notas para el cliente / asesoría dada</label><textarea name="notes" rows={2} defaultValue={finalMode?parentQuote?.notes||"":""} placeholder={finalMode?"Ajustes tras medir, elección final y recomendaciones.":"Uso del lente, preferencias, presupuesto, materiales o alternativas explicadas."}/></div>
        </div>
        <div className="quote-builder-intro"><span className="eyebrow">PROPUESTA ECONÓMICA</span><h3>{finalMode?"Productos elegidos con medidas confirmadas":"Arma la cotización que el cliente verá"}</h3><p className="muted">{finalMode?"Ajusta la combinación copiada de la propuesta inicial. Confirma disponibilidad y especificaciones antes de cerrar.":"Explica las opciones de montura, lunas, materiales y tratamientos. Si aún no hay receta, indica que el importe es orientativo."}</p></div>
        <QuoteBuilder products={products??[]} initialItems={finalMode?(parentItems??[]):[]}/>
        {finalMode&&<div className="notice quote-context-notice"><strong>Importante:</strong> esta cotización final conserva el vínculo con la medición externa. El cobro se registra después de que el cliente confirme.</div>}
        <div className="quote-form-footer"><a href="/atencion" className="btn btn-secondary">Volver al flujo</a><button className="btn btn-primary">{finalMode?"Guardar cotización final → Ir a pago":"Guardar cotización inicial → Continuar flujo"}</button></div>
      </form>
    </section>
    <section id="historial-cotizaciones" className="section">
      <div className="spread"><div><h2>Cotizaciones recientes</h2><p className="muted">La propuesta inicial y la final se conservan como historial.</p></div><a href="/atencion" className="link-strong">Abrir flujo completo →</a></div>
      <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Estado del proceso</th><th>Estado</th></tr></thead><tbody>
        {(quotes??[]).map(q=><tr key={q.id}><td>{q.quote_code}</td><td>{new Date(q.quote_at).toLocaleDateString("es-PE")}</td><td>{q.client_id?clientMap.get(q.client_id)||"Cliente":"·"}</td><td>{q.quote_kind==="final"?"Final":"Inicial"}</td><td>S/ {Number(q.total).toFixed(2)}</td><td><span className={"status-badge "+(q.workflow_stage==="sale_completed"?"status-success":q.workflow_stage==="measurement_pending"?"status-warning":q.workflow_stage==="final_quote"?"status-info":"status-purple")}>{({initial_quote:"Cotización inicial",measurement_pending:"Esperando medición",measurement_received:"Medición recibida",final_quote:"Lista para cobrar",sale_completed:"Venta registrada",cancelled:"Cancelada"} as Record<string,string>)[q.workflow_stage]||q.workflow_stage}</span></td><td>{({draft:"Borrador",sent:"Enviada",accepted:"Aceptada",rejected:"Rechazada",expired:"Vencida",converted:"Convertida",cancelled:"Cancelada"} as Record<string,string>)[q.status]||q.status}</td></tr>)}
        {!quotes?.length&&<tr><td colSpan={7} className="muted">Todavía no hay cotizaciones.</td></tr>}
      </tbody></table></div>
    </section>
  </div></main></div>;
}
