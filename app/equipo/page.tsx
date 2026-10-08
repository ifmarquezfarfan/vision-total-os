import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateBranchRole } from "./actions";

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{ data: members }, { data: branches }] = await Promise.all([
    supabase.from("organization_members").select("user_id,role,active,created_at").eq("organization_id",membership.organization_id).order("created_at"),
    supabase.from("branches").select("id,name,code,active").eq("organization_id",membership.organization_id).order("created_at")
  ]);

  const userIds = [...new Set((members ?? []).map(m=>m.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id",userIds)
    : { data: [] as {id:string;full_name:string|null}[] };

  const { data: branchMembers } = await supabase
    .from("branch_members")
    .select("branch_id,user_id,role,active,created_at")
    .in("branch_id",(branches ?? []).map(b=>b.id));

  const profileMap = new Map((profiles ?? []).map(p=>[p.id,p.full_name || p.id]));
  const branchMap = new Map((branches ?? []).map(b=>[b.id,b.name]));
  const currentIsAdmin = membership.role === "owner" || membership.role === "admin";
  const params = await searchParams;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Equipo</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Equipo y roles</h1>
          <p className="subtitle">Los permisos reales viven en la base de datos, no solamente en la interfaz.</p>

          {params.error && <p className="notice" style={{marginTop:18}}>{params.error}</p>}
          {params.updated && <p className="notice" style={{marginTop:18}}>Rol actualizado.</p>}

          <section className="card section">
            <h2>Miembros de la organización</h2>
            {!currentIsAdmin && <p className="notice">Solo propietarios y administradores pueden modificar roles.</p>}
            <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol organización</th><th>Estado</th><th>Desde</th></tr></thead><tbody>
              {(members ?? []).map(m=><tr key={m.user_id}>
                <td>{profileMap.get(m.user_id) || m.user_id}</td>
                <td>{m.role}</td>
                <td>{m.active ? "Activo":"Inactivo"}</td>
                <td>{new Date(m.created_at).toLocaleDateString("es-PE")}</td>
              </tr>)}
            </tbody></table></div>
          </section>

          <section className="section">
            <h2>Roles por sucursal</h2>
            <div className="table-wrap"><table><thead><tr><th>Sucursal</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
              {(branchMembers ?? []).map((bm)=><tr key={bm.branch_id+"-"+bm.user_id}>
                <td>{branchMap.get(bm.branch_id) || bm.branch_id}</td>
                <td>{profileMap.get(bm.user_id) || bm.user_id}</td>
                <td>
                  {currentIsAdmin ? (
                    <form action={updateBranchRole} className="inline">
                      <input type="hidden" name="branch_id" value={bm.branch_id}/>
                      <input type="hidden" name="user_id" value={bm.user_id}/>
                      <select name="role" defaultValue={bm.role}>
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="seller">seller</option>
                        <option value="inventory">inventory</option>
                        <option value="finance">finance</option>
                        <option value="viewer">viewer</option>
                        <option value="clinical">clinical</option>
                      </select>
                      <button className="btn btn-secondary">Guardar</button>
                    </form>
                  ) : bm.role}
                </td>
                <td>{bm.active ? "Activo":"Inactivo"}</td>
                <td>·</td>
              </tr>)}
              {!branchMembers?.length && <tr><td colSpan={5} className="muted">No hay asignaciones de sucursal.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="card section">
            <h2>Modelo de permisos</h2>
            <p className="muted">Owner y Admin controlan la organización. Manager gestiona una sucursal. Seller trabaja clientes, leads, seguimiento y ventas. Inventory gestiona stock y compras. Finance gestiona información económica. Clinical puede modificar datos ópticos. Viewer consulta sin modificar.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
