import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createClientRecord } from "./actions";

export default async function ClientsPage({
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

  if (!membership) redirect("/onboarding");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, client_code, full_name, dni, phone, whatsapp, status, marketing_opt_in, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Clientes</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Clientes</h1>
          <p className="subtitle">La memoria comercial de Visión Total: datos, compras, seguimiento y relación posterior.</p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.created && <p className="notice" style={{ marginTop: 18 }}>Cliente registrado correctamente.</p>}

          <section className="card section">
            <h2>Nuevo cliente</h2>
            <form action={createClientRecord} className="form">
              <div className="form-grid">
                <div className="field"><label>Nombre completo *</label><input name="full_name" required /></div>
                <div className="field"><label>DNI</label><input name="dni" inputMode="numeric" /></div>
                <div className="field"><label>Teléfono</label><input name="phone" inputMode="tel" /></div>
                <div className="field"><label>WhatsApp</label><input name="whatsapp" inputMode="tel" /></div>
                <div className="field"><label>Correo</label><input name="email" type="email" /></div>
                <div className="field"><label>Distrito</label><input name="district" placeholder="Ej. Cercado" /></div>
                <div className="field"><label>Canal preferido</label><select name="preferred_channel" defaultValue=""><option value="">Seleccionar</option><option>WhatsApp</option><option>Llamada</option><option>Instagram</option><option>Presencial</option></select></div>
              </div>
              <label className="checkline"><input type="checkbox" name="marketing_opt_in" /> Autoriza recibir comunicaciones comerciales y recordatorios</label>
              <button className="btn btn-primary">Guardar cliente</button>
            </form>
          </section>

          <section className="section">
            <h2>Cartera</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Cliente</th><th>DNI</th><th>WhatsApp</th><th>Estado</th><th>Comunicaciones</th></tr></thead>
                <tbody>
                  {(clients ?? []).map((client) => (
                    <tr key={client.id}>
                      <td>{client.client_code}</td>
                      <td><Link href={`/clientes/${client.id}`} className="link-strong">{client.full_name}</Link></td>
                      <td>{client.dni || "·"}</td>
                      <td>{client.whatsapp || client.phone || "·"}</td>
                      <td>{client.status}</td>
                      <td>{client.marketing_opt_in ? "Autorizado" : "No autorizado"}</td>
                    </tr>
                  ))}
                  {!clients?.length && <tr><td colSpan={6} className="muted">Todavía no hay clientes registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
