import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { QuickStart } from "@/components/quick-start";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const [
    { count: clients },
    { count: leads },
    { count: followUps },
    { count: orders },
    { count: readyOrders },
    { data: sales },
    { data: expenses },
    { data: products },
    { data: pendingFollowUps },
    { data: activeOrders },
  ] = await Promise.all([
    supabase.from("clients").select("*",{count:"exact",head:true}),
    supabase.from("leads").select("*",{count:"exact",head:true}),
    supabase.from("follow_ups").select("*",{count:"exact",head:true}).eq("status","open"),
    supabase.from("optical_orders").select("*",{count:"exact",head:true}).not("status","in","(delivered,cancelled)"),
    supabase.from("optical_orders").select("*",{count:"exact",head:true}).eq("status","ready"),
    supabase.from("sales").select("id,total,payment_status,sale_at").gte("sale_at",monthStart).limit(1000),
    supabase.from("expenses").select("id,amount,status,expense_at").gte("expense_at",monthStart).limit(1000),
    supabase.from("products").select("id,product_code,brand,model,stock_qty,min_stock,inventory_mode").eq("active",true).limit(500),
    supabase.from("follow_ups").select("id,followup_code,followup_type,next_action,next_action_at").eq("status","open").order("next_action_at",{ascending:true,nullsFirst:true}).limit(12),
    supabase.from("optical_orders").select("id,order_code,client_id,status,promised_at").not("status","in","(delivered,cancelled)").order("promised_at",{ascending:true,nullsFirst:false}).limit(8),
  ]);

  const monthSales=(sales??[]).filter(s=>s.payment_status!=="voided").reduce((sum,s)=>sum+Number(s.total||0),0);
  const monthExpenses=(expenses??[]).filter(e=>e.status!=="voided").reduce((sum,e)=>sum+Number(e.amount||0),0);
  const lowStockRows=(products??[]).filter(p=>Number(p.inventory_mode==="stock"?p.stock_qty:0)<=Number(p.min_stock??0)&&p.inventory_mode==="stock").sort((a,b)=>Number(a.stock_qty)-Number(b.stock_qty)).slice(0,10);
  const dueActions=(pendingFollowUps??[]).filter(item=>!item.next_action_at || new Date(item.next_action_at)<=new Date(todayEnd));

  const clientMap = new Map<string,string>();
  const orderClientIds = [...new Set((activeOrders??[]).map(o=>o.client_id).filter(Boolean))];
  if (orderClientIds.length) {
    const { data: orderClients } = await supabase.from("clients").select("id,full_name").in("id",orderClientIds);
    for (const client of orderClients??[]) clientMap.set(client.id,client.full_name);
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Centro de control</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <div className="spread">
            <div><h1 className="page-title">Centro de control</h1><p className="subtitle">La operación de Visión Total, reunida en una sola memoria.</p></div>
            <div className="notice">Mes actual · {now.toLocaleDateString("es-PE",{month:"long",year:"numeric"})}</div>
          </div>

          <QuickStart title="¿Qué hago ahora?" hint="Abre el módulo según la acción que quieras completar, no según dónde recuerdes haber visto el dato." items={[
      {label:"Registrar venta",href:"/ventas",description:"Caja + productos + pago",tone:"green"},
      {label:"Crear pedido óptico",href:"/pedidos",description:"Receta + lunas + laboratorio",tone:"purple"},
      {label:"Revisar agenda",href:"/seguimientos",description:"Próximas acciones",tone:"orange"},
      {label:"Revisar stock",href:"/inventario",description:"Qué hay y qué falta",tone:"blue"}
    ]}/>
          <section className="grid grid-4 section">
            <div className="card"><div className="metric-label">Clientes</div><div className="metric-value">{clients??0}</div></div>
            <div className="card"><div className="metric-label">Leads</div><div className="metric-value">{leads??0}</div></div>
            <div className="card"><div className="metric-label">Seguimientos abiertos</div><div className="metric-value">{followUps??0}</div></div>
            <div className="card"><div className="metric-label">Pedidos activos</div><div className="metric-value">{orders??0}</div></div>
          </section>

          <section className="grid grid-3 section">
            <div className="card"><div className="metric-label">Ventas del mes</div><div className="metric-value">S/ {monthSales.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Gastos del mes</div><div className="metric-value">S/ {monthExpenses.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Resultado operativo</div><div className="metric-value">S/ {(monthSales-monthExpenses).toFixed(2)}</div></div>
          </section>

          <section className="grid grid-4 section">
            <Link href="/seguimientos" className="card action-card"><div className="metric-label">Acción</div><strong style={{fontSize:18}}>Revisar agenda</strong><p className="muted">{dueActions.length} pendiente(s) para hoy o atrasados.</p></Link>
            <Link href="/pedidos" className="card action-card"><div className="metric-label">Producción</div><strong style={{fontSize:18}}>Pedidos listos</strong><p className="muted">{readyOrders??0} pedido(s) esperan recojo/entrega.</p></Link>
            <Link href="/ventas" className="card action-card"><div className="metric-label">Venta</div><strong style={{fontSize:18}}>Registrar venta</strong><p className="muted">Abre la caja óptica rápida.</p></Link>
            <Link href="/inventario" className="card action-card"><div className="metric-label">Inventario</div><strong style={{fontSize:18}}>Revisar stock</strong><p className="muted">{lowStockRows.length} artículo(s) bajo mínimo.</p></Link>
          </section>

          <section className="grid grid-3 section">
            <div className="card" style={{gridColumn:"span 2"}}>
              <h2>Próximas acciones</h2>
              {(pendingFollowUps??[]).length ? <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Acción</th><th>Fecha</th></tr></thead><tbody>
                {(pendingFollowUps??[]).map(item=><tr key={item.id}><td>{item.followup_type}</td><td>{item.next_action||"Revisar"} </td><td>{item.next_action_at?new Date(item.next_action_at).toLocaleString("es-PE"):"Sin fecha"}</td></tr>)}
              </tbody></table></div> : <p className="muted">No hay seguimientos pendientes.</p>}
            </div>

            <div className="card">
              <h2>Alertas de inventario</h2>
              {lowStockRows.map(p=><div key={p.id} className="spread" style={{padding:"10px 0",borderBottom:"1px solid var(--line)"}}><Link href={"/inventario/"+p.id}>{[p.brand,p.model].filter(Boolean).join(" ")||p.product_code}</Link><strong>{p.stock_qty}</strong></div>)}
              {!lowStockRows.length&&<p className="muted">No hay artículos por debajo del mínimo.</p>}
            </div>
          </section>

          <section className="card section">
            <div className="spread"><div><h2>Pedidos en curso</h2><p className="muted">Lo que debe moverse hoy en taller/laboratorio.</p></div><Link href="/pedidos" className="link-strong">Ver todos</Link></div>
            <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Prometido</th></tr></thead><tbody>
              {(activeOrders??[]).map(o=><tr key={o.id}><td><Link href={"/pedidos/"+o.id} className="link-strong">{o.order_code}</Link></td><td>{o.client_id?clientMap.get(o.client_id)||"Cliente":"·"}</td><td><span className={`status-badge ${o.status==="ready"?"status-info":o.status==="cancelled"?"status-danger":"status-warning"}`}>{o.status}</span></td><td>{o.promised_at?new Date(o.promised_at).toLocaleString("es-PE"):"Sin fecha"}</td></tr>)}
              {!activeOrders?.length&&<tr><td colSpan={4} className="muted">No hay pedidos activos.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
