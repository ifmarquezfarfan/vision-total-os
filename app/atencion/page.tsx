import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { sendQuoteToMeasurement, receiveQuoteMeasurement, completeFinalQuoteSale } from "./actions";

type QuoteRow = {
  id:string;quote_code:string;quote_at:string;client_id:string|null;lead_id:string|null;total:number|string;
  status:string;workflow_stage:string;quote_kind:string;measurement_status:string;measurement_provider:string|null;
  measurement_sent_at:string|null;measurement_received_at:string|null;measurement_notes:string|null;
  prescription_id:string|null;parent_quote_id:string|null;sale_id:string|null;expires_at:string|null;
};

const currency = (value:unknown) => "S/ " + Number(value||0).toFixed(2);
const stageName:Record<string,string> = {
  initial_quote:"Cotización inicial",measurement_pending:"Medición externa pendiente",
  measurement_received:"Medición recibida",final_quote:"Cotización final",sale_completed:"Venta completada",cancelled:"Cancelada"
};

function PrescriptionFields() {
  return <>
    <div className="attention-rx-meta">
      <div className="field"><label>Fecha del examen</label><input type="datetime-local" name="exam_at" /></div>
      <div className="field"><label>Tipo / uso de receta *</label><select name="rx_type" defaultValue="" required><option value="">Seleccionar</option><option>Lejos</option><option>Cerca</option><option>Lejos y cerca</option><option>Bifocal</option><option>Progresivo</option><option>Ocupacional</option><option>Otro</option></select></div>
      <div className="field"><label>Vencimiento</label><input type="date" name="expires_at"/></div>
      <div className="field"><label>Formato de cilindro *</label><select name="cylinder_notation" defaultValue="negative" required><option value="negative">Negativo</option><option value="positive">Positivo</option></select></div>
      <div className="field"><label>Profesional / centro</label><input name="prescriber_name" placeholder="Nombre del profesional"/></div>
      <div className="field"><label>Registro profesional</label><input name="prescriber_license" placeholder="Si figura en la receta"/></div>
      <input type="hidden" name="rx_source" value="Medición externa"/>
    </div>
    <div className="attention-rx-block">
      <div><strong>Graduación principal</strong><p className="muted">Transcribe la receta original, respetando signos y ojo.</p></div>
      <div className="table-wrap"><table className="attention-rx-table"><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje °</th><th>ADD</th></tr></thead><tbody>
        <tr><th>OD · Derecho</th><td><input name="od_sphere" type="number" step="0.25" placeholder="-1.75"/></td><td><input name="od_cylinder" type="number" step="0.25" placeholder="-0.50"/></td><td><input name="od_axis" type="number" step="1" min="1" max="180" placeholder="90"/></td><td><input name="od_add" type="number" step="0.25"/></td></tr>
        <tr><th>OI · Izquierdo</th><td><input name="os_sphere" type="number" step="0.25" placeholder="+1.00"/></td><td><input name="os_cylinder" type="number" step="0.25" placeholder="-0.50"/></td><td><input name="os_axis" type="number" step="1" min="1" max="180" placeholder="90"/></td><td><input name="os_add" type="number" step="0.25"/></td></tr>
      </tbody></table></div>
    </div>
    <div className="attention-rx-block">
      <div><strong>Graduación de cerca</strong><p className="muted">Completa solo cuando la receta indique esos valores. No se calcula automáticamente desde ADD.</p></div>
      <div className="table-wrap"><table className="attention-rx-table"><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje °</th></tr></thead><tbody>
        <tr><th>OD</th><td><input name="od_near_sphere" type="number" step="0.25"/></td><td><input name="od_near_cylinder" type="number" step="0.25"/></td><td><input name="od_near_axis" type="number" min="1" max="180" step="1"/></td></tr>
        <tr><th>OI</th><td><input name="os_near_sphere" type="number" step="0.25"/></td><td><input name="os_near_cylinder" type="number" step="0.25"/></td><td><input name="os_near_axis" type="number" min="1" max="180" step="1"/></td></tr>
      </tbody></table></div>
    </div>
    <div className="attention-rx-block">
      <div><strong>Prisma y base</strong><p className="muted">BI/BO horizontal · BU/BD vertical. Si anotas un prisma, su base debe estar indicada.</p></div>
      <div className="attention-prism-grid">
        {(["od","os"] as const).map((eye)=> <div className="attention-prism-eye" key={eye}><strong>{eye.toUpperCase()} · {eye==="od"?"Derecho":"Izquierdo"}</strong>
          <div className="form-grid">
            <div className="field"><label>Prisma horizontal Δ</label><input type="number" min="0" step="0.25" name={eye+"_prism_horizontal"}/></div>
            <div className="field"><label>Base horizontal</label><select name={eye+"_prism_horizontal_base"} defaultValue=""><option value="">Sin indicar</option><option value="BI">BI</option><option value="BO">BO</option></select></div>
            <div className="field"><label>Prisma vertical Δ</label><input type="number" min="0" step="0.25" name={eye+"_prism_vertical"}/></div>
            <div className="field"><label>Base vertical</label><select name={eye+"_prism_vertical_base"} defaultValue=""><option value="">Sin indicar</option><option value="BU">BU</option><option value="BD">BD</option></select></div>
          </div>
        </div>)}
      </div>
    </div>
    <div className="attention-rx-block">
      <div><strong>Distancia pupilar</strong><p className="muted">La DP monocular se registra por separado cuando el profesional la proporciona.</p></div>
      <div className="form-grid">
        <div className="field"><label>DP binocular (mm)</label><input name="pd" type="number" step="0.5" min="1" max="100"/></div>
        <div className="field"><label>DP monocular OD (mm)</label><input name="pd_od" type="number" step="0.5" min="1" max="50"/></div>
        <div className="field"><label>DP monocular OI (mm)</label><input name="pd_os" type="number" step="0.5" min="1" max="50"/></div>
      </div>
    </div>
    <div className="form-grid">
      <div className="field"><label>Observaciones de la receta</label><textarea name="prescription_notes" rows={2} placeholder="Solo indicaciones que figuren en la receta"/></div>
      <div className="field"><label>Notas de la medición recibida</label><textarea name="measurement_notes" rows={2} placeholder="Incidencias, archivo recibido o aclaraciones del centro"/></div>
    </div>
  </>;
}

export default async function AttentionPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;sent_to_measurement?:string;measurement_received?:string;prescription?:string;final_created?:string;completed?:string}>}) {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership} = await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch} = await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:rawQuotes},{data:clients}] = await Promise.all([
    supabase.from("quotes").select("id,quote_code,quote_at,client_id,lead_id,total,status,workflow_stage,quote_kind,measurement_status,measurement_provider,measurement_sent_at,measurement_received_at,measurement_notes,prescription_id,parent_quote_id,sale_id,expires_at")
      .eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("quote_at",{ascending:false}).limit(250),
    supabase.from("clients").select("id,full_name,dni,whatsapp,phone").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("status","active").limit(800)
  ]);
  const params=await searchParams;
  const quotes=(rawQuotes??[]) as QuoteRow[];
  const clientMap=new Map((clients??[]).map(c=>[c.id,{name:c.full_name,dni:c.dni,contact:c.whatsapp||c.phone}]));
  const initials=quotes.filter(q=>q.quote_kind==="initial"&&q.workflow_stage==="initial_quote"&&!["cancelled","rejected","expired","converted"].includes(q.status));
  const pending=quotes.filter(q=>q.quote_kind==="initial"&&q.workflow_stage==="measurement_pending");
  const received=quotes.filter(q=>q.quote_kind==="initial"&&q.workflow_stage==="measurement_received");
  const finals=quotes.filter(q=>q.quote_kind==="final"&&q.workflow_stage==="final_quote"&&!q.sale_id);
  const completed=quotes.filter(q=>q.workflow_stage==="sale_completed").slice(0,8);
  const activeFinalByParent=new Map(finals.map(q=>[q.parent_quote_id,q]));
  const prescriptionIds=[...new Set([...received,...finals].map(q=>q.prescription_id).filter(Boolean))] as string[];
  let prescriptionMap=new Map<string,{rx_type:string|null;od_sphere:number|null;od_cylinder:number|null;od_axis:number|null;os_sphere:number|null;os_cylinder:number|null;os_axis:number|null;pd:number|null}>();
  if(prescriptionIds.length){
    const {data:rxRows}=await supabase.from("prescriptions").select("id,rx_type,od_sphere,od_cylinder,od_axis,os_sphere,os_cylinder,os_axis,pd").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).in("id",prescriptionIds);
    prescriptionMap=new Map((rxRows??[]).map((rx)=>[rx.id,rx]));
  }

  const step=(number:string,title:string,description:string,active:boolean)=> <div className={"attention-flow-step "+(active?"active":"")} key={number}><span>{number}</span><div><strong>{title}</strong><small>{description}</small></div></div>;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Atención al cliente</strong><span className="muted">{user.email}</span></header><div className="content attention-content">
    <div className="spread attention-title-row"><div><div className="eyebrow">VISIÓN TOTAL · FLUJO PRINCIPAL</div><h1 className="page-title">Una atención, cuatro pasos</h1><p className="subtitle">La información acompaña al cliente desde la primera cotización hasta el pago, sin volver a empezar.</p></div><div className="inline"><Link href="/clientes" className="btn btn-secondary">Cartera de clientes</Link><Link href="/cotizaciones#nueva-cotizacion" className="btn btn-primary">＋ Nueva cotización</Link></div></div>
    <section className="attention-flow" aria-label="Pasos de una atención">
      {step("01","Cliente + cotización inicial","Datos desde el comienzo y precio orientativo.",initials.length>0)}
      <span className="attention-flow-connector">›</span>
      {step("02","Medición externa","Queda registrado a dónde se envió y cuándo.",pending.length>0)}
      <span className="attention-flow-connector">›</span>
      {step("03","Cotización final","Receta recibida, selección y precio definitivo.",received.length>0)}
      <span className="attention-flow-connector">›</span>
      {step("04","Pago + comprobante","Venta vinculada al cliente y al historial.",finals.length>0)}
    </section>

    {params.error&&<div className="notice notice-error attention-alert">{params.error}</div>}
    {params.created&&<div className="notice attention-alert">Cotización inicial <strong>{params.created}</strong> guardada con la ficha del cliente.</div>}
    {params.sent_to_measurement&&<div className="notice attention-alert">Envío a medición registrado. La atención queda en espera del resultado.</div>}
    {params.measurement_received&&<div className="notice attention-alert">Medición y receta guardadas. Ahora puedes preparar la cotización definitiva.</div>}
    {params.final_created&&<div className="notice attention-alert">Cotización final <strong>{params.final_created}</strong> lista para revisar y cobrar.</div>}

    <section className="attention-stage section">
      <div className="attention-stage-heading"><span className="attention-stage-number">01</span><div><h2>Cliente y cotización inicial</h2><p>Registra la necesidad y una propuesta orientativa. El precio definitivo se confirma al regresar la medición.</p></div><Link href="/cotizaciones#nueva-cotizacion" className="link-strong">Crear cotización inicial →</Link></div>
      {initials.length ? <div className="attention-card-list">{initials.map(q=>{const client=q.client_id?clientMap.get(q.client_id):null;return <article className="attention-item" key={q.id}><div className="attention-item-main"><div className="attention-item-code">{q.quote_code}<span className="status-badge status-info">Inicial</span></div><h3>{client?.name||"Cliente sin ficha"}</h3><p>{client?.dni?"DNI "+client.dni+" · ":""}{client?.contact||"Sin contacto registrado"}</p><div className="attention-item-meta"><span>{new Date(q.quote_at).toLocaleDateString("es-PE")}</span><span>Orientativa · {currency(q.total)}</span></div></div><div className="attention-item-action"><span className="attention-field-caption">Siguiente paso</span><form action={sendQuoteToMeasurement} className="attention-mini-form"><input type="hidden" name="quote_id" value={q.id}/><div className="field"><label>Centro / profesional *</label><input name="measurement_provider" placeholder="Ej. centro optométrico" required/></div><div className="field"><label>Nota de envío (opcional)</label><input name="measurement_notes" placeholder="Referencia o indicación"/></div><button className="btn btn-primary">Registrar envío a medir →</button></form></div></article>})}</div> : <div className="attention-empty"><strong>No hay cotizaciones iniciales esperando el siguiente paso.</strong><span>Empieza con los datos del cliente y la propuesta orientativa.</span><Link href="/cotizaciones#nueva-cotizacion" className="btn btn-primary">Crear cotización inicial</Link></div>}
    </section>

    <section className="attention-stage section">
      <div className="attention-stage-heading"><span className="attention-stage-number">02</span><div><h2>Esperando medición externa</h2><p>Cuando la persona regrese, registra una sola vez la receta que recibió de su profesional.</p></div><span className="attention-count">{pending.length} pendiente(s)</span></div>
      {pending.length ? <div className="attention-card-list">{pending.map(q=>{const client=q.client_id?clientMap.get(q.client_id):null;return <article className="attention-item attention-item-stack" key={q.id}><div className="attention-item-summary"><div><div className="attention-item-code">{q.quote_code}<span className="status-badge status-warning">En medición</span></div><h3>{client?.name||"Cliente"}</h3><p>{q.measurement_provider||"Centro externo por confirmar"} · enviado {q.measurement_sent_at?new Date(q.measurement_sent_at).toLocaleDateString("es-PE"):"sin fecha"} · cotización {currency(q.total)}</p>{q.measurement_notes&&<small className="muted">Nota: {q.measurement_notes}</small>}</div><Link href="/clientes" className="link-strong">Cartera →</Link></div><details className="attention-details"><summary>＋ Registrar receta y medición recibida</summary><form action={receiveQuoteMeasurement} className="attention-measurement-form"><input type="hidden" name="quote_id" value={q.id}/><PrescriptionFields/><div className="attention-form-footer"><p className="field-hint">Confirma cada signo y cada ojo con la receta física o digital. Guardar esta etapa crea la receta del cliente y habilita la cotización final.</p><button className="btn btn-primary">Guardar medición y receta →</button></div></form></details></article>})}</div> : <div className="attention-empty"><strong>No hay clientes pendientes de medición.</strong><span>Cuando envíes una cotización inicial a medir, aparecerá aquí.</span></div>}
    </section>

    <section className="attention-stage section">
      <div className="attention-stage-heading"><span className="attention-stage-number">03</span><div><h2>Medición recibida: preparar cotización final</h2><p>La receta queda vinculada. Ahora se afinan la montura, los lentes OD/OI, tratamientos, material y precio.</p></div><span className="attention-count">{received.length} por cotizar</span></div>
      {received.length ? <div className="attention-card-list">{received.map(q=>{const client=q.client_id?clientMap.get(q.client_id):null;const rx=q.prescription_id?prescriptionMap.get(q.prescription_id):null;const existingFinal=activeFinalByParent.get(q.id);return <article className="attention-item" key={q.id}><div className="attention-item-main"><div className="attention-item-code">{q.quote_code}<span className="status-badge status-success">Medición recibida</span></div><h3>{client?.name||"Cliente"}</h3><p>{rx?.rx_type||"Receta registrada"} · OD {formatPowers(rx?.od_sphere,rx?.od_cylinder,rx?.od_axis)} · OI {formatPowers(rx?.os_sphere,rx?.os_cylinder,rx?.os_axis)}</p><div className="attention-item-meta"><span>DP {rx?.pd??"·"} mm</span><span>Propuesta inicial {currency(q.total)}</span></div></div><div className="attention-item-action">{existingFinal?<><span className="status-badge status-info">Final creada</span><Link className="btn btn-primary" href="#pago">Ir a pago</Link></>:<Link className="btn btn-primary" href={"/atencion/final/"+q.id}>Configurar y fijar precio final →</Link>}<p className="field-hint">Elige y valora las opciones definitivas antes de cobrar.</p></div></article>})}</div> : <div className="attention-empty"><strong>Las mediciones recibidas aparecerán aquí.</strong><span>El sistema no habilita la cotización final antes de registrar la receta.</span></div>}
    </section>

    <section id="pago" className="attention-stage section">
      <div className="attention-stage-heading"><span className="attention-stage-number">04</span><div><h2>Cotización final y pago</h2><p>Solo las cotizaciones finales aparecen para convertir a venta. El cobro genera la venta vinculada al cliente y al historial.</p></div><span className="attention-count">{finals.length} lista(s)</span></div>
      {finals.length ? <div className="attention-card-list">{finals.map(q=>{const client=q.client_id?clientMap.get(q.client_id):null;return <article className="attention-item" key={q.id}><div className="attention-item-main"><div className="attention-item-code">{q.quote_code}<span className="status-badge status-success">Lista para cobro</span></div><h3>{client?.name||"Cliente"}</h3><p>{q.parent_quote_id?"Basada en "+(quotes.find(p=>p.id===q.parent_quote_id)?.quote_code||"medición recibida"):"Cotización final"}</p><div className="attention-total">{currency(q.total)}</div></div><div className="attention-item-action"><form action={completeFinalQuoteSale} className="attention-payment-form"><input type="hidden" name="quote_id" value={q.id}/><div className="field"><label>Medio de pago</label><select name="payment_method" defaultValue="Efectivo"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div><div className="field"><label>Monto recibido (S/)</label><input name="paid_amount" type="number" step="0.01" min="0" max={Number(q.total)} defaultValue={Number(q.total).toFixed(2)} required/></div><div className="field"><label>Responsable</label><input name="responsible" defaultValue={user.email||""}/></div><button className="btn btn-primary">Confirmar pago y emitir ticket →</button><span className="field-hint">Permite adelanto o pago completo. El saldo queda registrado.</span></form></div></article>})}</div> : <div className="attention-empty"><strong>No hay cotizaciones finales pendientes de cobro.</strong><span>Completa la medición y la configuración final para que aparezcan aquí.</span></div>}
    </section>

    {completed.length>0&&<section className="attention-stage section"><div className="attention-stage-heading"><span className="attention-stage-number">✓</span><div><h2>Atenciones finalizadas recientemente</h2><p>Consulta la venta creada en el último paso.</p></div></div><div className="table-wrap"><table><thead><tr><th>Cotización</th><th>Cliente</th><th>Total final</th><th>Venta</th></tr></thead><tbody>{completed.map(q=><tr key={q.id}><td>{q.quote_code}</td><td>{q.client_id?clientMap.get(q.client_id)?.name||"Cliente":"·"}</td><td>{currency(q.total)}</td><td>{q.sale_id?<Link className="link-strong" href={"/ventas/"+q.sale_id+"/comprobante"}>Ver comprobante →</Link>:"·"}</td></tr>)}</tbody></table></div></section>}
    <section className="attention-support-links"><Link href="/cotizaciones">Ver historial de cotizaciones →</Link><Link href="/ventas">Ver ventas →</Link><Link href="/pedidos">Gestionar producción/laboratorio →</Link><Link href="/buscador-lunas">Buscar lunas en catálogo →</Link></section>
  </div></main></div>;
}

function formatPowers(sphere:number|null|undefined,cyl:number|null|undefined,axis:number|null|undefined) {
  const fmt=(value:number|null|undefined)=>value==null?"·":(value>0?"+":"")+Number(value).toFixed(2);
  return [fmt(sphere),fmt(cyl),axis==null?"·":Number(axis)+"°"].join(" / ");
}
