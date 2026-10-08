import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateBranchRole, createBranch, createInvitation } from "./actions";

function orgRoleLabel(role: string) {
  if (role === "owner") return "Dueña";
  if (role === "admin") return "Administrador";
  return "Empleado / Vendedora";
}

function branchRoleLabel(role: string) {
  if (role === "owner") return "Dueña";
  if (role === "admin") return "Administrador";
  if (role === "seller") return "Empleado / Vendedora";
  return "Perfil avanzado";
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    updated?: string;
    branch_created?: string;
    invite_link?: string;
    profile?: string;
  }>;
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

  if (!membership) redirect("/onboarding");

  const [{ data: members }, { data: branches }, { data: invitations }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,role,active,created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at"),
    supabase
      .from("branches")
      .select("id,name,code,active,created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at"),
    supabase
      .from("organization_invitations")
      .select("id,email,branch_id,organization_role,branch_role,status,expires_at,created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  const branchIds = (branches ?? []).map((b) => b.id);
  const { data: branchMembers } = branchIds.length
    ? await supabase
        .from("branch_members")
        .select("branch_id,user_id,role,active,created_at")
        .in("branch_id", branchIds)
    : {
        data: [] as {
          branch_id: string;
          user_id: string;
          role: string;
          active: boolean;
          created_at: string;
        }[],
      };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.id]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const primaryBranch = (branches ?? []).find((b) => b.active) ?? branches?.[0];
  const currentIsAdmin = membership.role === "owner" || membership.role === "admin";
  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Equipo</strong>
          <span className="muted">{user.email}</span>
        </header>

        <div className="content">
          <h1 className="page-title">Equipo</h1>
          <p className="subtitle">
            La operación actual tiene una sola tienda. La estructura de sucursales queda preparada para el crecimiento, sin robar protagonismo al día a día.
          </p>

          {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
          {params.updated && <p className="notice" style={{ marginTop: 18 }}>Perfil actualizado.</p>}
          {params.branch_created && <p className="notice" style={{ marginTop: 18 }}>Sucursal creada y preparada con inventario principal.</p>}

          {params.invite_link && (
            <section className="card section">
              <h2>Invitación lista</h2>
              <p className="muted">
                Perfil: {params.profile || "Empleado / Vendedora"}. Comparte este enlace con la persona invitada. Expira en 7 días.
              </p>
              <div className="notice" style={{ wordBreak: "break-all" }}>{params.invite_link}</div>
            </section>
          )}

          {currentIsAdmin && (
            <section className="card section">
              <h2>Invitar a una persona</h2>
              <p className="muted">
                Para esta etapa solo manejaremos dos perfiles: Administrador y Empleado / Vendedora.
                La invitación se asigna automáticamente a la única sucursal activa.
              </p>

              <form action={createInvitation} className="form">
                <div className="form-grid">
                  <div className="field">
                    <label>Correo</label>
                    <input name="email" type="email" required placeholder="persona@correo.com" />
                  </div>

                  <div className="field">
                    <label>Perfil</label>
                    <select name="profile" defaultValue="seller">
                      <option value="seller">Empleado / Vendedora</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>

                <button className="btn btn-primary">Generar invitación</button>
              </form>
            </section>
          )}

          <section className="card section">
            <h2>Miembros</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Estado</th>
                    <th>Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((m) => (
                    <tr key={m.user_id}>
                      <td>{profileMap.get(m.user_id) || m.user_id}</td>
                      <td>{orgRoleLabel(m.role)}</td>
                      <td>{m.active ? "Activo" : "Inactivo"}</td>
                      <td>{new Date(m.created_at).toLocaleDateString("es-PE")}</td>
                    </tr>
                  ))}
                  {!members?.length && (
                    <tr>
                      <td colSpan={4} className="muted">No hay miembros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card section">
            <h2>Permisos actuales</h2>
            <div className="notice">
              <strong>Dueña / Administrador:</strong> acceso completo a la operación, finanzas, inventario, equipo, auditoría y configuración.<br />
              <strong>Empleado / Vendedora:</strong> clientes, leads, cotizaciones, seguimientos, ventas y pedidos ópticos.
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Los perfiles avanzados siguen existiendo internamente para una futura etapa. No forman parte de la gestión diaria actual.
            </p>
          </section>

          <section className="section">
            <h2>Perfiles por sucursal</h2>
            <p className="muted">
              {primaryBranch
                ? `Sucursal activa actual: ${primaryBranch.name}. `
                : "Todavía no hay una sucursal activa. "}
              La lógica multi-sucursal permanece preparada para cuando llegue ese momento.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(branchMembers ?? []).map((bm) => {
                    const canEdit = currentIsAdmin && bm.role !== "owner";
                    return (
                      <tr key={bm.branch_id + "-" + bm.user_id}>
                        <td>{branchMap.get(bm.branch_id) || bm.branch_id}</td>
                        <td>{profileMap.get(bm.user_id) || bm.user_id}</td>
                        <td>
                          {bm.role === "owner" && "Dueña"}
                          {bm.role !== "owner" && canEdit && (
                            <form action={updateBranchRole} className="inline">
                              <input type="hidden" name="branch_id" value={bm.branch_id} />
                              <input type="hidden" name="user_id" value={bm.user_id} />
                              <select name="role" defaultValue={bm.role === "admin" ? "admin" : "seller"}>
                                <option value="seller">Empleado / Vendedora</option>
                                <option value="admin">Administrador</option>
                              </select>
                              <button className="btn btn-secondary">Guardar</button>
                            </form>
                          )}
                          {bm.role !== "owner" && !canEdit && branchRoleLabel(bm.role)}
                        </td>
                        <td>{bm.active ? "Activo" : "Inactivo"}</td>
                      </tr>
                    );
                  })}
                  {!branchMembers?.length && (
                    <tr>
                      <td colSpan={4} className="muted">No hay perfiles de sucursal registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <details>
              <summary><strong>Estructura futura de sucursales</strong></summary>
              <div className="card section" style={{ marginTop: 14 }}>
                <h2>Cuando llegue la segunda tienda</h2>
                <p className="muted">
                  Aquí quedará la administración de nuevas sucursales, códigos, responsables e inventarios separados.
                  Por ahora es infraestructura preparada, no una carga operativa.
                </p>
                {currentIsAdmin && (
                  <form action={createBranch} className="form" style={{ marginTop: 16 }}>
                    <div className="form-grid">
                      <div className="field">
                        <label>Nombre</label>
                        <input name="name" required placeholder="Ej. Cercado" />
                      </div>
                      <div className="field">
                        <label>Código</label>
                        <input name="code" required placeholder="VT-02" />
                      </div>
                    </div>
                    <button className="btn btn-secondary">Crear sucursal</button>
                  </form>
                )}
              </div>
            </details>
          </section>

          <section className="section">
            <details>
              <summary><strong>Invitaciones recientes</strong></summary>
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Sucursal</th>
                      <th>Perfil</th>
                      <th>Estado</th>
                      <th>Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invitations ?? []).map((i) => (
                      <tr key={i.id}>
                        <td>{i.email}</td>
                        <td>{branchMap.get(i.branch_id) || "·"}</td>
                        <td>{i.organization_role === "admin" ? "Administrador" : "Empleado / Vendedora"}</td>
                        <td>{i.status}</td>
                        <td>{new Date(i.expires_at).toLocaleString("es-PE")}</td>
                      </tr>
                    ))}
                    {!invitations?.length && (
                      <tr>
                        <td colSpan={5} className="muted">No hay invitaciones.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>
      </main>
    </div>
  );
}
