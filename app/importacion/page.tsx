import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { importClientsFile } from "./actions";

export default async function ImportPage({searchParams}:{searchParams:Promise<{error?:string;imported?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership) redirect("/onboarding");
  const params=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Importación</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">Importar datos</h1><p className="subtitle">Trae tu cartera desde Excel sin rehacerla a mano.</p></div></div>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.imported&&<p className="notice" style={{marginTop:18}}>Se importaron {params.imported} clientes.</p>}

    <section className="card section"><h2>Cartera de clientes</h2>
      <p className="muted">Puedes subir directamente un archivo .xlsx de Excel o un .csv. Máximo 1000 filas por carga y 5 MB.</p>
      <form action={importClientsFile} className="form" style={{marginTop:14}}>
        <div className="field"><label>Archivo</label><input name="file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div>
        <button className="btn btn-primary">Importar clientes</button>
      </form>
    </section>

    <section className="grid grid-3 section">
      <div className="card" style={{gridColumn:"span 2"}}><h2>Columnas que reconocerá el sistema</h2><div className="notice">
        <strong>Nombre:</strong> full_name / nombre_completo / nombre<br/>
        <strong>Identidad:</strong> dni<br/>
        <strong>Contacto:</strong> phone / teléfono / whatsapp / celular / email / correo<br/>
        <strong>Ubicación:</strong> district / distrito<br/>
        <strong>Preferencia:</strong> preferred_channel / canal_preferido / canal<br/>
        <strong>Comunicaciones:</strong> marketing_opt_in / autorizado
      </div></div>
      <div className="card"><h2>Qué pasará al importar</h2><p>Los datos se asignan a la sucursal activa. Se evita duplicar DNI ya existente dentro de la organización.</p><p className="muted">El código CLI se genera automáticamente. No necesitas fabricar códigos en Excel.</p></div>
    </section>

    <section className="card section"><h2>Antes de importar la cartera real</h2><p className="muted">Primero haremos una carga de prueba con copias ficticias. Después revisaremos duplicados, datos faltantes y el formato final de tu Excel. El archivo original no se modifica.</p></section>
  </div></main></div>;
}
