import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: audit } = await supabase
    .from("audit_log")
    .select("id,actor_user_id,action,table_name,record_id,created_at,branch_id")
    .eq("organization_id",membership.organization_id)
    .order("created_at",{ascending:false})
    .limit(150);

  const actorIds = [...new Set((audit ?? []).map(a=>a.actor_user_id).filter(Boolean))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id",actorIds)
    : { data: [] as {id:string;full_name:string|null}[] };
  const actorMap = new Map((profiles ?? []).map(p=>[p.id,p.full_name || p.id]));

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar"><strong>Auditoría</strong><span className="muted">{user.email}</span></header>
        <div className="content">
          <h1 className="page-title">Bitácora de auditoría</h1>
          <p className="subtitle">Registro de cambios relevantes para saber quién hizo qué y cuándo.</p>

          <section className="section">
            <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>Sucursal</th></tr></thead><tbody>
              {(audit ?? []).map(item=><tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString("es-PE")}</td>
                <td>{item.actor_user_id ? actorMap.get(item.actor_user_id) || "Usuario" : "Sistema"}</td>
                <td>{item.action}</td>
                <td>{item.table_name}</td>
                <td>{item.record_id || "·"}</td>
                <td>{item.branch_id || "Organización"}</td>
              </tr>)}
              {!audit?.length && <tr><td colSpan={6} className="muted">Todavía no hay eventos registrados.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
