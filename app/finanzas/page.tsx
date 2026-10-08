import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createExpense } from "./actions";

export default async function FinancePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: sales }, { data: salePayments }, { data: purchases }, { data: purchasePayments }, { data: expenses }, { data: saleItems }] = await Promise.all([
    supabase.from("sales").select("id,total,payment_status,sale_at").gte("sale_at", start).limit(1000),
    supabase.from("sale_payments").select("id,sale_id,amount,paid_at,payment_method").gte("paid_at", start).limit(1000),
    supabase.from("purchases").select("id,total,payment_status,purchase_at").gte("purchase_at", start).limit(1000),
    supabase.from("purchase_payments").select("id,purchase_id,amount,paid_at,payment_method").gte("paid_at", start).limit(1000),
    supabase.from("expenses").select("id,expense_code,expense_at,amount,status,category,description,supplier_name,payment_method,notes").gte("expense_at", start).limit(1000),
    supabase.from("sale_items").select("sale_id,quantity,unit_cost,line_total").limit(3000)
  ]);

  const saleMap = new Map((sales ?? []).map(s => [s.id, s]));
  const monthSales = (sales ?? []).filter(s => s.payment_status !== "voided").reduce((sum, s) => sum + Number(s.total || 0), 0);
  const monthCollected = (salePayments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const monthPurchases = (purchases ?? []).filter(p => p.payment_status !== "voided").reduce((sum, p) => sum + Number(p.total || 0), 0);
  const monthPurchasePaid = (purchasePayments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const monthExpenses = (expenses ?? []).filter(e => e.status !== "voided" && new Date(e.expense_at) >= new Date(start)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cogs = (saleItems ?? []).filter(i => saleMap.has(i.sale_id)).reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0);
  const grossMargin = monthSales - cogs;
  const cashMovement = monthCollected - monthPurchasePaid - monthExpenses;
  const pendingSales = (sales ?? []).filter(s => s.payment_status === "partial" || s.payment_status === "pending").reduce((sum, s) => sum + Math.max(Number(s.total || 0) - Number((salePayments ?? []).filter(p => p.sale_id === s.id).reduce((x,p)=>x+Number(p.amount||0),0)), 0), 0);

  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Finanzas</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Finanzas</h1>
          <p className="subtitle">Ventas, cobranzas, compras, gastos y caja del mes. El resultado distingue facturación de dinero realmente cobrado.</p>

          {params.error && <p className="notice" style={{marginTop:18}}>{params.error}</p>}
          {params.created && <p className="notice" style={{marginTop:18}}>Gasto registrado: {params.created}</p>}

          <section className="grid grid-4 section">
            <div className="card"><div className="metric-label">Ventas</div><div className="metric-value">S/ {monthSales.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Cobrado</div><div className="metric-value">S/ {monthCollected.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Margen bruto</div><div className="metric-value">S/ {grossMargin.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Caja neta registrada</div><div className="metric-value">S/ {cashMovement.toFixed(2)}</div></div>
          </section>

          <section className="grid grid-3 section">
            <div className="card"><div className="metric-label">Compras</div><div className="metric-value">S/ {monthPurchases.toFixed(2)}</div><p className="muted">Pagado: S/ {monthPurchasePaid.toFixed(2)}</p></div>
            <div className="card"><div className="metric-label">Gastos operativos</div><div className="metric-value">S/ {monthExpenses.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Cuentas por cobrar</div><div className="metric-value">S/ {pendingSales.toFixed(2)}</div></div>
          </section>

          <section className="card section">
            <h2>Registrar gasto</h2>
            <form action={createExpense} className="form">
              <div className="form-grid">
                <div className="field"><label>Categoría *</label><select name="category" defaultValue=""><option value="">Seleccionar</option><option>Alquiler</option><option>Servicios</option><option>Personal</option><option>Compras</option><option>Marketing</option><option>Transporte</option><option>Mantenimiento</option><option>Impuestos</option><option>Otros</option></select></div>
                <div className="field"><label>Descripción *</label><input name="description" placeholder="Ej. alquiler del local"/></div>
                <div className="field"><label>Monto *</label><input name="amount" type="number" min="0" step="0.01"/></div>
                <div className="field"><label>Medio de pago</label><select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div>
                <div className="field"><label>Proveedor</label><input name="supplier_name"/></div>
                <div className="field"><label>Notas</label><input name="notes"/></div>
              </div>
              <button className="btn btn-primary">Registrar gasto</button>
            </form>
          </section>

          <section className="section">
            <h2>Gastos recientes</h2>
            <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th>Pago</th></tr></thead><tbody>
              {(expenses ?? []).map(e=><tr key={e.id}><td>{e.id.slice(0,8)}</td><td>{new Date(e.expense_at).toLocaleString("es-PE")}</td><td>{e.category}</td><td>{e.description}</td><td>{e.supplier_name || "·"}</td><td>S/ {Number(e.amount).toFixed(2)}</td><td>{e.payment_method || "·"}</td></tr>)}
              {!expenses?.length&&<tr><td colSpan={7} className="muted">Todavía no hay gastos registrados.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
