import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function ReportsPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const now=new Date();
  const from=new Date(now.getFullYear(),now.getMonth()-5,1);
  const [{data:sales},{data:expenses},{data:leads},{data:items},{data:products}] = await Promise.all([
    supabase.from("sales").select("id,sale_at,total,payment_status,client_id").gte("sale_at",from.toISOString()).order("sale_at"),
    supabase.from("expenses").select("id,expense_at,amount,status,category").gte("expense_at",from.toISOString()).order("expense_at"),
    supabase.from("leads").select("id,stage,created_at"),
    supabase.from("sale_items").select("id,product_id,line_total,quantity,description,component_type").limit(3000),
    supabase.from("products").select("id,product_code,brand,model").eq("active",true)
  ]);

  const months=Array.from({length:6},(_,i)=>new Date(now.getFullYear(),now.getMonth()-5+i,1));
  const monthly=months.map(m=>{
    const key=`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}`;
    const monthSales=(sales??[]).filter(s=>{const d=new Date(s.sale_at);return d.getFullYear()===m.getFullYear()&&d.getMonth()===m.getMonth()&&s.payment_status!=="voided";}).reduce((a,s)=>a+Number(s.total||0),0);
    const monthExpenses=(expenses??[]).filter(e=>{const d=new Date(e.expense_at);return d.getFullYear()===m.getFullYear()&&d.getMonth()===m.getMonth()&&e.status!=="voided";}).reduce((a,e)=>a+Number(e.amount||0),0);
    return {key,label:m.toLocaleDateString("es-PE",{month:"short",year:"numeric"}),sales:monthSales,expenses:monthExpenses,result:monthSales-monthExpenses};
  });

  const productMap=new Map((products??[]).map(p=>[p.id,[p.brand,p.model].filter(Boolean).join(" ")||p.product_code]));
  const productRevenue=new Map<string,number>();
  for(const item of (items??[])){
    if(item.product_id) productRevenue.set(item.product_id,(productRevenue.get(item.product_id)||0)+Number(item.line_total||0));
  }
  const topProducts=[...productRevenue.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);

  const leadStages=["new","contacted","interested","quoted","pending","won","lost"];
  const leadStageCounts=leadStages.map(stage=>[stage,(leads??[]).filter(l=>l.stage===stage).length] as const);
  const conversion=(leads??[]).length ? ((leads??[]).filter(l=>l.stage==="won").length/(leads??[]).length*100) : 0;

  const sixMonthSales=monthly.reduce((a,m)=>a+m.sales,0);
  const sixMonthExpenses=monthly.reduce((a,m)=>a+m.expenses,0);
  const avgTicket=(sales??[]).length ? sixMonthSales/(sales??[]).filter(s=>s.payment_status!=="voided").length : 0;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Reportes</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Reportes</h1><p className="subtitle">Lectura del negocio para tomar decisiones con datos, no con memoria.</p>

    <section className="grid grid-4 section">
      <div className="card"><div className="metric-label">Ventas 6 meses</div><div className="metric-value">S/ {sixMonthSales.toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Gastos 6 meses</div><div className="metric-value">S/ {sixMonthExpenses.toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Resultado 6 meses</div><div className="metric-value">S/ {(sixMonthSales-sixMonthExpenses).toFixed(2)}</div></div>
      <div className="card"><div className="metric-label">Ticket promedio</div><div className="metric-value">S/ {avgTicket.toFixed(2)}</div></div>
    </section>

    <section className="section"><h2>Evolución mensual</h2><div className="table-wrap"><table><thead><tr><th>Mes</th><th>Ventas</th><th>Gastos</th><th>Resultado</th></tr></thead><tbody>
      {monthly.map(m=><tr key={m.key}><td>{m.label}</td><td>S/ {m.sales.toFixed(2)}</td><td>S/ {m.expenses.toFixed(2)}</td><td>S/ {m.result.toFixed(2)}</td></tr>)}
    </tbody></table></div></section>

    <section className="grid grid-3 section">
      <div className="card" style={{gridColumn:"span 2"}}><h2>Productos con mayor facturación</h2><div className="table-wrap"><table><thead><tr><th>#</th><th>Producto</th><th>Facturación</th></tr></thead><tbody>
        {topProducts.map(([id,revenue],i)=><tr key={id}><td>{i+1}</td><td>{productMap.get(id)||id}</td><td>S/ {revenue.toFixed(2)}</td></tr>)}
        {!topProducts.length&&<tr><td colSpan={3} className="muted">Todavía no hay ventas de productos.</td></tr>}
      </tbody></table></div></div>
      <div className="card"><h2>Embudo de leads</h2><p className="muted">Conversión total: {conversion.toFixed(1)}%</p>
        {leadStageCounts.map(([stage,count])=><div key={stage} className="spread" style={{padding:"9px 0",borderBottom:"1px solid var(--line)"}}><span>{stage}</span><strong>{count}</strong></div>)}
      </div>
    </section>
  </div></main></div>;
}
