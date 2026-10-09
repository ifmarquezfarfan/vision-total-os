import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { PrintButton } from "@/components/print-button";

const money=new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"});
const statusLabel:Record<string,string>={draft:"Borrador",sent:"Propuesta enviada",accepted:"Propuesta aceptada",rejected:"Rechazada",expired:"Vencida",converted:"Venta registrada",cancelled:"Cancelada"};

export default async function QuoteDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const {data:quote}=await supabase.from("quotes")
    .select("id,quote_code,quote_at,expires_at,client_id,subtotal,discount,total,status,notes,workflow_stage,quote_kind,requires_measurement,measurement_status,parent_quote_id,sale_id,organization_id,branch_id")
    .eq("id",id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle();
  if(!quote) redirect("/cotizaciones?error=Cotización%20no%20encontrada");
  const [{data:client},{data:items},{data:parent}] = await Promise.all([
    quote.client_id ? supabase.from("clients").select("full_name,dni,phone,whatsapp,email").eq("id",quote.client_id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle() : Promise.resolve({data:null}),
    supabase.from("quote_items").select("id,description,component_type,quantity,unit_price,discount,line_total").eq("quote_id",quote.id).order("id"),
    quote.parent_quote_id ? supabase.from("quotes").select("quote_code").eq("id",quote.parent_quote_id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle() : Promise.resolve({data:null})
  ]);
  const stageLabel=({initial_quote:"Cotización orientativa",measurement_pending:"Medición externa pendiente",measurement_received:"Medición recibida",final_quote:"Configuración final",sale_completed:"Venta registrada"} as Record<string,string>)[quote.workflow_stage]||quote.workflow_stage;

  return <div className="shell quote-print-shell"><Sidebar/><main className="main">
    <header className="topbar"><strong>Vista de cotización</strong><span className="muted">{user.email}</span></header>
    <div className="content quote-print-content">
      <div className="quote-print-actions">
        <Link href="/atencion" className="btn btn-secondary">← Atención óptica</Link>
        <Link href="/cotizaciones" className="btn btn-secondary">Cotizaciones</Link>
        <PrintButton/>
      </div>
      <article className="quote-document">
        <header className="quote-document-header">
          <div className="quote-document-brand"><div className="quote-document-mark">VT</div><div><strong>ÓPTICA VISIÓN TOTAL</strong><span>Asesoría visual y óptica</span></div></div>
          <div className="quote-document-number"><small>{quote.quote_kind==="final"?"COTIZACIÓN FINAL":"COTIZACIÓN INICIAL"}</small><h1>{quote.quote_code}</h1><span>{new Date(quote.quote_at).toLocaleDateString("es-PE")}</span></div>
        </header>
        <div className="quote-document-status"><span>{stageLabel}</span><span>{statusLabel[quote.status]||quote.status}</span>{parent&&<span>Basada en {parent.quote_code}</span>}</div>
        <section className="quote-document-client">
          <div><small>CLIENTE</small><strong>{client?.full_name||"Cliente"}</strong><span>{client?.dni?"Documento: "+client.dni:""}</span></div>
          <div><small>CONTACTO</small><span>{client?.whatsapp||client?.phone||"No registrado"}</span><span>{client?.email||""}</span></div>
          <div><small>VIGENCIA</small><span>{quote.expires_at?new Date(quote.expires_at).toLocaleDateString("es-PE"):"No indicada"}</span></div>
        </section>
        <section className="quote-document-intro">
          <h2>{quote.quote_kind==="final"?"Propuesta óptica final":"Propuesta óptica inicial"}</h2>
          <p>{quote.quote_kind==="final"?"Esta propuesta recoge la configuración seleccionada después de registrar las medidas disponibles. Verifica los datos de fabricación y la disponibilidad antes de confirmar el pedido.":"Esta propuesta ayuda a comparar monturas, lunas, materiales y tratamientos. Cuando requiera graduación, el precio y la configuración pueden confirmarse después de la medición externa."}</p>
        </section>
        <div className="quote-document-table table-wrap"><table><thead><tr><th>Producto / servicio</th><th>Tipo</th><th>Cant.</th><th>Precio unitario</th><th>Descuento</th><th>Total</th></tr></thead><tbody>
          {(items??[]).map(item=><tr key={item.id}><td>{item.description}</td><td>{({frame:"Montura",lens:"Lunas",treatment:"Tratamiento",service:"Servicio",accessory:"Accesorio",other:"Otro"} as Record<string,string>)[item.component_type]||item.component_type}</td><td>{Number(item.quantity)}</td><td>{money.format(Number(item.unit_price)||0)}</td><td>{money.format(Number(item.discount)||0)}</td><td>{money.format(Number(item.line_total)||0)}</td></tr>)}
          {!items?.length&&<tr><td colSpan={6}>No hay artículos en esta cotización.</td></tr>}
        </tbody></table></div>
        <section className="quote-document-totals"><div><span>Subtotal</span><strong>{money.format(Number(quote.subtotal)||0)}</strong></div><div><span>Descuento global</span><strong>{money.format(Number(quote.discount)||0)}</strong></div><div className="quote-document-grand-total"><span>TOTAL PROPUESTO</span><strong>{money.format(Number(quote.total)||0)}</strong></div></section>
        {quote.notes&&<section className="quote-document-notes"><h3>Notas y asesoría</h3><p>{quote.notes}</p></section>}
        <section className="quote-document-disclaimer">
          <strong>{quote.requires_measurement&&quote.measurement_status!=="received"?"Pendiente de medición":"Antes de confirmar"}</strong>
          <p>{quote.requires_measurement&&quote.measurement_status!=="received"?"Esta propuesta no sustituye la receta ni las medidas del profesional. La graduación, DP, alturas y configuración definitiva se revisarán al regresar de la medición externa.":"Confirma que la receta, las medidas, la montura y las especificaciones de la luna coincidan con lo revisado por el personal óptico y el laboratorio."}</p>
        </section>
        <footer className="quote-document-footer"><span>Óptica Visión Total · Arequipa</span><span>Documento de cotización, no comprobante fiscal.</span></footer>
      </article>
    </div>
  </main></div>;
}
