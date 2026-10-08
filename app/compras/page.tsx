import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createPurchase, createSupplier } from "./actions";

export default async function PurchasesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; created_supplier?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const [{ data: suppliers }, { data: products }, { data: purchases }] = await Promise.all([
    supabase.from("suppliers").select("id,name,tax_id,phone,whatsapp,active").eq("active", true).order("name").limit(300),
    supabase.from("products").select("id,product_code,brand,model,description,cost,stock_qty").eq("active", true).order("brand").limit(300),
    supabase.from("purchases").select("id,purchase_code,purchase_at,supplier_id,subtotal,discount,total,paid_amount,balance_due,payment_status,status").order("purchase_at",{ascending:false}).limit(100)
  ]);
  const params = await searchParams;
  const supplierMap = new Map((suppliers ?? []).map(s => [s.id,s.name]));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Compras</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Compras y proveedores</h1>
          <p className="subtitle">Cada compra recibida alimenta el inventario y deja trazabilidad de costo y pago.</p>

          {params.error && <p className="notice" style={{marginTop:18}}>{params.error}</p>}
          {params.created && <p className="notice" style={{marginTop:18}}>Compra registrada: {params.created}</p>}
          {params.created_supplier && <p className="notice" style={{marginTop:18}}>Proveedor creado.</p>}

          <section className="grid grid-3 section">
            <div className="card" style={{gridColumn:"span 2"}}>
              <h2>Nueva compra</h2>
              <form action={createPurchase} className="form">
                <div className="form-grid">
                  <div className="field"><label>Proveedor</label><select name="supplier_id" defaultValue=""><option value="">Sin proveedor</option>{(suppliers ?? []).map(s=><option key={s.id} value={s.id}>{s.name}{s.tax_id ? ` · ${s.tax_id}` : ""}</option>)}</select></div>
                  <div className="field"><label>Descuento global</label><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></div>
                  <div className="field"><label>Pagado</label><input name="paid_amount" type="number" min="0" step="0.01" defaultValue="0"/></div>
                  <div className="field"><label>Medio de pago</label><select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></div>
                  <div className="field" style={{gridColumn:"span 2"}}><label>Notas</label><input name="notes"/></div>
                </div>
                <div className="table-wrap"><table style={{minWidth:1000}}><thead><tr><th>Producto</th><th>Descripción</th><th>Cant.</th><th>Costo unitario</th></tr></thead><tbody>
                  {[1,2,3,4,5].map(i=><tr key={i}>
                    <td><select name={`product_${i}`} defaultValue=""><option value="">Personalizado</option>{(products ?? []).map(p=><option key={p.id} value={p.id}>{p.product_code} · {p.brand || ""} {p.model || ""}</option>)}</select></td>
                    <td><input name={`description_${i}`} placeholder="Descripción"/></td>
                    <td><input name={`quantity_${i}`} type="number" min="1" step="1" defaultValue={i===1?"1":"0"}/></td>
                    <td><input name={`cost_${i}`} type="number" min="0" step="0.01"/></td>
                  </tr>)}
                </tbody></table></div>
                <button className="btn btn-primary">Registrar compra</button>
              </form>
            </div>

            <div className="card">
              <h2>Nuevo proveedor</h2>
              <form action={createSupplier} className="form">
                <div className="field"><label>Nombre *</label><input name="name" required/></div>
                <div className="field"><label>RUC / identificación</label><input name="tax_id"/></div>
                <div className="field"><label>Teléfono</label><input name="phone"/></div>
                <div className="field"><label>WhatsApp</label><input name="whatsapp"/></div>
                <div className="field"><label>Correo</label><input name="email" type="email"/></div>
                <div className="field"><label>Dirección</label><input name="address"/></div>
                <button className="btn btn-secondary">Crear proveedor</button>
              </form>
            </div>
          </section>

          <section className="section">
            <h2>Historial de compras</h2>
            <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha</th><th>Proveedor</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Pago</th><th>Estado</th></tr></thead><tbody>
              {(purchases ?? []).map(p=><tr key={p.id}><td>{p.purchase_code}</td><td>{new Date(p.purchase_at).toLocaleString("es-PE")}</td><td>{p.supplier_id ? supplierMap.get(p.supplier_id)||"Proveedor" : "·"}</td><td>S/ {Number(p.total).toFixed(2)}</td><td>S/ {Number(p.paid_amount).toFixed(2)}</td><td>S/ {Number(p.balance_due).toFixed(2)}</td><td>{p.payment_status}</td><td>{p.status}</td></tr>)}
              {!purchases?.length&&<tr><td colSpan={8} className="muted">Todavía no hay compras registradas.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
