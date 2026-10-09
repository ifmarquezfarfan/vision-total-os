import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createQuote, updateQuoteStatus, deleteQuote } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { QuoteBuilder } from "@/components/quote-builder";
import { QuickStart } from "@/components/quick-start";
import { ClientIntakePicker } from "@/components/client-intake-picker";
import { CopyLinkButton } from "@/components/copy-link-button";
import { QuoteOptionsFields } from "@/components/quote-options-fields";

export default async function QuotesPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;updated?:string;converted?:string;deleted?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:clients},{data:leads},{data:products},{data:quotes}]=await Promise.all([
    supabase.from("clients").select("id,full_name,dni,phone,whatsapp").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("status","active").order("full_name").limit(800),
    supabase.from("leads").select("id,lead_code,full_name,stage").order("created_at",{ascending:false}).limit(300),
    supabase.from("products").select("id,product_code,category,brand,model,description,cost,sale_price").eq("active",true).order("brand").limit(300),
    supabase.from("quotes").select("id,quote_code,quote_at,expires_at,client_id,lead_id,subtotal,discount,total,status,sale_id,quote_kind,workflow_stage,measurement_status,parent_quote_id,share_token,share_enabled,share_expires_at").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("quote_at",{ascending:false}).limit(200)
  ]);

  const clientMap=new Map((clients??[]).map(c=>[c.id,c.full_name]));
  const leadMap=new Map((leads??[]).map(l=>[l.id,l.lead_code]));
  const params=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Cotizaciones</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Cotizaciones</h1><p className="subtitle">Primero registra al cliente y una propuesta orientativa de materiales, tratamientos y paquete. Después se añade la medición y se fija el precio definitivo en Atención óptica.</p>
    <QuickStart title="Inicio rápido de cotización" hint="Empieza con una estructura sugerida y deja claro qué debe ocurrir después." items={[
      {label:"Cotización óptica",href:"#nueva-cotizacion",description:"Montura + lunas + tratamiento",tone:"green"},
      {label:"Segundo / tercer par",href:"#nueva-cotizacion",description:"Agrega otro bloque de 3 líneas",tone:"blue"},
      {label:"Continuar atención",href:"/atencion",description:"Medición → final → pago",tone:"purple"},
      {label:"Seguimiento",href:"/seguimientos",description:"Agenda el contacto posterior",tone:"orange"}
    ]}/>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.created&&<p className="notice" style={{marginTop:18}}>Cotización creada: {params.created}</p>}
    {params.updated&&<p className="notice" style={{marginTop:18}}>Estado actualizado.</p>}
    {params.converted&&<p className="notice" style={{marginTop:18}}>Cotización convertida en venta: {params.converted}</p>}
    {params.deleted&&<p className="notice" style={{marginTop:18}}>Cotización eliminada.</p>}

    <section id="nueva-cotizacion" className="card section"><h2>Nueva cotización</h2><form action={createQuote} className="form">
      <div className="form-grid">
        <div className="field" style={{gridColumn:"span 2"}}><label>Cliente *</label><ClientIntakePicker clients={clients??[]}/></div>
        <div className="field"><label>Lead</label><select name="lead_id" defaultValue=""><option value="">Sin lead</option>{(leads??[]).map(l=><option key={l.id} value={l.id}>{l.lead_code} · {l.full_name}</option>)}</select></div>
        <div className="field"><label>Vigencia de cotización</label><input name="expires_at" type="date"/></div>
        <div className="field"><label>Descuento global (%)</label><input name="discount_percent" type="number" min="0" max="100" step="0.5" defaultValue="0"/><span className="field-hint">El sistema calcula el descuento en soles a partir del subtotal.</span></div>
        <div className="field"><label>Uso principal</label><select name="intended_use" defaultValue=""><option value="">Por determinar</option><option>Uso diario</option><option>Pantallas / oficina</option><option>Lectura</option><option>Conducción</option><option>Exterior / deporte</option><option>Ocupacional</option><option>Multifocal / progresivo</option><option>Otro</option></select></div>
        <div className="field"><label>Prioridad del cliente</label><select name="priority" defaultValue=""><option value="">Por determinar</option><option>Precio</option><option>Equilibrio precio-calidad</option><option>Calidad / duración</option><option>Diseño / estética</option><option>Comodidad / peso</option></select></div>
        <div className="field"><label>Presupuesto de referencia (S/)</label><input name="budget_reference" type="number" min="0" step="0.01" placeholder="Opcional"/></div>
        <div className="field"><label>Canal de la cotización</label><select name="sale_channel" defaultValue="Presencial"><option>Presencial</option><option>WhatsApp</option><option>Web</option><option>Otro</option></select></div>
        <div className="field" style={{gridColumn:"span 2"}}><label className="checkline"><input type="checkbox" name="share_quote" defaultChecked/> Generar enlace privado para compartir por WhatsApp o web</label><span className="field-hint">El enlace muestra los componentes y precios, caduca en 14 días y no revela el DNI ni datos internos.</span></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Necesidad / preferencia que explicó el cliente</label><textarea name="client_preference" rows={2} placeholder="Uso, comodidad, estilo, presupuesto o dudas a resolver"/></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Notas internas</label><input name="notes" placeholder="Detalles relevantes para la cotización"/></div>
      </div>
      <QuoteOptionsFields mode="initial"/>
      <QuoteBuilder products={products??[]} submitLabel="Guardar cotización inicial →"/>
    </form></section>

    <section id="historial-cotizaciones" className="section"><div className="spread"><div><h2>Historial</h2><p className="muted">La etapa indica qué toca hacer a continuación; el cobro final se completa en Atención al cliente.</p></div><Link href="/atencion" className="btn btn-secondary">Abrir flujo de atención</Link></div><div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Lead</th><th>Total</th><th>Vence</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {(quotes??[]).map(q=><tr key={q.id}><td>{q.quote_code}</td><td>{new Date(q.quote_at).toLocaleDateString("es-PE")}</td><td>{q.client_id?clientMap.get(q.client_id)||"Cliente":"·"}</td><td>{q.lead_id?leadMap.get(q.lead_id)||"Lead":"·"}</td><td>S/ {Number(q.total).toFixed(2)}</td><td>{q.expires_at?new Date(q.expires_at).toLocaleDateString("es-PE"):"·"}</td>
        <td><span className={"status-badge "+(q.workflow_stage==="sale_completed"?"status-success":q.workflow_stage==="final_quote"?"status-info":q.workflow_stage==="measurement_pending"?"status-warning":q.workflow_stage==="measurement_received"?"status-purple":"status-neutral")}>{({initial_quote:"Cotización inicial",measurement_pending:"Medición pendiente",measurement_received:"Medición recibida",final_quote:"Cotización final",sale_completed:"Venta completada",cancelled:"Cancelada"} as Record<string,string>)[q.workflow_stage]||q.workflow_stage}</span><div className="field-hint">{({initial_quote:"Enviar a medir",measurement_pending:"Esperar receta",measurement_received:"Preparar cotización final",final_quote:"Confirmar pago",sale_completed:"Operación finalizada"} as Record<string,string>)[q.workflow_stage]||""}</div></td><td><div className="action-stack">
          <form action={updateQuoteStatus} className="inline"><input type="hidden" name="quote_id" value={q.id}/><select name="status" defaultValue={q.status}><option value="draft">Borrador</option><option value="sent">Enviada</option><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="expired">Vencida</option><option value="cancelled">Cancelada</option></select><button className="btn btn-secondary">Guardar</button></form>
          {q.share_enabled&&q.share_token&&<div className="inline"><Link href={"/cotizacion/"+q.share_token} target="_blank" className="btn btn-secondary">Ver enlace</Link><CopyLinkButton path={"/cotizacion/"+q.share_token}/></div>}
          <Link href="/atencion" className="btn btn-primary">Continuar flujo →</Link>
        </div></td></tr>)}
      {!quotes?.length&&<tr><td colSpan={8} className="muted">Todavía no hay cotizaciones.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
