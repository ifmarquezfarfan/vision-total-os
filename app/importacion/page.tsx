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
    {params.imported&&<p className="notice" style={{marginTop:18}}>Se importaron {params.imported} clientes{params.skipped ? `, ${params.skipped} omitidos por duplicado` : ""}.</p>}
    {params.inventory_imported&&<p className="notice" style={{marginTop:18}}>Inventario: {params.inventory_imported} artículos importados{params.inventory_skipped ? `, ${params.inventory_skipped} omitidos por duplicado` : ""}.</p>}

    <section className="grid grid-2 section">
      <div className="card"><h2>Cartera de clientes</h2><p className="muted">Excel .xlsx, .xls o CSV. Máximo 1000 filas y 5 MB. Se conservan tus códigos VT-XXXXXX cuando sean válidos y no estén duplicados.</p>
        <form action={importClientsFile} className="form" style={{marginTop:14}}><div className="field"><label>Archivo de clientes</label><input name="file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div><button className="btn btn-primary">Importar cartera</button></form>
      </div>

      <div className="card"><h2>Inventario</h2><p className="muted">Importa monturas y otros productos desde tu Excel. Las existencias entran como stock inicial en la ubicación principal.</p>
        {canManage ? <form action={importInventoryFile} className="form" style={{marginTop:14}}><div className="field"><label>Archivo de inventario</label><input name="inventory_file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div><button className="btn btn-primary">Importar inventario</button></form> : <div className="notice">Solo Dueña / Administrador puede importar inventario.</div>}
      </div>
    </section>

    <section className="grid grid-3 section">
      <div className="card" style={{gridColumn:"span 2"}}><h2>Columnas reconocidas: clientes</h2><div className="notice"><strong>Nombre:</strong> full_name / nombre_completo / nombre<br/><strong>Identidad:</strong> dni<br/><strong>Contacto:</strong> phone / teléfono / whatsapp / celular / email / correo<br/><strong>Ubicación:</strong> district / distrito<br/><strong>Preferencia:</strong> preferred_channel / canal_preferido / canal<br/><strong>Comunicaciones:</strong> marketing_opt_in / autorizado</div></div>
      <div className="card"><h2>Columnas reconocidas: inventario</h2><div className="notice"><strong>ID:</strong> ID del artículo / id_articulo / codigo<br/><strong>Producto:</strong> marca, modelo, tipo, color, material<br/><strong>Precio:</strong> precio de costo, precio de venta<br/><strong>Stock:</strong> unidades, stock, cantidad<br/><strong>Ubicación:</strong> ubicación actual<br/><strong>Estado:</strong> exhibida, estado físico, observaciones</div></div>
    </section>

    <section className="card section"><h2>Antes de la carga real</h2><p className="muted">Primero usa una copia de prueba. El sistema no reemplaza tu Excel original, y los registros que ya existan no se deberían sobrescribir automáticamente. Más adelante añadiremos una vista previa con conflictos y un historial de importaciones.</p></section>
  </div></main></div>;
}
