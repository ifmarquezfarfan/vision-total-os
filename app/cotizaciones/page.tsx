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

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Cotizaciones</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Cotizaciones</h1><p className="subtitle">Convierte una oportunidad en una venta sin perder el contexto comercial.</p>
    <QuickStart title="Inicio rápido de cotización" hint="Empieza con una estructura sugerida y deja claro qué debe ocurrir después." items={[
      {label:"Cotización óptica",href:"#nueva-cotizacion",description:"Montura + lunas + tratamiento",tone:"green"},
      {label:"Segundo / tercer par",href:"#nueva-cotizacion",description:"Agrega otro bloque de 3 líneas",tone:"blue"},
      {label:"Convertir a venta",href:"#historial-cotizaciones",description:"Cuando el cliente acepta",tone:"purple"},
      {label:"Seguimiento",href:"/seguimientos",description:"Agenda el contacto posterior",tone:"orange"}
    ]}/>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.created&&<p className="notice" style={{marginTop:18}}>Cotización creada: {params.created}</p>}
    {params.updated&&<p className="notice" style={{marginTop:18}}>Estado actualizado.</p>}
    {params.converted&&<p className="notice" style={{marginTop:18}}>Cotización convertida en venta: {params.converted}</p>}
    {params.deleted&&<p className="notice" style={{marginTop:18}}>Cotización eliminada.</p>}

    <section id="nueva-cotizacion" className="card section"><h2>Nueva cotización</h2><form action={createQuote} className="form">
      <div className="form-grid">
        <div className="field"><label>Cliente</label><select name="client_id" defaultValue=""><option value="">Sin cliente</option>{(clients??[]).map(c=><option key={c.id} value={c.id}>{c.full_name}{c.dni?` · ${c.dni}`:""}</option>)}</select></div>
        <div className="field"><label>Lead</label><select name="lead_id" defaultValue=""><option value="">Sin lead</option>{(leads??[]).map(l=><option key={l.id} value={l.id}>{l.lead_code} · {l.full_name}</option>)}</select></div>
        <div className="field"><label>Vigencia</label><input name="expires_at" type="date"/></div>
        <div className="field"><label>Descuento global</label><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Notas</label><input name="notes"/></div>
      </div>
      <QuoteBuilder products={products??[]}/>
    </form></section>

    <section id="historial-cotizaciones" className="section"><h2>Historial</h2><div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Lead</th><th>Total</th><th>Vence</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {(quotes??[]).map(q=><tr key={q.id}><td>{q.quote_code}</td><td>{new Date(q.quote_at).toLocaleDateString("es-PE")}</td><td>{q.client_id?clientMap.get(q.client_id)||"Cliente":"·"}</td><td>{q.lead_id?leadMap.get(q.lead_id)||"Lead":"·"}</td><td>S/ {Number(q.total).toFixed(2)}</td><td>{q.expires_at?new Date(q.expires_at).toLocaleDateString("es-PE"):"·"}</td>
        <td><span className={`status-badge ${q.status==="accepted"?"status-success":q.status==="sent"?"status-info":q.status==="converted"?"status-purple":q.status==="rejected"||q.status==="cancelled"?"status-danger":"status-warning"}`}>{({draft:"Borrador",sent:"Enviada",accepted:"Aceptada",rejected:"Rechazada",expired:"Vencida",converted:"Convertida",cancelled:"Cancelada"} as Record<string,string>)[q.status]||q.status}</span></td><td><div className="action-stack">
          <form action={updateQuoteStatus} className="inline"><input type="hidden" name="quote_id" value={q.id}/><select name="status" defaultValue={q.status}><option value="draft">Borrador</option><option value="sent">Enviada</option><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="expired">Vencida</option><option value="cancelled">Cancelada</option></select><button className="btn btn-secondary">Guardar</button></form>
          {!["converted","cancelled","rejected"].includes(q.status) && <form action={convertQuoteToSale} className="inline"><input type="hidden" name="quote_id" value={q.id}/><select name="payment_method" defaultValue=""><option value="">Pago</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select><input name="paid_amount" type="number" min="0" step="0.01" placeholder="Pagado"/><input name="responsible" placeholder="Responsable"/><button className="btn btn-primary">Convertir</button></form>}
        </div></td></tr>)}
      {!quotes?.length&&<tr><td colSpan={8} className="muted">Todavía no hay cotizaciones.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
