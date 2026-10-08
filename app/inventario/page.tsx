import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createProduct, adjustStock } from "./actions";

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; adjusted?: string }>;
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

  const [{ data: products }, { data: locations }, { data: movements }] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_code, category, brand, model, description, cost, sale_price, stock_qty, min_stock, active")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("inventory_locations")
      .select("id, name, code")
      .eq("branch_id", branch.branch_id)
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("inventory_movements")
      .select("id, product_id, quantity, movement_type, note, created_at")
      .eq("branch_id", branch.branch_id)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const params = await searchParams;
  const lowStock = (products ?? []).filter((p) => Number(p.stock_qty) <= Number(p.min_stock ?? 0));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Inventario</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Inventario</h1>
          <p className="subtitle">Productos, ubicaciones y movimientos. El stock se actualiza desde movimientos reales.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Producto creado correctamente.</p>}
          {params.adjusted && <p className="notice" style={{ marginTop: 18 }}>Stock ajustado correctamente.</p>}

          <section className="grid grid-3 section">
            <div className="card"><div className="metric-label">Productos</div><div className="metric-value">{products?.length ?? 0}</div></div>
            <div className="card"><div className="metric-label">Stock bajo</div><div className="metric-value">{lowStock.length}</div></div>
            <div className="card"><div className="metric-label">Ubicaciones</div><div className="metric-value">{locations?.length ?? 0}</div></div>
          </section>

          <section className="grid grid-3 section">
            <div className="card" style={{ gridColumn: "span 2" }}>
              <h2>Nuevo producto</h2>
              <form action={createProduct} className="form">
                <div className="form-grid">
                  <div className="field"><label>Categoría</label><select name="category" defaultValue="Montura"><option>Montura</option><option>Lentes</option><option>Tratamiento</option><option>Accesorio</option><option>Servicio</option><option>Otro</option></select></div>
                  <div className="field"><label>Marca</label><input name="brand" placeholder="Ej. Ray-Ban" /></div>
                  <div className="field"><label>Modelo</label><input name="model" placeholder="Ej. RX123" /></div>
                  <div className="field"><label>Descripción</label><input name="description" placeholder="Color, forma, material, etc." /></div>
                  <div className="field"><label>Costo</label><input name="cost" type="number" min="0" step="0.01" /></div>
                  <div className="field"><label>Precio de venta</label><input name="sale_price" type="number" min="0" step="0.01" /></div>
                  <div className="field"><label>Stock inicial</label><input name="initial_stock" type="number" min="0" step="1" defaultValue="0" /></div>
                </div>
                <button className="btn btn-primary">Crear producto</button>
              </form>
            </div>

            <div className="card">
              <h2>Ajustar stock</h2>
              <form action={adjustStock} className="form">
                <div className="field"><label>Producto</label><select name="product_id" required defaultValue=""><option value="">Seleccionar</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.product_code} · {p.brand || ""} {p.model || p.description || ""}</option>)}</select></div>
                <div className="field"><label>Ubicación</label><select name="location_id" required defaultValue=""><option value="">Seleccionar</option>{(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                <div className="field"><label>Cantidad (+ entrada / - salida)</label><input name="delta" type="number" step="1" required /></div>
                <div className="field"><label>Motivo</label><input name="note" placeholder="Compra, conteo, daño, etc." /></div>
                <button className="btn btn-secondary">Aplicar movimiento</button>
              </form>
            </div>
          </section>

          <section className="section">
            <h2>Productos</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Costo</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead>
                <tbody>
                  {(products ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.product_code}</td>
                      <td>{[p.brand, p.model].filter(Boolean).join(" ") || p.description || "Sin descripción"}</td>
                      <td>{p.category}</td>
                      <td>S/ {Number(p.cost).toFixed(2)}</td>
                      <td>S/ {Number(p.sale_price).toFixed(2)}</td>
                      <td>{p.stock_qty}</td>
                      <td>{Number(p.stock_qty) <= Number(p.min_stock) ? "Stock bajo" : "OK"}</td>
                    </tr>
                  ))}
                  {!products?.length && <tr><td colSpan={7} className="muted">Todavía no hay productos.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h2>Últimos movimientos</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Nota</th><th>Fecha</th></tr></thead>
                <tbody>
                  {(movements ?? []).map((m) => {
                    const product = (products ?? []).find((p) => p.id === m.product_id);
                    return <tr key={m.id}><td>{product?.product_code || m.product_id}</td><td>{m.movement_type}</td><td>{m.quantity}</td><td>{m.note || "·"}</td><td>{new Date(m.created_at).toLocaleString("es-PE")}</td></tr>;
                  })}
                  {!movements?.length && <tr><td colSpan={5} className="muted">Todavía no hay movimientos.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
