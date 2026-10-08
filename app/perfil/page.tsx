import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

const roleInfo: Record<string, { label: string; description: string; functions: string[] }> = {
  owner: {
    label: "Dueña",
    description: "Control total de Visión Total OS y de la organización.",
    functions: ["Supervisar toda la operación", "Gestionar equipo y permisos", "Controlar finanzas, inventario y compras", "Consultar auditoría y reportes", "Preparar el sistema para futuras sucursales"],
  },
  admin: {
    label: "Administrador",
    description: "Perfil de administración integral. Es el perfil de gestión que usarás tú.",
    functions: ["Gestionar toda la operación diaria", "Gestionar equipo y permisos", "Controlar ventas, inventario, compras y finanzas", "Revisar pedidos ópticos, reportes y auditoría", "Mantener el sistema preparado para crecer"],
  },
  member: {
    label: "Empleado / Vendedora",
    description: "Perfil operativo para atención comercial y seguimiento de clientes.",
    functions: ["Registrar y consultar clientes", "Gestionar leads y cotizaciones", "Registrar seguimientos", "Registrar ventas y cobranzas permitidas", "Dar seguimiento a pedidos ópticos"],
  },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role,created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const [{ data: profile }, { data: branchMembership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("branch_members")
      .select("branch_id,role,created_at")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  let branch: { name: string; code: string } | null = null;
  if (branchMembership) {
    const { data } = await supabase
      .from("branches")
      .select("name,code")
      .eq("id", branchMembership.branch_id)
      .maybeSingle();
    branch = data;
  }

  const role = membership.role === "owner"
    ? "owner"
    : membership.role === "admin"
    ? "admin"
    : "member";

  const info = roleInfo[role];

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Mi perfil</strong>
          <span className="muted">{user.email}</span>
        </header>

        <div className="content">
          <div className="spread">
            <div>
              <h1 className="page-title">Mi perfil</h1>
              <p className="subtitle">Aquí puedes ver qué cuenta está activa y qué función cumple dentro de Visión Total.</p>
            </div>
            <a href="/dashboard" className="btn btn-secondary">Volver al dashboard</a>
          </div>

          <section className="grid grid-3 section">
            <div className="card">
              <div className="metric-label">Cuenta</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{profile?.full_name || "Usuario"}</div>
              <p className="muted">{user.email}</p>
            </div>

            <div className="card">
              <div className="metric-label">Perfil</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{info.label}</div>
              <p className="muted">{info.description}</p>
            </div>

            <div className="card">
              <div className="metric-label">Sucursal actual</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{branch?.name || "Sin sucursal"}</div>
              <p className="muted">{branch?.code || "·"}</p>
            </div>
          </section>

          <section className="card section">
            <h2>Qué hago dentro del sistema</h2>
            <p className="muted" style={{ marginBottom: 14 }}>{info.description}</p>
            <div className="grid grid-3">
              {info.functions.map((fn) => (
                <div className="card" key={fn}>
                  <strong>{fn}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card section">
            <h2>Identidad de acceso</h2>
            <div className="grid grid-3">
              <div><strong>Correo</strong><p>{user.email}</p></div>
              <div><strong>Rol organización</strong><p>{info.label}</p></div>
              <div><strong>Rol técnico de sucursal</strong><p>{branchMembership?.role || "·"}</p></div>
              <div><strong>Miembro desde</strong><p>{new Date(membership.created_at).toLocaleDateString("es-PE")}</p></div>
              <div><strong>Sesión</strong><p>Autenticada</p></div>
              <div><strong>Alcance actual</strong><p>{branch ? "Sucursal activa" : "Organización"}</p></div>
            </div>
          </section>

          <section className="section">
            <details>
              <summary><strong>¿Qué significa el rol técnico?</strong></summary>
              <div className="notice" style={{ marginTop: 14 }}>
                El sistema conserva permisos técnicos más detallados por debajo para que, cuando Visión Total crezca, podamos separar funciones como inventario, finanzas o clínica sin reconstruir la base de datos. En el uso diario actual se muestran solo los perfiles humanos: Dueña, Administrador y Empleado / Vendedora.
              </div>
            </details>
          </section>
        </div>
      </main>
    </div>
  );
}
