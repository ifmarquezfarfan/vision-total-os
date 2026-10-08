import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function SaleDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:sale}=await supabase.from("sales").select("id,sale_code,sale_at,client_id,subtotal,discount,total,paid_amount,balance_due,payment_status,payment_method,responsible,notes").eq("id",id).maybeSingle();
  if(!sale) redirect("/ventas?error=Venta%20no%20encontrada");

  const [{data:client},{data:items},{data:order}]=await Promise.all([
    sale.client_id ? supabase.from("clients").select("id,full_name,dni,phone,whatsapp").eq("id",sale.client_id).maybeSingle() : Promise.resolve({data:null}),
    supabase.from("sale_items").select("id,description,component_type,quantity,unit_price,unit_cost,discount,line_total").eq("sale_id",id).order("id"),
    supabase.from("optical_orders").select("order_code,status,lab,promised_at,delivered_at").eq("sale_id",id).maybeSingle()
  ]);

  const cost=(items??[]).reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_cost||0),0);
  const margin=Number(sale.total||0)-cost;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Detalle de venta</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">{sale.sale_code}</h1><p className="subtitle">{new Date(sale.sale_at).toLocaleString("es-PE")}</p></div><a className="btn btn-secondary" href="/ventas">Volver</a></div>
    <section className="grid grid-4 section">
      <div className="card"><div className="metric-label">Total</div><div className="metric-value">S/ {Number(sale.total).toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Costo</div><div className="metric-value">S/ {cost.toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Margen bruto</div><div className="metric-value">S/ {margin.toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Saldo</div><div className="metric-value">S/ {Number(sale.balance_due).toFixed(2)}</div></div>
    </section>
    <section className="grid grid-3 section">
      <div className="card"><h2>Cliente</h2><p>{client?.full_name||"Venta de mostrador"}</p><p className="muted">{client?.dni||""} {client?.whatsapp||client?.phone||""}</p></div>
      <div className="card"><h2>Pago</h2><p>{sale.payment_method||"·"} · {sale.payment_status}</p><p className="muted">Pagado S/ {Number(sale.paid_amount).toFixed(2)}</p></div>
      <div className="card"><h2>Pedido óptico</h2><p>{order?.order_code||"Sin pedido"}</p><p className="muted">{order?.status||"No vinculado"} {order?.lab ? "· "+order.lab : ""}</p></div>
    </section>
    <section className="section"><h2>Detalle de componentes</h2><div className="table-wrap"><table><thead><tr><th>Componente</th><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Costo</th><th>Desc.</th><th>Total</th></tr></thead><tbody>
      {(items??[]).map(i=><tr key={i.id}><td>{i.component_type}</td><td>{i.description}</td><td>{i.quantity}</td><td>S/ {Number(i.unit_price).toFixed(2)}</td><td>S/ {Number(i.unit_cost).toFixed(2)}</td><td>S/ {Number(i.discount).toFixed(2)}</td><td>S/ {Number(i.line_total).toFixed(2)}</td></tr>)}
      {!items?.length&&<tr><td colSpan={7} className="muted">Sin detalle.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
