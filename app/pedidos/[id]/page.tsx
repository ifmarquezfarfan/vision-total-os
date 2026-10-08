import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateOrderOperational } from "../actions";

export default async function OrderDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string;updated?:string;error?:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:order}=await supabase.from("optical_orders").select("id,order_code,client_id,sale_id,prescription_id,frame_product_id,status,lab,lab_reference,lens_type,treatments,promised_at,delivered_at,qc_status,pickup_notified_at,delivery_notes,adaptation_followup_at,notes,created_at").eq("id",id).maybeSingle();
  if(!order) redirect("/pedidos?error=Pedido%20no%20encontrado");

  const [{data:client},{data:prescription},{data:sale},{data:frame}]=await Promise.all([
    order.client_id?supabase.from("clients").select("full_name,dni,whatsapp,phone").eq("id",order.client_id).maybeSingle():Promise.resolve({data:null}),
    order.prescription_id?supabase.from("prescriptions").select("exam_at,expires_at,od_sphere,od_cylinder,od_axis,od_add,os_sphere,os_cylinder,os_axis,os_add,pd").eq("id",order.prescription_id).maybeSingle():Promise.resolve({data:null}),
    order.sale_id?supabase.from("sales").select("sale_code,total,payment_status").eq("id",order.sale_id).maybeSingle():Promise.resolve({data:null}),
    order.frame_product_id?supabase.from("products").select("product_code,brand,model,cost,sale_price").eq("id",order.frame_product_id).maybeSingle():Promise.resolve({data:null})
  ]);

  const q=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Ficha del pedido</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">{order.order_code}</h1><p className="subtitle">{client?.full_name||"Cliente"} · creado {new Date(order.created_at).toLocaleDateString("es-PE")}</p></div><a className="btn btn-secondary" href="/pedidos">Volver</a></div>
    {q.error&&<p className="notice" style={{marginTop:18}}>{q.error}</p>}{q.created&&<p className="notice" style={{marginTop:18}}>Pedido creado.</p>}{q.updated&&<p className="notice" style={{marginTop:18}}>Pedido actualizado.</p>}

    <section className="grid grid-4 section"><div className="card"><div className="metric-label">Estado</div><div className="metric-value" style={{fontSize:20}}>{order.status}</div></div><div className="card"><div className="metric-label">QC</div><div className="metric-value" style={{fontSize:20}}>{order.qc_status}</div></div><div className="card"><div className="metric-label">Prometido</div><div className="metric-value" style={{fontSize:18}}>{order.promised_at?new Date(order.promised_at).toLocaleDateString("es-PE"):"Sin fecha"}</div></div><div className="card"><div className="metric-label">Aviso</div><div className="metric-value" style={{fontSize:18}}>{order.pickup_notified_at?"Enviado":"Pendiente"}</div></div></section>

    <section className="grid grid-3 section"><div className="card"><h2>Cliente</h2><p>{client?.full_name||"·"}</p><p className="muted">{client?.dni||""} {client?.whatsapp||client?.phone||""}</p></div><div className="card"><h2>Venta</h2><p>{sale?.sale_code||"Sin vínculo"}</p><p className="muted">{sale ? "S/ "+Number(sale.total).toFixed(2)+" · "+sale.payment_status : "·"}</p></div><div className="card"><h2>Montura</h2><p>{frame ? [frame.brand,frame.model].filter(Boolean).join(" ") : "Sin vínculo"}</p><p className="muted">{frame?.product_code||""}</p></div></section>

    <section className="card section"><h2>Configuración óptica</h2><div className="grid grid-3"><div><strong>Lentes</strong><p>{order.lens_type||"·"}</p></div><div><strong>Tratamientos</strong><p>{order.treatments||"·"}</p></div><div><strong>Laboratorio</strong><p>{order.lab||"·"} {order.lab_reference ? "· "+order.lab_reference : ""}</p></div></div></section>

    {prescription&&<section className="card section"><h2>Receta vinculada</h2><p className="muted">{new Date(prescription.exam_at).toLocaleDateString("es-PE")}{prescription.expires_at ? " · vence "+new Date(prescription.expires_at).toLocaleDateString("es-PE") : ""}</p><div className="table-wrap"><table><thead><tr><th></th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th></tr></thead><tbody><tr><th>OD</th><td>{prescription.od_sphere??"·"}</td><td>{prescription.od_cylinder??"·"}</td><td>{prescription.od_axis??"·"}</td><td>{prescription.od_add??"·"}</td></tr><tr><th>OI</th><td>{prescription.os_sphere??"·"}</td><td>{prescription.os_cylinder??"·"}</td><td>{prescription.os_axis??"·"}</td><td>{prescription.os_add??"·"}</td></tr></tbody></table></div><p className="muted">DP: {prescription.pd??"·"}</p></section>}

    <section className="card section"><h2>Actualizar flujo</h2><form action={updateOrderOperational} className="form"><input type="hidden" name="order_id" value={order.id}/><div className="form-grid">
      <div className="field"><label>Estado</label><select name="status" defaultValue={order.status}><option value="received">Recibido</option><option value="in_preparation">En preparación</option><option value="at_lab">En laboratorio</option><option value="ready">Listo</option><option value="delivered">Entregado</option><option value="cancelled">Cancelado</option></select></div>
      <div className="field"><label>Control de calidad</label><select name="qc_status" defaultValue={order.qc_status}><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rework">Rehacer</option></select></div>
      <div className="field"><label>Referencia laboratorio</label><input name="lab_reference" defaultValue={order.lab_reference||""}/></div>
      <div className="field"><label>Adaptación / seguimiento</label><input name="adaptation_followup_at" type="datetime-local" defaultValue={order.adaptation_followup_at?new Date(order.adaptation_followup_at).toISOString().slice(0,16):""}/></div>
      <div className="field"><label>Notas de entrega</label><input name="delivery_notes" defaultValue={order.delivery_notes||""}/></div>
    </div><label className="checkline"><input type="checkbox" name="pickup_notified" defaultChecked={!!order.pickup_notified_at}/> Cliente avisado para recojo</label><button className="btn btn-primary">Guardar estado</button></form></section>
  </div></main></div>;
}
