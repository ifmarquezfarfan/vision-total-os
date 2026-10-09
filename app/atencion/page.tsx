import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { startQuoteMeasurement, recordQuoteMeasurement, convertQuoteToSale } from "@/app/cotizaciones/actions";

type WorkflowQuote = {
  id: string; quote_code: string; quote_at: string; client_id: string | null; total: number | string;
  status: string; workflow_stage: string; quote_kind: string; requires_measurement: boolean;
  measurement_status: string; measurement_provider: string | null; measurement_sent_at: string | null;
  measurement_received_at: string | null; measurement_notes: string | null; parent_quote_id: string | null;
  prescription_id: string | null; sale_id: string | null;
};

const stageLabels:Record<string,string>={
  initial_quote:"Cotización inicial", measurement_pending:"Medición externa pendiente",
  measurement_received:"Medición recibida", final_quote:"Configuración final · lista para cobrar",
  sale_completed:"Venta registrada", cancelled:"Cancelada"
};
const money=new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"});

export default async function OpticalAttentionPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;final?:string;measurement_sent?:string;measurement_received?:string;converted?:string}>}) {
  const params=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:quoteRows},{data:clients}]=await Promise.all([
    supabase.from("quotes")
      .select("id,quote_code,quote_at,client_id,total,status,workflow_stage,quote_kind,requires_measurement,measurement_status,measurement_provider,measurement_sent_at,measurement_received_at,measurement_notes,parent_quote_id,prescription_id,sale_id")
      .eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id)
      .order("quote_at",{ascending:false}).limit(250),
    supabase.from("clients").select("id,full_name,whatsapp,phone,dni")
      .eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("full_name").limit(1000)
  ]);
  const quotes=(quoteRows??[]) as WorkflowQuote[];
  const clientMap=new Map((clients??[]).map(c=>[c.id,c]));
  const activeQuotes=quotes.filter(q=>q.workflow_stage!=="cancelled"&&!(q.workflow_stage==="measurement_received"&&quotes.some(child=>child.parent_quote_id===q.id&&child.workflow_stage!=="cancelled")));
  const needsInitial=activeQuotes.filter(q=>q.workflow_stage==="initial_quote");
  const needsMeasuring=activeQuotes.filter(q=>q.workflow_stage==="measurement_pending");
  const needsFinal=activeQuotes.filter(q=>q.workflow_stage==="measurement_received");
  const needsPayment=activeQuotes.filter(q=>q.workflow_stage==="final_quote");
  const completed=quotes.filter(q=>q.workflow_stage==="sale_completed");

  return <div className="shell"><Sidebar/><main className="main">
    <header className="topbar"><strong>Atención óptica</strong><span className="muted">{user.email}</span></header>
    <div className="content attention-page">
      <div className="attention-hero">
        <div><div className="eyebrow">VISIÓN TOTAL · PROCESO CENTRAL</div><h1 className="page-title">Una atención, un camino claro.</h1><p className="subtitle">Desde que el cliente pregunta por precios hasta el pago. Cada paso conserva los datos del anterior.</p></div>
        <Link href="/cotizaciones" className="btn btn-primary attention-new-quote">＋ Nueva cotización</Link>
      </div>

      <div className="attention-steps">
        <Link href="/cotizaciones" className="attention-step active"><span className="attention-step-number">1</span><div><strong>Cotización inicial</strong><small>Cliente + opciones + precio orientativo</small></div><span className="attention-step-count">{needsInitial.length}</span></Link>
        <div className={"attention-step "+(needsMeasuring.length?"has-work":"")}><span className="attention-step-number">2</span><div><strong>Medición externa</strong><small>Derivación + recepción de resultados</small></div><span className="attention-step-count">{needsMeasuring.length}</span></div>
        <div className={"attention-step "+(needsFinal.length?"has-work":"")}><span className="attention-step-number">3</span><div><strong>Configuración final</strong><small>Receta + montura + lunas + tratamientos</small></div><span className="attention-step-count">{needsFinal.length}</span></div>
        <div className={"attention-step "+(needsPayment.length?"has-work":"")}><span className="attention-step-number">4</span><div><strong>Pago y comprobante</strong><small>Registrar cobro y continuar el pedido</small></div><span className="attention-step-count">{needsPayment.length}</span></div>
      </div>

      {params.error&&<p className="notice notice-error section">{params.error}</p>}
      {params.created&&<p className="notice section">Cotización guardada: <strong>{params.created}</strong>. Sigue el paso indicado en la cola.</p>}
      {params.final&&<p className="notice section">Cotización final guardada: <strong>{params.created||"Lista"}</strong>. La configuración está preparada para el cobro.</p>}
      {params.measurement_sent&&<p className="notice section">Derivación a medición registrada. Cuando el cliente regrese, captura el resultado desde esta misma pantalla.</p>}
      {params.measurement_received&&<p className="notice section">Medición guardada y receta vinculada a la cotización.</p>}
      {params.converted&&<p className="notice section">Venta registrada: <strong>{params.converted}</strong>. Continúa con el pedido óptico y la entrega.</p>}

      <section className="section attention-queue">
        <div className="section-heading"><div><h2>Qué necesita atención ahora</h2><p className="muted">Las cotizaciones aparecen aquí según su estado. No es necesario recordar qué pantalla abrir.</p></div><span className="status-badge status-info">{activeQuotes.length} en proceso</span></div>

        {activeQuotes.map(q=>{
          const client=q.client_id?clientMap.get(q.client_id):null;
          return <article className="attention-quote-card" key={q.id}>
            <div className="attention-quote-heading">
              <div><span className="attention-quote-code">{q.quote_code}</span><h3>{client?.full_name||"Cliente sin nombre"}</h3><p>{client?.whatsapp||client?.phone||"Contacto no registrado"}{client?.dni?" · DNI "+client.dni:""}</p></div>
              <div className="attention-quote-total"><small>Importe actual</small><strong>{money.format(Number(q.total)||0)}</strong><span className={"status-badge "+(q.workflow_stage==="sale_completed"?"status-success":q.workflow_stage==="measurement_pending"?"status-warning":q.workflow_stage==="final_quote"?"status-info":"status-purple")}>{stageLabels[q.workflow_stage]||q.workflow_stage}</span></div>
            </div>
            <div className="attention-quote-meta"><span>Creada {new Date(q.quote_at).toLocaleDateString("es-PE")}</span><span>{q.quote_kind==="final"?"Cotización final":"Cotización inicial"}</span><span>Estado: {({draft:"Borrador",sent:"Enviada",accepted:"Aceptada",rejected:"Rechazada",expired:"Vencida",converted:"Convertida",cancelled:"Cancelada"} as Record<string,string>)[q.status]||q.status}</span></div>

            {q.workflow_stage==="initial_quote"&&q.requires_measurement&&<div className="attention-next-action">
              <div><strong>El cliente desea continuar</strong><p>Registra a dónde lo derivamos para poder asociar el resultado cuando regrese.</p></div>
              <form action={startQuoteMeasurement} className="attention-action-form">
                <input type="hidden" name="quote_id" value={q.id}/>
                <div className="field"><label>Centro / profesional que medirá *</label><input name="measurement_provider" required placeholder="Centro optométrico o especialista"/></div>
                <div className="field"><label>Indicaciones / referencia (opcional)</label><input name="measurement_notes" placeholder="Cita, referencia, indicación breve"/></div>
                <button className="btn btn-primary">Registrar derivación a medición →</button>
              </form>
            </div>}

            {q.workflow_stage==="initial_quote"&&!q.requires_measurement&&<div className="attention-next-action"><div><strong>No requiere medición</strong><p>Esta operación puede pasar directamente al cobro, ya que se indicó que no requiere graduación.</p></div><form action={convertQuoteToSale} className="attention-payment-form"><input type="hidden" name="quote_id" value={q.id}/><div className="field"><label>Medio de pago</label><select name="payment_method" required defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div><div className="field"><label>Pagado ahora (S/)</label><input name="paid_amount" type="number" min="0" step="0.01" defaultValue={Number(q.total).toFixed(2)} required/></div><div className="field"><label>Responsable</label><input name="responsible" defaultValue={user.email||""}/></div><button className="btn btn-primary">Registrar pago y venta</button></form></div>}

            {q.workflow_stage==="measurement_pending"&&<details className="attention-measurement-details" open><summary><span><strong>Registrar resultado de medición externa</strong><small>Centro registrado: {q.measurement_provider||"Sin indicar"}{q.measurement_sent_at?" · Derivación "+new Date(q.measurement_sent_at).toLocaleDateString("es-PE"):""}</small></span><span>＋</span></summary>
              <form action={recordQuoteMeasurement} className="form attention-rx-form"><input type="hidden" name="quote_id" value={q.id}/>
                <div className="form-grid">
                  <div className="field"><label>Fecha de medición / examen</label><input name="exam_at" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></div>
                  <div className="field"><label>Tipo de receta</label><select name="rx_type" defaultValue=""><option value="">No especificado</option><option>Lejos</option><option>Cerca</option><option>Lejos y cerca</option><option>Bifocal</option><option>Progresivo</option><option>Ocupacional</option><option>Otro</option></select></div>
                  <div className="field"><label>Formato de cilindro</label><select name="cylinder_notation" defaultValue="negative"><option value="negative">Cilindro negativo</option><option value="positive">Cilindro positivo</option></select></div>
                  <div className="field"><label>Profesional que prescribe</label><input name="prescriber_name" placeholder="Nombre que figura en receta"/></div>
                  <div className="field"><label>Colegiatura / registro</label><input name="prescriber_license" placeholder="Si aparece"/></div>
                  <div className="field"><label>Vencimiento de receta</label><input name="expires_at" type="date"/></div>
                </div>
                <div className="attention-rx-table">
                  <div className="attention-rx-title"><strong>Graduación principal</strong><span>Transcribe los signos exactamente como aparecen.</span></div>
                  <div className="table-wrap"><table><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje (°)</th><th>ADD</th></tr></thead><tbody>
                    <tr><th>OD · Derecho</th><td><input name="od_sphere" type="number" step="0.25" placeholder="-1.75"/></td><td><input name="od_cylinder" type="number" step="0.25" placeholder="-0.50"/></td><td><input name="od_axis" type="number" min="1" max="180" step="1" placeholder="120"/></td><td><input name="od_add" type="number" step="0.25" placeholder="+2.00"/></td></tr>
                    <tr><th>OI · Izquierdo</th><td><input name="os_sphere" type="number" step="0.25" placeholder="+1.00"/></td><td><input name="os_cylinder" type="number" step="0.25" placeholder="-0.50"/></td><td><input name="os_axis" type="number" min="1" max="180" step="1" placeholder="90"/></td><td><input name="os_add" type="number" step="0.25" placeholder="+2.00"/></td></tr>
                  </tbody></table></div>
                </div>
                <div className="form-grid">
                  <div className="field"><label>DP binocular (mm)</label><input name="pd" type="number" min="1" max="100" step="0.5" placeholder="63"/></div>
                  <div className="field"><label>DP monocular OD (mm)</label><input name="pd_od" type="number" min="1" max="50" step="0.5"/></div>
                  <div className="field"><label>DP monocular OI (mm)</label><input name="pd_os" type="number" min="1" max="50" step="0.5"/></div>
                </div>
                <details className="attention-rx-advanced"><summary>Datos adicionales opcionales · cerca y prisma</summary>
                  <div className="form-grid">
                    <div className="field"><label>OD esfera cerca</label><input name="od_near_sphere" type="number" step="0.25"/></div><div className="field"><label>OD cilindro cerca</label><input name="od_near_cylinder" type="number" step="0.25"/></div><div className="field"><label>OD eje cerca</label><input name="od_near_axis" type="number" min="1" max="180" step="1"/></div>
                    <div className="field"><label>OI esfera cerca</label><input name="os_near_sphere" type="number" step="0.25"/></div><div className="field"><label>OI cilindro cerca</label><input name="os_near_cylinder" type="number" step="0.25"/></div><div className="field"><label>OI eje cerca</label><input name="os_near_axis" type="number" min="1" max="180" step="1"/></div>
                    <div className="field"><label>OD prisma horizontal (Δ)</label><input name="od_prism_horizontal" type="number" min="0" step="0.25"/></div><div className="field"><label>OD base horizontal</label><select name="od_prism_horizontal_base" defaultValue=""><option value="">Sin indicar</option><option value="BI">BI</option><option value="BO">BO</option></select></div>
                    <div className="field"><label>OD prisma vertical (Δ)</label><input name="od_prism_vertical" type="number" min="0" step="0.25"/></div><div className="field"><label>OD base vertical</label><select name="od_prism_vertical_base" defaultValue=""><option value="">Sin indicar</option><option value="BU">BU</option><option value="BD">BD</option></select></div>
                    <div className="field"><label>OI prisma horizontal (Δ)</label><input name="os_prism_horizontal" type="number" min="0" step="0.25"/></div><div className="field"><label>OI base horizontal</label><select name="os_prism_horizontal_base" defaultValue=""><option value="">Sin indicar</option><option value="BI">BI</option><option value="BO">BO</option></select></div>
                    <div className="field"><label>OI prisma vertical (Δ)</label><input name="os_prism_vertical" type="number" min="0" step="0.25"/></div><div className="field"><label>OI base vertical</label><select name="os_prism_vertical_base" defaultValue=""><option value="">Sin indicar</option><option value="BU">BU</option><option value="BD">BD</option></select></div>
                  </div>
                </details>
                <div className="field"><label>Observaciones de receta / medición</label><textarea name="notes" rows={2} placeholder="Indicaciones copiadas de la receta, sin reinterpretarlas."/></div>
                <div className="field"><label>Nota interna para seguimiento</label><input name="measurement_notes" defaultValue={q.measurement_notes||""} placeholder="Pendiente, llamada o aclaración con el centro"/></div>
                <div className="attention-action-footer"><span className="field-hint">La receta se guardará vinculada a este cliente y cotización. Revisa los valores antes de enviar al laboratorio.</span><button className="btn btn-primary">Guardar medición y habilitar configuración final →</button></div>
              </form>
            </details>}

            {q.workflow_stage==="measurement_received"&&<div className="attention-next-action"><div><strong>Medición recibida</strong><p>La receta está vinculada al cliente y a esta cotización. Ajusta lunas, tratamientos y precio con los valores correctos.</p></div><Link className="btn btn-primary" href={"/cotizaciones?from_quote="+q.id}>Preparar cotización final →</Link></div>}

            {q.workflow_stage==="final_quote"&&<div className="attention-next-action"><div><strong>{q.quote_kind==="final"?"El cliente puede confirmar y pagar":"Lista para finalizar"}</strong><p>{q.requires_measurement?"La medición está recibida y la configuración final está guardada.":"Operación marcada como no sujeta a medición."} Registra el medio de pago y el importe realmente cobrado.</p></div>
              <form action={convertQuoteToSale} className="attention-payment-form"><input type="hidden" name="quote_id" value={q.id}/><div className="field"><label>Medio de pago *</label><select name="payment_method" required defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div><div className="field"><label>Pagado ahora (S/)</label><input name="paid_amount" type="number" min="0" step="0.01" defaultValue={Number(q.total).toFixed(2)} required/></div><div className="field"><label>Responsable</label><input name="responsible" defaultValue={user.email||""}/></div><button className="btn btn-primary">Confirmar venta y registrar pago →</button></form>
            </div>}

            {q.workflow_stage==="sale_completed"&&<div className="attention-next-action"><div><strong>Pago registrado</strong><p>La venta queda guardada. Cuando corresponda, continúa con el pedido de laboratorio y su control de calidad.</p></div><div className="attention-complete-actions">{q.sale_id&&<Link className="btn btn-secondary" href={"/ventas/"+q.sale_id}>Ver venta / pagos</Link>}<Link className="btn btn-primary" href={q.sale_id?"/pedidos?from_sale="+q.sale_id:"/ventas"}>Continuar a pedido óptico →</Link></div></div>}
          </article>;
        })}
        {!activeQuotes.length&&<div className="attention-empty"><div>✓</div><h3>No hay cotizaciones pendientes de avanzar.</h3><p>Cuando llegue el siguiente cliente, empieza por registrar sus datos y preparar una propuesta.</p><Link href="/cotizaciones" className="btn btn-primary">Crear la primera cotización</Link></div>}
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Historial de atención</h2><p className="muted">Todas las propuestas permanecen disponibles para consultar el recorrido.</p></div><Link href="/cotizaciones#historial-cotizaciones" className="link-strong">Ver historial de cotizaciones →</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Importe</th><th>Etapa</th><th>Venta</th></tr></thead><tbody>
          {quotes.slice(0,80).map(q=><tr key={q.id}><td>{q.quote_code}</td><td>{new Date(q.quote_at).toLocaleDateString("es-PE")}</td><td>{q.client_id?clientMap.get(q.client_id)?.full_name||"Cliente":"·"}</td><td>{q.quote_kind==="final"?"Final":"Inicial"}</td><td>{money.format(Number(q.total)||0)}</td><td>{stageLabels[q.workflow_stage]||q.workflow_stage}</td><td>{q.sale_id?<Link className="link-strong" href={"/ventas/"+q.sale_id}>Ver venta</Link>:"·"}</td></tr>)}
          {!quotes.length&&<tr><td colSpan={7} className="muted">Todavía no hay cotizaciones registradas.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </main></div>;
}
