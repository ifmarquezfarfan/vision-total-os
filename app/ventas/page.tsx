import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createSale } from "./actions";

export default async function SalesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
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

  const [{ data: clients }, { data: products }, { data: sales }] = await Promise.all([
    supabase.from("clients").select("id, full_name, dni").order("full_name").limit(300),
    supabase.from("products").select("id, product_code, category, brand, model, description, cost, sale_price, stock_qty").eq("active", true).order("brand").limit(300),
    supabase.from("sales").select("id, sale_code, sale_at, client_id, subtotal, discount, total, paid_amount, balance_due, payment_status, payment_method, responsible").order("sale_at", { ascending: false }).limit(100)
  ]);

  const params = await searchParams;
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Ventas</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Ventas</h1>
          <p className="subtitle">Una venta enlaza cliente, productos, pagos, inventario y postventa.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Venta registrada: {params.created}</p>}

          <section className="card section">
            <h2>Nueva venta</h2>
            <form action={createSale} className="form">
              <div className="form-grid">
                <div className="field"><label>Cliente</label><select name="client_id" defaultValue=""><option value="">Venta sin cliente</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.dni ? ` · ${c.dni}` : ""}</option>)}</select></div>
                <div className="field"><label>Medio de pago</label><select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div>
                <div className="field"><label>Pagado</label><input name="paid_amount" type="number" min="0" step="0.01" defaultValue="0" /></div>
                <div className="field"><label>Descuento global</label><input name="sale_discount" type="number" min="0" step="0.01" defaultValue="0" /></div>
                <div className="field"><label>Responsable</label><input name="responsible" placeholder="Nombre del vendedor" /></div>
              </div>

              <div className="table-wrap">
                <table style={{ minWidth: 980 }}>
                  <thead><tr><th>Producto</th><th>Componente</th><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Costo</th><th>Desc.</th></tr></thead>
                  <tbody>
                    {[1,2,3,4].map((i) => (
                      <tr key={i}>
                        <td><select name={`product_${i}`} defaultValue=""><option value="">Personalizado</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.product_code} · {p.brand || ""} {p.model || ""} · stock {p.stock_qty}</option>)}</select></td>
                        <td><select name={`component_${i}`} defaultValue="other"><option value="frame">Montura</option><option value="lens">Lentes</option><option value="treatment">Tratamiento</option><option value="service">Servicio</option><option value="accessory">Accesorio</option><option value="other">Otro</option></select></td>
                        <td><input name={`description_${i}`} placeholder="Descripción" /></td>
                        <td><input name={`quantity_${i}`} type="number" min="1" step="1" defaultValue={i === 1 ? "1" : "0"} /></td>
                        <td><input name={`price_${i}`} type="number" min="0" step="0.01" /></td>
                        <td><input name={`cost_${i}`} type="number" min="0" step="0.01" /></td>
                        <td><input name={`discount_${i}`} type="number" min="0" step="0.01" defaultValue="0" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-primary">Registrar venta</button>
            </form>
          </section>

          <section className="section">
            <h2>Últimas ventas</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Subtotal</th><th>Descuento</th><th>Total</th><th>Pago</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {(sales ?? []).map((s) => <tr key={s.id}><td>{s.sale_code}</td><td>{new Date(s.sale_at).toLocaleString("es-PE")}</td><td>{s.client_id ? clientMap.get(s.client_id) || "Cliente" : "Mostrador"}</td><td>S/ {Number(s.subtotal).toFixed(2)}</td><td>S/ {Number(s.discount).toFixed(2)}</td><td>S/ {Number(s.total).toFixed(2)}</td><td>S/ {Number(s.paid_amount).toFixed(2)}</td><td>S/ {Number(s.balance_due).toFixed(2)}</td><td>{s.payment_status}</td></tr>)}
                  {!sales?.length && <tr><td colSpan={9} className="muted">Todavía no hay ventas.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
