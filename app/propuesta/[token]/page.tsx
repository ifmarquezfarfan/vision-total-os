import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

type PublicItem={
  description:string;component_type:string;quantity:number|string;unit_price:number|string;
  discount:number|string;line_total:number|string;
};
type PublicLens={
  product_code?:string;brand?:string;model?:string;design?:string;material?:string;
  index?:string;phi_mm?:string;coatings?:string[];catalog_sale_price?:string;
};
type PublicQuotePayload={
  quote:{
    quote_code:string;quote_at:string;expires_at:string|null;subtotal:number|string;discount:number|string;
    total:number|string;status:string;quote_kind:string;workflow_stage:string;requires_measurement:boolean;
    measurement_status:string;branch_label?:string;
  };
  items:PublicItem[];
  optical_configuration?:{usage?:string;od?:PublicLens|null;oi?:PublicLens|null};
};

const money=new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"});
const componentLabel:Record<string,string>={frame:"Montura",lens:"Lunas",treatment:"Tratamiento",service:"Servicio",accessory:"Accesorio",other:"Otro"};

export default async function PublicQuotePage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("get_shared_quote",{target_token:token});
  const payload=data as PublicQuotePayload|null;

  if(error||!payload?.quote) {
    return <main className="public-quote-shell"><section className="public-quote-card public-quote-unavailable"><div className="public-quote-brand-mark">VT</div><div className="eyebrow">ÓPTICA VISIÓN TOTAL</div><h1>Este enlace ya no está disponible</h1><p>La cotización pudo vencer o el enlace pudo ser desactivado. Escribe a la persona que te lo envió para solicitar una versión actualizada.</p></section></main>;
  }

  const quote=payload.quote;
  const config=payload.optical_configuration??{};
  const isFinal=quote.quote_kind==="final";
  const isSale=quote.workflow_stage==="sale_completed";
  const statusLabel=({sent:"Propuesta enviada",accepted:"Propuesta aceptada",converted:"Venta registrada",draft:"Propuesta en preparación"} as Record<string,string>)[quote.status]||"Cotización";
  const disclaimer=quote.requires_measurement&&quote.measurement_status!=="received"
    ?"Esta es una cotización orientativa. Si requiere graduación, la receta y las medidas del profesional deben confirmarse antes de fijar la configuración y el precio definitivo."
    :isFinal
      ?"Esta propuesta corresponde a la configuración final registrada. Antes de fabricar, el personal óptico debe verificar la receta, las medidas y los requisitos del laboratorio."
      :"Revisa la propuesta y responde al mensaje en el que recibiste este enlace para confirmar los siguientes pasos.";

  return <main className="public-quote-shell">
    <article className="public-quote-card">
      <header className="public-quote-header">
        <div className="public-quote-brand"><div className="public-quote-brand-mark">VT</div><div><strong>ÓPTICA VISIÓN TOTAL</strong><span>Tu propuesta óptica</span></div></div>
        <div className="public-quote-code"><small>{isFinal?"PROPUESTA FINAL":"PROPUESTA INICIAL"}</small><h1>{quote.quote_code}</h1><span>{new Date(quote.quote_at).toLocaleDateString("es-PE")}</span></div>
      </header>
      <div className="public-quote-status"><span>{statusLabel}</span>{isSale&&<span>Compra registrada</span>}</div>
      <section className="public-quote-welcome"><h2>{isFinal?"Tu configuración óptica":"Opciones preparadas para ti"}</h2><p>{isFinal?"Esta es la configuración de productos y precios acordada después de registrar las medidas.":"Aquí puedes revisar los productos y precios que conversamos en la óptica."}</p></section>

      <div className="table-wrap public-quote-table"><table><thead><tr><th>Producto / servicio</th><th>Tipo</th><th>Cant.</th><th>Precio unitario</th><th>Desc.</th><th>Total</th></tr></thead><tbody>
        {(payload.items??[]).map((item,index)=><tr key={index}><td>{item.description}</td><td>{componentLabel[item.component_type]||item.component_type}</td><td>{Number(item.quantity)}</td><td>{money.format(Number(item.unit_price)||0)}</td><td>{money.format(Number(item.discount)||0)}</td><td>{money.format(Number(item.line_total)||0)}</td></tr>)}
        {!payload.items?.length&&<tr><td colSpan={6}>La propuesta no tiene artículos visibles.</td></tr>}
      </tbody></table></div>

      {isFinal&&(config.od||config.oi)&&<section className="public-quote-lenses">
        <h3>Configuración de lunas por ojo</h3><p>Uso principal: {config.usage||"No especificado"}</p>
        <div className="public-quote-eye-grid">
          {([{label:"OD · Derecho",lens:config.od},{label:"OI · Izquierdo",lens:config.oi}] as const).map(({label,lens})=><div className="public-quote-eye" key={label}>
            <span>{label}</span><strong>{lens?[lens.brand,lens.model].filter(Boolean).join(" ")||lens.product_code||"Configuración manual":"Configuración manual / pendiente"}</strong>
            {lens&&<><small>{[lens.design,lens.material,lens.index?"Índice "+lens.index:null].filter(Boolean).join(" · ")||"Características pendientes"}</small><small>{lens.phi_mm?"PHI "+lens.phi_mm+" mm":""}</small><small>{(lens.coatings??[]).join(" · ")||"Tratamientos según propuesta"}</small></>}
          </div>)}
        </div>
      </section>}

      <section className="public-quote-totals"><div><span>Subtotal</span><strong>{money.format(Number(quote.subtotal)||0)}</strong></div><div><span>Descuento</span><strong>{money.format(Number(quote.discount)||0)}</strong></div><div className="public-quote-grand-total"><span>TOTAL PROPUESTO</span><strong>{money.format(Number(quote.total)||0)}</strong></div></section>
      {quote.expires_at&&<p className="public-quote-expiry">Propuesta válida hasta {new Date(quote.expires_at).toLocaleDateString("es-PE")}.</p>}
      <section className="public-quote-disclaimer"><strong>{quote.requires_measurement&&quote.measurement_status!=="received"?"Pendiente de medición":"Antes de confirmar"}</strong><p>{disclaimer}</p></section>
      <div className="public-quote-actions"><PrintButton label="Imprimir / guardar PDF"/></div>
      <footer className="public-quote-footer"><strong>Gracias por considerar a Visión Total.</strong><span>Responde al mensaje en el que recibiste este enlace para resolver dudas o confirmar cómo continuar.</span><small>Documento de propuesta comercial. No es comprobante fiscal.</small></footer>
    </article>
  </main>;
}
