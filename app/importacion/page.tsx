import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { importClientsCsv } from "./actions";

export default async function ImportPage({searchParams}:{searchParams:Promise<{error?:string;imported?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership) redirect("/onboarding");
  const params=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Importación</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Importar datos</h1><p className="subtitle">Carga histórica desde Excel o Google Sheets exportado como CSV.</p>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.imported&&<p className="notice" style={{marginTop:18}}>Se importaron {params.imported} clientes.</p>}
    <section className="card section"><h2>Clientes desde CSV</h2><p className="muted">Máximo 1000 filas por carga. El DNI ayuda a evitar duplicados dentro de la organización.</p>
      <form action={importClientsCsv} className="form"><div className="field"><label>Archivo CSV</label><input name="file" type="file" accept=".csv,text/csv" required/></div><button className="btn btn-primary">Importar clientes</button></form>
    </section>
    <section className="card section"><h2>Formato recomendado</h2><div className="notice">full_name,dni,phone,whatsapp,email,district,preferred_channel,marketing_opt_in</div><p className="muted" style={{marginTop:12}}>Los archivos originales se conservan fuera del sistema; aquí se incorpora la información que necesitas operar.</p></section>
  </div></main></div>;
}
