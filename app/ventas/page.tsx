import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SaleBuilder } from "@/components/sale-builder";
import { ClientPicker } from "@/components/client-picker";
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
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: branch } = await supabase
    .from("branch_members")
    .select("branch_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || !branch) redirect("/onboarding");

  const [{ data: clients }, { data: leads }, { data: products }, { data: sales }] = await Promise.all([
    supabase.from("clients").select("id,full_name,dni").order("full_name").limit(300),
    supabase.from("leads").select("id,lead_code,full_name,client_id,stage").not("stage","eq","lost").order("created_at",{ascending:false}).limit(300),
    supabase.from("products").select("id,product_code,category,brand,model,description,cost,sale_price,stock_qty,inventory_mode").eq("active",true).order("brand").limit(500),
    supabase.from("sales").select("id,sale_code,sale_at,client_id,lead_id,subtotal,discount,total,paid_amount,balance_due,payment_status,payment_method,responsible").order("sale_at",{ascending:false}).limit(100)
  ]);

  const params = await searchParams;
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.full_name]));
  const leadMap = new Map((leads ?? []).map(l => [l.id, l.lead_code]));
  const showCostField = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Ventas</strong>
          <Link href="/perfil" className="muted">{user.email}</Link>
        </header>

        <div className="content">
          <div className="spread">
            <div>
              <h1 className="page-title">Nueva venta</h1>
              <p className="subtitle">Venta rápida para óptica: cliente → componentes → pago → inventario → postventa.</p>
            </div>
            <Link href="/perfil" className="btn btn-secondary">Mi perfil</Link>
          </div>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Venta registrada: {params.created}</p>}

          <section className="card section">
            <h2>Datos de la venta</h2>
            <form action={createSale} className="form">
              <div className="form-grid">
                <div className="field">
                  <label>Cliente</label>
                  <select name="client_id" defaultValue="">
                    <option value="">Venta de mostrador</option>
                    {(clients ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}{c.dni ? ` · ${c.dni}` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Lead relacionado</label>
                  <select name="lead_id" defaultValue="">
                    <option value="">Sin lead</option>
                    {(leads ?? []).map(l => (
                      <option key={l.id} value={l.id}>{l.lead_code} · {l.full_name}{l.stage ? ` · ${l.stage}` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Medio de pago</label>
                  <select name="payment_method" defaultValue="">
                    <option value="">Seleccionar</option>
                    <option>Efectivo</option>
                    <option>Yape</option>
                    <option>Plin</option>
                    <option>Tarjeta</option>
                    <option>Transferencia</option>
                    <option>Otro</option>
                  </select>
                </div>

                <div className="field">
                  <label>Pagado ahora</label>
                  <input name="paid_amount" type="number" min="0" step="0.01" defaultValue="0" />
                </div>

                <div className="field">
                  <label>Descuento global</label>
                  <input name="sale_discount" type="number" min="0" step="0.01" defaultValue="0" />
                </div>

                <div className="field">
                  <label>Responsable</label>
                  <input name="responsible" defaultValue={user.email ?? ""} />
                </div>
              </div>

              <div className="card" style={{ marginTop: 18 }}>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Componentes de la venta</h2>
                    <p className="muted">Montura, lunas, tratamientos, accesorios y servicios pueden combinarse en una sola venta.</p>
                  </div>
                  <span className="muted">Sucursal actual: 1</span>
                </div>
                <SaleBuilder products={products ?? []} showCostField={showCostField} allowPriceOverride={showCostField} />
              </div>

              <div className="notice" style={{ marginTop: 16 }}>
                <strong>Inventario:</strong> los productos seleccionados desde aquí están enlazados con el stock. Al registrar una venta, el sistema descuenta automáticamente la existencia disponible y usa el costo vigente de la ficha del producto. Los componentes personalizados no consumen stock.
              </div>

              <div className="notice" style={{ marginTop: 10 }}>
                <strong>Óptica:</strong> una venta de lentes/montura puede continuar en <Link href="/pedidos" className="link-strong">Pedidos ópticos</Link>, donde se gestionan receta, laboratorio, tratamientos, control de calidad, entrega y medidas de montaje.
              </div>
            </form>
          </section>

          <section className="section">
            <h2>Últimas ventas</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Lead</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {(sales ?? []).map(s => (
                    <tr key={s.id}>
                      <td><Link href={`/ventas/${s.id}`} className="link-strong">{s.sale_code}</Link></td>
                      <td>{new Date(s.sale_at).toLocaleString("es-PE")}</td>
                      <td>{s.client_id ? clientMap.get(s.client_id) || "Cliente" : "Mostrador"}</td>
                      <td>{s.lead_id ? leadMap.get(s.lead_id) || "Lead" : "·"}</td>
                      <td>S/ {Number(s.total).toFixed(2)}</td>
                      <td>S/ {Number(s.paid_amount).toFixed(2)}</td>
                      <td>S/ {Number(s.balance_due).toFixed(2)}</td>
                      <td>{s.payment_status}</td>
                      <td><Link href={`/ventas/${s.id}`} className="link-strong">Ver</Link></td>
                    </tr>
                  ))}
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
