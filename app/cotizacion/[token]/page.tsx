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
  client_name?:string|null;
  subtotal:number|string;
  discount:number|string;
  total:number|string;
  optical_configuration?:{
    lens_family?:string|null;
    lens_material?:string|null;
    lens_treatments?:string[]|null;
    lens_series?:string|null;
    package_brand?:string|null;
    price_note?:string|null;
    intended_use?:string|null;
  }|null;
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
  const total=Number(quote.total||0);\n  const configuration=quote.optical_configuration??{};\n  const discountPercent=Number(quote.subtotal)>0?Number(quote.discount||0)/Number(quote.subtotal)*100:0;\n  const seriesLabels:Record<string,string>={pending_measurement:"Pendiente de medición","1era serie (0.25-2.00)":"1era serie · 0.25 a 2.00","2da serie (2.25-4.00)":"2da serie · 2.25 a 4.00","3ra serie (4.25-6.00)":"3ra serie · 4.25 a 6.00","4ta serie (>6.25)":"4ta serie · mayor de 6.25"};
  return <main className="public-quote-page">
    <header className="public-quote-header">
      <div className="public-quote-brand"><span>VT</span><div><strong>ÓPTICA VISIÓN TOTAL</strong><small>Propuesta óptica personalizada</small></div></div>
      <div className="public-quote-contact"><span>Calle Peral 212-A / Calle Peral 501-A</span><span>+51 942 340 948 · +51 906 821 029</span><span>visiontotal.peral212@gmail.com</span></div>
      <span className="public-quote-security"><span/> Enlace privado</span>
    </header>
    <div className="public-quote-content">
      <div className="public-quote-eyebrow">COTIZACIÓN · {quote.quote_code}</div>
      <div className="public-quote-hero">
        <div><h1>{label}</h1><p>Esta propuesta reúne las cualidades técnicas, las alternativas y los importes conversados con el equipo de Visión Total.</p>{quote.client_name&&<div className="public-quote-client-line"><span>Preparada para</span><strong>{quote.client_name}</strong></div>}</div>
        <span className={"public-quote-type "+(isFinal?"final":"initial")}>{isFinal?"Precio final":"Precio orientativo"}</span>
      </div>
      <section className="public-quote-status">
        <div><small>ESTADO DE LA ATENCIÓN</small><strong>{statusLabel[quote.workflow_stage]||"En revisión"}</strong></div>
        <div><small>EMITIDA</small><strong>{new Date(quote.quote_at).toLocaleDateString("es-PE",{year:"numeric",month:"short",day:"numeric"})}</strong></div>
        <div><small>VIGENCIA</small><strong>{quote.expires_at?new Date(quote.expires_at).toLocaleDateString("es-PE"):"Consultar con la óptica"}</strong></div>
      </section>
      {(configuration.lens_family||configuration.lens_material||(configuration.lens_treatments??[]).length||configuration.lens_series||configuration.package_brand||configuration.intended_use||configuration.price_note)&&<section className="public-quote-spec-card">
        <div className="public-quote-spec-heading"><span>ESPECIFICACIONES TÉCNICAS</span><h2>Qué incluye esta propuesta</h2><p>{isFinal?"Configuración ajustada con la medición recibida.":"Orientación de cualidades y alternativas; la graduación final se confirma después de medir."}</p></div>
        <div className="public-quote-spec-grid">
          <div><small>Tipo de luna</small><strong>{configuration.lens_family||"Por definir con el asesor"}</strong></div>
          <div><small>Material</small><strong>{configuration.lens_material||"Por definir"}</strong></div>
          <div><small>Medida / serie</small><strong>{seriesLabels[configuration.lens_series||""]||"Pendiente de medición"}</strong></div>
          <div><small>Uso principal</small><strong>{configuration.intended_use||"Por definir"}</strong></div>
          <div className="public-quote-spec-package"><small>Paquete / marca</small><strong>{configuration.package_brand||"Alternativa por definir"}</strong></div>
          <div className="public-quote-spec-treatments"><small>Tratamientos</small><div className="public-quote-tags">{(configuration.lens_treatments??[]).length?(configuration.lens_treatments??[]).map(treatment=><span key={treatment}>{treatment}</span>):<span>Por definir con el asesor</span>}</div></div>
        </div>
        {configuration.price_note&&<p className="public-quote-price-note">{configuration.price_note}</p>}
      </section>}
      <section className="public-quote-card">
        <div className="public-quote-card-title"><div><h2>Detalle de la propuesta económica</h2><p>{quote.items.length} componente(s) considerados</p></div><PrintButton label="Imprimir / guardar PDF"/></div>
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
        <div className="public-quote-total-breakdown">
          <div><span>Subtotal de componentes</span><strong>{currency(quote.subtotal)}</strong></div>
          {Number(quote.discount||0)>0&&<div><span>Descuento ({discountPercent.toFixed(1)}%)</span><strong>− {currency(quote.discount)}</strong></div>}
        </div>
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
