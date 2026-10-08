import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { importClientsFile, importInventoryFile } from "./actions";

export default async function ImportPage({searchParams}:{searchParams:Promise<{error?:string;imported?:string;skipped?:string;inventory_imported?:string;inventory_skipped?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership) redirect("/onboarding");
  const params=await searchParams;
  const canManage=membership.role==="owner"||membership.role==="admin";

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Importación</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">Importar datos</h1><p className="subtitle">Convierte tus archivos históricos en datos operativos sin rehacer el trabajo a mano.</p></div></div>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.imported&&<p className="notice" style={{marginTop:18}}>Se importaron {params.imported} clientes{params.skipped?`, ${params.skipped} omitidos por duplicado`:""}.</p>}
    {params.inventory_imported&&<p className="notice" style={{marginTop:18}}>Inventario: {params.inventory_imported} artículos importados{params.inventory_skipped?`, ${params.inventory_skipped} omitidos por duplicado`:""}.</p>}
    <section className="grid grid-2 section">
      <div className="card"><h2>Cartera de clientes</h2><p className="muted">Sube .xlsx, .xls o .csv. Máximo 1000 filas y 5 MB. Tus códigos VT-XXXXXX válidos se conservan.</p>
        <form action={importClientsFile} className="form" style={{marginTop:14}}><div className="field"><label>Archivo de clientes</label><input name="file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div><button className="btn btn-primary">Importar cartera</button></form>
      </div>
      <div className="card"><h2>Inventario</h2><p className="muted">Importa monturas y productos. Las existencias se registran como stock inicial en las ubicaciones que existan en el archivo.</p>
        {canManage?<form action={importInventoryFile} className="form" style={{marginTop:14}}><div className="field"><label>Archivo de inventario</label><input name="inventory_file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div><button className="btn btn-primary">Importar inventario</button></form>:<div className="notice">Solo Dueña / Administrador puede importar inventario.</div>}
      </div>
    </section>
    <section className="grid grid-3 section">
      <div className="card" style={{gridColumn:"span 2"}}><h2>Columnas reconocidas: clientes</h2><div className="notice"><strong>Nombre:</strong> nombre / nombre completo / full_name<br/><strong>Identidad:</strong> DNI<br/><strong>Contacto:</strong> teléfono / WhatsApp / celular / correo<br/><strong>Histórico:</strong> última compra, tipo de compra, monturas, lunas, montos, visitas<br/><strong>Gestión:</strong> estado, tipo de cliente, próxima acción, observaciones</div></div>
      <div className="card"><h2>Columnas reconocidas: inventario</h2><div className="notice"><strong>ID:</strong> ID del artículo / código<br/><strong>Producto:</strong> marca, modelo, tipo, color, material<br/><strong>Precio:</strong> costo / venta<br/><strong>Stock:</strong> unidades / cantidad<br/><strong>Ubicación:</strong> ubicación actual<br/><strong>Estado:</strong> exhibida / estado físico / observaciones<br/><strong>Modo:</strong> stock / bajo demanda / servicio</div></div>
    </section>
    <section className="card section"><h2>Cómo funciona la migración</h2><p className="muted">El Excel no reemplaza la base original. El sistema normaliza los datos, evita duplicar DNI o códigos, conserva un resumen histórico de la cartera y crea los productos e inventario iniciales que correspondan.</p></section>
  </div></main></div>;
}
