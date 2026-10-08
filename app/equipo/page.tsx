import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateBranchRole, createBranch, createInvitation } from "./actions";

export default async function TeamPage({searchParams}:{searchParams:Promise<{error?:string;updated?:string;branch_created?:string;invite_link?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership) redirect("/onboarding");

  const [{data:members},{data:branches},{data:invitations}]=await Promise.all([
    supabase.from("organization_members").select("user_id,role,active,created_at").eq("organization_id",membership.organization_id).order("created_at"),
    supabase.from("branches").select("id,name,code,active,created_at").eq("organization_id",membership.organization_id).order("created_at"),
    supabase.from("organization_invitations").select("id,email,branch_id,organization_role,branch_role,status,expires_at,created_at").eq("organization_id",membership.organization_id).order("created_at",{ascending:false}).limit(50)
  ]);

  const userIds=[...new Set((members??[]).map(m=>m.user_id))];
  const {data:profiles}=userIds.length?await supabase.from("profiles").select("id,full_name").in("id",userIds):{data:[] as {id:string;full_name:string|null}[]};
  const branchIds=(branches??[]).map(b=>b.id);
  const {data:branchMembers}=branchIds.length?await supabase.from("branch_members").select("branch_id,user_id,role,active,created_at").in("branch_id",branchIds):{data:[] as {branch_id:string;user_id:string;role:string;active:boolean;created_at:string}[]};

  const profileMap=new Map((profiles??[]).map(p=>[p.id,p.full_name||p.id]));
  const branchMap=new Map((branches??[]).map(b=>[b.id,b.name]));
  const currentIsAdmin=membership.role==="owner"||membership.role==="admin";
  const params=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Equipo</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Equipo y estructura</h1><p className="subtitle">Usuarios, roles y sucursales. Las reglas de autorización viven en la base de datos.</p>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.updated&&<p className="notice" style={{marginTop:18}}>Rol actualizado.</p>}
    {params.branch_created&&<p className="notice" style={{marginTop:18}}>Sucursal creada y preparada con inventario principal.</p>}
    {params.invite_link&&<section className="card section"><h2>Invitación lista</h2><p className="muted">Comparte este enlace con la persona invitada. Expira en 7 días y solo puede aceptarse con el correo indicado.</p><div className="notice" style={{wordBreak:"break-all"}}>{params.invite_link}</div></section>}

    {currentIsAdmin&&<section className="card section"><h2>Invitar miembro</h2><form action={createInvitation} className="form"><div className="form-grid">
      <div className="field"><label>Correo</label><input name="email" type="email" required placeholder="persona@correo.com"/></div>
      <div className="field"><label>Sucursal</label><select name="branch_id" required defaultValue=""><option value="">Seleccionar</option>{(branches??[]).filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name} · {b.code}</option>)}</select></div>
      <div className="field"><label>Rol organización</label><select name="organization_role" defaultValue="member"><option value="member">member</option><option value="admin">admin</option></select></div>
      <div className="field"><label>Rol sucursal</label><select name="branch_role" defaultValue="seller"><option value="manager">manager</option><option value="seller">seller</option><option value="inventory">inventory</option><option value="finance">finance</option><option value="viewer">viewer</option><option value="clinical">clinical</option></select></div>
    </div><button className="btn btn-primary">Generar invitación</button></form></section>}

    <section className="card section"><h2>Sucursales</h2><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Código</th><th>Estado</th><th>Creada</th></tr></thead><tbody>
      {(branches??[]).map(b=><tr key={b.id}><td>{b.name}</td><td>{b.code}</td><td>{b.active?"Activa":"Inactiva"}</td><td>{new Date(b.created_at).toLocaleDateString("es-PE")}</td></tr>)}
      {!branches?.length&&<tr><td colSpan={4} className="muted">No hay sucursales.</td></tr>}
    </tbody></table></div></section>

    {currentIsAdmin&&<section className="card section"><h2>Nueva sucursal</h2><form action={createBranch} className="form"><div className="form-grid"><div className="field"><label>Nombre</label><input name="name" required placeholder="Ej. Cercado"/></div><div className="field"><label>Código</label><input name="code" required placeholder="VT-02"/></div></div><button className="btn btn-secondary">Crear sucursal</button></form></section>}

    <section className="card section"><h2>Miembros</h2><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol organización</th><th>Estado</th><th>Desde</th></tr></thead><tbody>
      {(members??[]).map(m=><tr key={m.user_id}><td>{profileMap.get(m.user_id)||m.user_id}</td><td>{m.role}</td><td>{m.active?"Activo":"Inactivo"}</td><td>{new Date(m.created_at).toLocaleDateString("es-PE")}</td></tr>)}
    </tbody></table></div></section>

    <section className="section"><h2>Roles por sucursal</h2><div className="table-wrap"><table><thead><tr><th>Sucursal</th><th>Usuario</th><th>Rol</th><th>Estado</th></tr></thead><tbody>
      {(branchMembers??[]).map(bm=><tr key={bm.branch_id+"-"+bm.user_id}><td>{branchMap.get(bm.branch_id)||bm.branch_id}</td><td>{profileMap.get(bm.user_id)||bm.user_id}</td><td>{currentIsAdmin?<form action={updateBranchRole} className="inline"><input type="hidden" name="branch_id" value={bm.branch_id}/><input type="hidden" name="user_id" value={bm.user_id}/><select name="role" defaultValue={bm.role}><option value="owner">owner</option><option value="admin">admin</option><option value="manager">manager</option><option value="seller">seller</option><option value="inventory">inventory</option><option value="finance">finance</option><option value="viewer">viewer</option><option value="clinical">clinical</option></select><button className="btn btn-secondary">Guardar</button></form>:bm.role}</td><td>{bm.active?"Activo":"Inactivo"}</td></tr>)}
    </tbody></table></div></section>

    <section className="section"><h2>Invitaciones</h2><div className="table-wrap"><table><thead><tr><th>Correo</th><th>Sucursal</th><th>Rol org.</th><th>Rol sucursal</th><th>Estado</th><th>Vence</th></tr></thead><tbody>
      {(invitations??[]).map(i=><tr key={i.id}><td>{i.email}</td><td>{branchMap.get(i.branch_id)||"·"}</td><td>{i.organization_role}</td><td>{i.branch_role}</td><td>{i.status}</td><td>{new Date(i.expires_at).toLocaleString("es-PE")}</td></tr>)}
      {!invitations?.length&&<tr><td colSpan={6} className="muted">No hay invitaciones.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
