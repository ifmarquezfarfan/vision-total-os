import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createOrder, updateOrderStatus } from "./actions";

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const [{ data: clients }, { data: sales }, { data: orders }] = await Promise.all([
    supabase.from("clients").select("id, full_name, dni").order("full_name").limit(300),
    supabase.from("sales").select("id, sale_code, client_id").order("sale_at", { ascending: false }).limit(200),
    supabase.from("optical_orders").select("id, order_code, client_id, sale_id, status, lab, promised_at, delivered_at, notes, created_at").order("created_at", { ascending: false }).limit(100)
  ]);

  const params = await searchParams;
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Pedidos ópticos</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Pedidos ópticos</h1>
          <p className="subtitle">Controla el pedido desde recepción hasta entrega al cliente.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Pedido creado: {params.created}</p>}
          {params.updated && <p className="notice" style={{ marginTop: 18 }}>Estado actualizado.</p>}

          <section className="card section">
            <h2>Nuevo pedido</h2>
            <form action={createOrder} className="form">
              <div className="form-grid">
                <div className="field"><label>Cliente *</label><select name="client_id" required defaultValue=""><option value="">Seleccionar</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.dni ? ` · ${c.dni}` : ""}</option>)}</select></div>
                <div className="field"><label>Venta relacionada</label><select name="sale_id" defaultValue=""><option value="">Ninguna</option>{(sales ?? []).map((s) => <option key={s.id} value={s.id}>{s.sale_code} · {s.client_id ? clientMap.get(s.client_id) || "" : "Mostrador"}</option>)}</select></div>
                <div className="field"><label>Laboratorio</label><input name="lab" placeholder="Laboratorio óptico" /></div>
                <div className="field"><label>Fecha prometida</label><input name="promised_at" type="datetime-local" /></div>
                <div className="field"><label>Estado inicial</label><select name="status" defaultValue="received"><option value="received">Recibido</option><option value="in_preparation">En preparación</option><option value="at_lab">En laboratorio</option><option value="ready">Listo</option></select></div>
                <div className="field"><label>Notas</label><input name="notes" placeholder="Detalles del pedido" /></div>
              </div>
              <button className="btn btn-primary">Crear pedido</button>
            </form>
          </section>

          <section className="section">
            <h2>Pedidos recientes</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Cliente</th><th>Estado</th><th>Laboratorio</th><th>Prometido</th><th>Actualización</th></tr></thead>
                <tbody>
                  {(orders ?? []).map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_code}</td>
                      <td>{clientMap.get(o.client_id) || "Cliente"}</td>
                      <td>{o.status}</td>
                      <td>{o.lab || "·"}</td>
                      <td>{o.promised_at ? new Date(o.promised_at).toLocaleString("es-PE") : "·"}</td>
                      <td>
                        <form action={updateOrderStatus} className="inline">
                          <input type="hidden" name="order_id" value={o.id} />
                          <select name="status" defaultValue={o.status}>
                            <option value="received">Recibido</option>
                            <option value="in_preparation">En preparación</option>
                            <option value="at_lab">En laboratorio</option>
                            <option value="ready">Listo</option>
                            <option value="delivered">Entregado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                          <button className="btn btn-secondary">Guardar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!orders?.length && <tr><td colSpan={6} className="muted">Todavía no hay pedidos ópticos.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
