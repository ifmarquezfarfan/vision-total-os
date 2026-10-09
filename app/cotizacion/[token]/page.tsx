import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

type SharedItem = {
  description?:string|null;
  component_type?:string|null;
  quantity?:number|string|null;
  unit_price?:number|string|null;
  discount?:number|string|null;
  line_total?:number|string|null;
};
type SharedQuote = {
  quote_code:string;
  quote_kind:string;
  workflow_stage:string;
  status:string;
  quote_at:string;
  expires_at:string|null;
  share_expires_at:string|null;
  total:number|string;
  items:SharedItem[];
};

const currency=(value:unknown)=>"S/ "+Number(value||0).toFixed(2);
const componentLabel:Record<string,string>={
  frame:"Montura",lens_od:"Lunas · ojo derecho (OD)",lens_os:"Lunas · ojo izquierdo (OI)",
  lens:"Lunas",treatment:"Tratamiento",service:"Servicio",accessory:"Accesorio",other:"Componente"
};

export default async function PublicQuotePage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  if(!/^[a-f0-9]{48}$/.test(token)) notFound();
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("get_shared_quote",{target_token:token});
  if(error||!data||typeof data!=="object") notFound();
  const quote=data as unknown as SharedQuote;
  if(!quote.quote_code||!Array.isArray(quote.items)) notFound();

  const isFinal=quote.quote_kind==="final"&&quote.workflow_stage==="final_quote";
  const isCompleted=quote.workflow_stage==="sale_completed"||quote.status==="converted";
  const label=isFinal?"Cotización final": "Cotización inicial";
  const statusLabel:Record<string,string>={
    initial_quote:"Propuesta orientativa",measurement_pending:"Medición externa pendiente",
    measurement_received:"Medición recibida · falta fijar precio final",final_quote:"Lista para confirmar",
    sale_completed:"Compra completada"
  };
  const total=Number(quote.total||0);
  return <main className="public-quote-page">
    <header className="public-quote-header">
      <div className="public-quote-brand"><span>VT</span><div><strong>ÓPTICA VISIÓN TOTAL</strong><small>Propuesta óptica personalizada</small></div></div>
      <span className="public-quote-security"><span/> Enlace privado</span>
    </header>
    <div className="public-quote-content">
      <div className="public-quote-eyebrow">COTIZACIÓN · {quote.quote_code}</div>
      <div className="public-quote-hero">
        <div><h1>{label}</h1><p>Esta propuesta reúne los componentes y precios que conversaste con el equipo de Visión Total.</p></div>
        <span className={"public-quote-type "+(isFinal?"final":"initial")}>{isFinal?"Precio final":"Precio orientativo"}</span>
      </div>
      <section className="public-quote-status">
        <div><small>ESTADO DE LA ATENCIÓN</small><strong>{statusLabel[quote.workflow_stage]||"En revisión"}</strong></div>
        <div><small>EMITIDA</small><strong>{new Date(quote.quote_at).toLocaleDateString("es-PE",{year:"numeric",month:"short",day:"numeric"})}</strong></div>
        <div><small>VIGENCIA</small><strong>{quote.expires_at?new Date(quote.expires_at).toLocaleDateString("es-PE"):"Consultar con la óptica"}</strong></div>
      </section>
      <section className="public-quote-card">
        <div className="public-quote-card-title"><div><h2>Detalle de la propuesta</h2><p>{quote.items.length} componente(s) considerados</p></div><PrintButton label="Imprimir / guardar PDF"/></div>
        <div className="table-wrap public-quote-table-wrap"><table className="public-quote-table"><thead><tr><th>Componente</th><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>
          {quote.items.map((item,index)=><tr key={index}>
            <td><span className="public-quote-component">{componentLabel[item.component_type||"other"]||"Componente"}</span></td>
            <td>{item.description||"Componente óptico"}</td>
            <td>{Number(item.quantity||0)}</td>
            <td>{currency(item.unit_price)}</td>
            <td><strong>{currency(item.line_total)}</strong></td>
          </tr>)}
          {!quote.items.length&&<tr><td colSpan={5}>No hay componentes visibles en esta propuesta.</td></tr>}
        </tbody></table></div>
        <div className="public-quote-total"><span>{isFinal?"Total de la cotización final":"Total orientativo"}</span><strong>{currency(total)}</strong></div>
        {!isFinal&&<div className="public-quote-provisional"><strong>Importante: precio referencial</strong><p>Este es el presupuesto inicial. La graduación, el centrado y las especificaciones definitivas se confirmarán después de recibir las medidas del profesional externo. El precio podría ajustarse antes de fabricar las lunas.</p></div>}
        {isFinal&&<div className="public-quote-confirmed"><strong>Propuesta final</strong><p>Revisa las líneas y el precio total. La fabricación se coordinará cuando confirmes la compra con la óptica.</p></div>}
      </section>
      <section className="public-quote-next">
        <div className="public-quote-next-icon">✓</div>
        <div><h2>{isCompleted?"Esta cotización ya fue procesada":isFinal?"¿Deseas continuar con esta propuesta?":"¿Quieres seguir con tu cotización?"}</h2><p>{isFinal?"Comunícate con Visión Total para confirmar la compra y coordinar el pedido.":"Responde al mensaje con el que recibiste este enlace o comunícate con Visión Total para coordinar el siguiente paso."}</p></div>
      </section>
      <footer className="public-quote-footer">
        <strong>Óptica Visión Total</strong>
        <span>Esta página muestra una propuesta comercial, no es comprobante de pago ni boleta/factura electrónica.</span>
        <small>Enlace con fecha de caducidad: {quote.share_expires_at?new Date(quote.share_expires_at).toLocaleDateString("es-PE"):"definida por la óptica"}.</small>
      </footer>
    </div>
  </main>;
}
