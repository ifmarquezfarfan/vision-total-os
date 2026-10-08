import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export async function registerPayment(formData: FormData) {
  "use server";
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const saleId=String(formData.get("sale_id")??"");
  const amount=Number(formData.get("amount")??0);
  const method=String(formData.get("method")??"").trim();
  const reference=String(formData.get("reference")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  if(!saleId||!Number.isFinite(amount)||amount<=0||!method) redirect("/ventas?error=Datos%20de%20pago%20inválidos");
  const {error}=await supabase.rpc("register_sale_payment",{target_sale:saleId,amount,method,reference:reference||null,payment_note:notes||null});
  if(error) redirect("/ventas/"+saleId+"?error=No%20se%20pudo%20registrar%20el%20pago");
  redirect("/ventas/"+saleId+"?paid=1");
}

export default async function SaleDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;paid?:string}>}) {
  const {id}=await params;
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:sale}=await supabase.from("sales").select("id,sale_code,sale_at,client_id,lead_id,subtotal,discount,total,paid_amount,balance_due,payment_status,payment_method,responsible,notes").eq("id",id).maybeSingle();
  if(!sale) redirect("/ventas?error=Venta%20no%20encontrada");
  const [{data:client},{data:items},{data:order},{data:payments}]=await Promise.all([
    sale.client_id?supabase.from("clients").select("id,full_name,dni,phone,whatsapp").eq("id",sale.client_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from("sale_items").select("id,description,component_type,quantity,unit_price,unit_cost,discount,line_total").eq("sale_id",id).order("id"),
    supabase.from("optical_orders").select("order_code,status,lab,promised_at,delivered_at").eq("sale_id",id).maybeSingle(),
    supabase.from("sale_payments").select("id,paid_at,amount,payment_method,reference,notes").eq("sale_id",id).order("paid_at",{ascending:false})
  ]);
  const cost=(items??[]).reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_cost||0),0);
  const margin=Number(sale.total||0)-cost;
  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Detalle de venta</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">{sale.sale_code}</h1><p className="subtitle">{new Date(sale.sale_at).toLocaleString("es-PE")}</p></div><a className="btn btn-secondary" href="/ventas">Volver</a></div>
    {query.error&&<p className="notice" style={{marginTop:18}}>{query.error}</p>}{query.paid&&<p className="notice" style={{marginTop:18}}>Pago registrado.</p>}
    <section className="grid grid-4 section"><div className="card"><div className="metric-label">Total</div><div className="metric-value">S/ {Number(sale.total).toFixed(2)}</div></div><div className="card"><div className="metric-label">Costo</div><div className="metric-value">S/ {cost.toFixed(2)}</div></div><div className="card"><div className="metric-label">Margen bruto</div><div className="metric-value">S/ {margin.toFixed(2)}</div></div><div className="card"><div className="metric-label">Saldo</div><div className="metric-value">S/ {Number(sale.balance_due).toFixed(2)}</div></div></section>
    <section className="grid grid-3 section"><div className="card"><h2>Cliente</h2><p>{client?.full_name||"Venta de mostrador"}</p><p className="muted">{client?.dni||""} {client?.whatsapp||client?.phone||""}</p></div><div className="card"><h2>Venta</h2><p>{sale.payment_status} · {sale.payment_method||"Sin medio inicial"}</p><p className="muted">Responsable: {sale.responsible||"·"}</p></div><div className="card"><h2>Pedido óptico</h2><p>{order?.order_code||"Sin pedido"}</p><p className="muted">{order?.status||"No vinculado"} {order?.lab?"· "+order.lab:""}</p></div></section>
    {Number(sale.balance_due)>0&&<section className="card section"><h2>Registrar pago</h2><form action={registerPayment} className="form"><input type="hidden" name="sale_id" value={sale.id}/><div className="form-grid"><div className="field"><label>Monto</label><input name="amount" type="number" min="0.01" step="0.01" max={Number(sale.balance_due)} required/></div><div className="field"><label>Medio de pago</label><select name="method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div><div className="field"><label>Referencia</label><input name="reference"/></div><div className="field"><label>Notas</label><input name="notes"/></div></div><button className="btn btn-primary">Registrar pago</button></form></section>}
    <section className="section"><h2>Pagos</h2><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Monto</th><th>Medio</th><th>Referencia</th><th>Notas</th></tr></thead><tbody>{(payments??[]).map(p=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleString("es-PE")}</td><td>S/ {Number(p.amount).toFixed(2)}</td><td>{p.payment_method}</td><td>{p.reference||"·"}</td><td>{p.notes||"·"}</td></tr>)}{!payments?.length&&<tr><td colSpan={5} className="muted">Sin pagos registrados.</td></tr>}</tbody></table></div></section>
    <section className="section"><h2>Detalle de componentes</h2><div className="table-wrap"><table><thead><tr><th>Componente</th><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Costo</th><th>Desc.</th><th>Total</th></tr></thead><tbody>{(items??[]).map(i=><tr key={i.id}><td>{i.component_type}</td><td>{i.description}</td><td>{i.quantity}</td><td>S/ {Number(i.unit_price).toFixed(2)}</td><td>S/ {Number(i.unit_cost).toFixed(2)}</td><td>S/ {Number(i.discount).toFixed(2)}</td><td>S/ {Number(i.line_total).toFixed(2)}</td></tr>)}{!items?.length&&<tr><td colSpan={7} className="muted">Sin detalle.</td></tr>}</tbody></table></div></section>
  </div></main></div>;
}
