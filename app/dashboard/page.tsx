import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !branch) redirect("/onboarding");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: clients },
    { count: leads },
    { count: followUps },
    { count: orders },
    { count: products },
    { data: sales },
    { data: expenses },
    { data: lowStockRows },
    { data: pendingFollowUps }
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("follow_ups").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("optical_orders").select("*", { count: "exact", head: true }).not("status", "in", "(delivered,cancelled)"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("sales").select("id,total,payment_status,sale_at").gte("sale_at", monthStart).limit(1000),
    supabase.from("expenses").select("id,amount,status,expense_at").gte("expense_at", monthStart).limit(1000),
    supabase.from("products").select("id,product_code,brand,model,stock_qty,min_stock").eq("active", true).lte("stock_qty", 3).order("stock_qty").limit(10),
    supabase.from("follow_ups").select("id,followup_code,followup_type,next_action,next_action_at").eq("status", "open").order("next_action_at").limit(8)
  ]);

  const monthSales = (sales ?? []).filter((s) => s.payment_status !== "voided").reduce((sum, s) => sum + Number(s.total || 0), 0);
  const monthExpenses = (expenses ?? []).filter((e) => e.status !== "voided").reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Centro de control</strong>
          <span className="muted">{user.email}</span>
        </header>

        <div className="content">
          <div className="spread">
            <div>
              <h1 className="page-title">Centro de control</h1>
              <p className="subtitle">La operación de Visión Total, reunida en una sola memoria.</p>
            </div>
            <div className="notice">Mes actual · {now.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}</div>
          </div>

          <section className="grid grid-4 section">
            <div className="card"><div className="metric-label">Clientes</div><div className="metric-value">{clients ?? 0}</div></div>
            <div className="card"><div className="metric-label">Leads</div><div className="metric-value">{leads ?? 0}</div></div>
            <div className="card"><div className="metric-label">Seguimientos abiertos</div><div className="metric-value">{followUps ?? 0}</div></div>
            <div className="card"><div className="metric-label">Pedidos activos</div><div className="metric-value">{orders ?? 0}</div></div>
          </section>

          <section className="grid grid-3 section">
            <div className="card">
              <div className="metric-label">Ventas del mes</div>
              <div className="metric-value">S/ {monthSales.toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="metric-label">Gastos del mes</div>
              <div className="metric-value">S/ {monthExpenses.toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="metric-label">Resultado operativo</div>
              <div className="metric-value">S/ {(monthSales - monthExpenses).toFixed(2)}</div>
            </div>
          </section>

          <section className="grid grid-3 section">
            <div className="card" style={{ gridColumn: "span 2" }}>
              <h2>Próximas acciones</h2>
              {(pendingFollowUps ?? []).length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Código</th><th>Tipo</th><th>Próxima acción</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {(pendingFollowUps ?? []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.followup_code}</td>
                          <td>{item.followup_type}</td>
                          <td>{item.next_action || "·"}</td>
                          <td>{item.next_action_at ? new Date(item.next_action_at).toLocaleString("es-PE") : "Sin fecha"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No hay seguimientos pendientes.</p>}
            </div>

            <div className="card">
              <h2>Alertas de inventario</h2>
              <p className="metric-label">Productos activos: {products ?? 0}</p>
              {(lowStockRows ?? []).map((p) => (
                <div key={p.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <span>{[p.brand, p.model].filter(Boolean).join(" ") || p.product_code}</span>
                  <strong>{p.stock_qty}</strong>
                </div>
              ))}
              {!lowStockRows?.length && <p className="muted">No hay productos con stock igual o menor a 3.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
