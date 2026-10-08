import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createClientRecord, deleteClientRecord } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { QuickStart } from "@/components/quick-start";

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; q?: string; deleted?: string; archived?: string }>;
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

  const params = await searchParams;
  const q = String(params.q ?? "").trim();

  let clientQuery = supabase
    .from("clients")
    .select("id,client_code,full_name,dni,phone,whatsapp,status,marketing_opt_in,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (q) {
    if (/^\d{6,15}$/.test(q)) {
      clientQuery = clientQuery.eq("dni", q);
    } else {
      clientQuery = clientQuery.ilike("full_name", "%" + q.replace(/[%_]/g, "") + "%");
    }
  }

  const { data: clients } = await clientQuery;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Clientes</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <div className="spread">
            <div>
              <h1 className="page-title">Clientes</h1>
              <p className="subtitle">La memoria comercial de Visión Total: datos, compras, seguimiento y relación posterior.</p>
              <QuickStart title="Inicio rápido de clientes" hint="Primero busca. Crea solo cuando no exista el cliente. Luego decide si la conversación sigue como lead, cotización o venta." items={[
                {label:"Buscar",href:"#buscar-cliente",description:"DNI o nombre",tone:"blue"},
                {label:"Nuevo cliente",href:"#nuevo-cliente",description:"Crear ficha",tone:"green"},
                {label:"Ver historial",href:"#cartera",description:"Compras y seguimiento",tone:"purple"},
                {label:"Registrar venta",href:"/ventas",description:"Cuando ya compra",tone:"orange"}
              ]}/>
            </div>
          </div>

          {params.error && <p className="notice" style={{marginTop:18}}>{params.error}</p>}
          {params.created && <p className="notice" style={{marginTop:18}}>Cliente registrado correctamente.</p>}
          {params.deleted && <p className="notice" style={{marginTop:18}}>Cliente eliminado.</p>}
          {params.archived && <p className="notice" style={{marginTop:18}}>El cliente tenía historial y fue desactivado para conservar la trazabilidad.</p>}

          <section id="buscar-cliente" className="card section">
            <h2>Buscar cliente</h2>
            <form method="get" className="inline">
              <input name="q" defaultValue={q} placeholder="Nombre o DNI" style={{flex:1,minWidth:220}} />
              <button className="btn btn-secondary">Buscar</button>
              {q && <Link href="/clientes" className="btn btn-secondary">Limpiar</Link>}
            </form>
          </section>

          <section id="nuevo-cliente" className="card section">
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

          <section id="cartera" className="section">
            <h2>{q ? "Resultados" : "Cartera"}</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Código</th><th>Cliente</th><th>DNI</th><th>WhatsApp</th><th>Estado</th><th>Comunicaciones</th><th></th></tr></thead>
              <tbody>
                {(clients ?? []).map(client => (
                  <tr key={client.id}>
                    <td>{client.client_code}</td>
                    <td><Link href={"/clientes/"+client.id} className="link-strong">{client.full_name}</Link></td>
                    <td>{client.dni || "·"}</td>
                    <td>
                      {client.whatsapp || client.phone ? (
                        <a
                          href={"https://wa.me/51" + String(client.whatsapp || client.phone).replace(/\D/g,"").replace(/^51/,"")}
                          target="_blank"
                          rel="noreferrer"
                          className="link-strong"
                        >Abrir</a>
                      ) : "·"}
                    </td>
                    <td><span className={`status-badge ${client.status==="active"?"status-success":"status-neutral"}`}>{client.status==="active"?"Activo":client.status}</span></td>
                    <td>{client.marketing_opt_in ? "Autorizado" : "No autorizado"}</td>
                    <td><form action={deleteClientRecord}><input type="hidden" name="id" value={client.id}/><ConfirmSubmit message="Eliminar cliente? Si tiene historial, se desactivará para conservar la trazabilidad.">Eliminar</ConfirmSubmit></form></td>
                  </tr>
                ))}
                {!clients?.length && <tr><td colSpan={7} className="muted">{q ? "No se encontró ningún cliente." : "Todavía no hay clientes registrados."}</td></tr>}
              </tbody>
            </table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
