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
  const [{ data: expenses }, { data: sales }] = await Promise.all([
    supabase.from("expenses").select("id, expense_code, expense_at, category, description, amount, payment_method, supplier_name, status").order("expense_at", { ascending: false }).limit(100),
    supabase.from("sales").select("id, total, payment_status, sale_at").gte("sale_at", start).limit(500)
  ]);

  const monthSales = (sales ?? []).filter((s) => s.payment_status !== "voided").reduce((sum, s) => sum + Number(s.total || 0), 0);
  const monthExpenses = (expenses ?? []).filter((e) => e.status !== "voided" && new Date(e.expense_at) >= new Date(start)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cashResult = monthSales - monthExpenses;
  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Finanzas</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Finanzas</h1>
          <p className="subtitle">Ingresos registrados, gastos y resultado operativo del mes.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Gasto registrado: {params.created}</p>}

          <section className="grid grid-3 section">
            <div className="card"><div className="metric-label">Ventas del mes</div><div className="metric-value">S/ {monthSales.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Gastos del mes</div><div className="metric-value">S/ {monthExpenses.toFixed(2)}</div></div>
            <div className="card"><div className="metric-label">Resultado operativo</div><div className="metric-value">S/ {cashResult.toFixed(2)}</div></div>
          </section>

          <section className="card section">
            <h2>Registrar gasto</h2>
            <form action={createExpense} className="form">
              <div className="form-grid">
                <div className="field"><label>Categoría *</label><select name="category" defaultValue=""><option value="">Seleccionar</option><option>Alquiler</option><option>Servicios</option><option>Personal</option><option>Compras</option><option>Marketing</option><option>Transporte</option><option>Mantenimiento</option><option>Impuestos</option><option>Otros</option></select></div>
                <div className="field"><label>Descripción *</label><input name="description" placeholder="Ej. alquiler del local" /></div>
                <div className="field"><label>Monto *</label><input name="amount" type="number" min="0" step="0.01" /></div>
                <div className="field"><label>Medio de pago</label><select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div>
                <div className="field"><label>Proveedor</label><input name="supplier_name" /></div>
                <div className="field"><label>Notas</label><input name="notes" /></div>
              </div>
              <button className="btn btn-primary">Registrar gasto</button>
            </form>
          </section>

          <section className="section">
            <h2>Gastos recientes</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th>Pago</th></tr></thead>
                <tbody>
                  {(expenses ?? []).map((e) => <tr key={e.id}><td>{e.expense_code}</td><td>{new Date(e.expense_at).toLocaleString("es-PE")}</td><td>{e.category}</td><td>{e.description}</td><td>{e.supplier_name || "·"}</td><td>S/ {Number(e.amount).toFixed(2)}</td><td>{e.payment_method || "·"}</td></tr>)}
                  {!expenses?.length && <tr><td colSpan={7} className="muted">Todavía no hay gastos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
