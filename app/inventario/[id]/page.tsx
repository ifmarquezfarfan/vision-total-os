import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { updateProduct } from "./actions";
import { QuickStart } from "@/components/quick-start";
import { LensProductFields } from "@/components/lens-product-fields";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const [{ data: product }, { data: stockRows }, { data: locations }, { data: movements }] = await Promise.all([
    supabase.from("products").select("id,product_code,category,brand,model,description,color,material,cost,sale_price,stock_qty,min_stock,location,displayed,physical_status,entry_at,notes,inventory_mode,lens_design,lens_material,lens_index,lens_phi_mm,lens_coatings,lens_prism_capable,lens_sphere_min,lens_sphere_max,lens_cylinder_min,lens_cylinder_max,created_at,updated_at,active").eq("id",id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle(),
    supabase.from("inventory_stock").select("location_id,quantity").eq("product_id",id).limit(100),
    supabase.from("inventory_locations").select("id,name").eq("branch_id",branch.branch_id).eq("active",true).order("created_at"),
    supabase.from("inventory_movements").select("id,quantity,movement_type,note,created_at").eq("product_id",id).eq("branch_id",branch.branch_id).order("created_at",{ascending:false}).limit(30),
  ]);

  if (!product) redirect("/inventario?error=Producto%20no%20encontrado");
  const locationMap = new Map((locations??[]).map((l)=>[l.id,l.name]));
  const canManage = membership.role==="owner" || membership.role==="admin";

  return <div className="shell"><Sidebar/><main className="main">
    <header className="topbar"><strong>Producto</strong><span className="muted">{user.email}</span></header>
    <div className="content">
      <div className="spread">
        <div><h1 className="page-title">{product.product_code}</h1><p className="subtitle">{[product.brand,product.model].filter(Boolean).join(" ")||product.description||"Sin descripción"}</p></div>
        <Link href="/inventario" className="btn btn-secondary">Volver a inventario</Link>
      </div>

      <QuickStart title="Ficha del producto" hint="Aquí se mantiene la memoria del artículo: datos, stock y movimientos." items={[
  {label:"Editar ficha",href:"#ficha-producto",description:"Datos comerciales y físicos",tone:"blue"},
  {label:"Ver stock",href:"#stock-ubicaciones",description:"Dónde está cada unidad",tone:"green"},
  {label:"Ver movimientos",href:"#movimientos",description:"Entradas y salidas",tone:"orange"},
  {label:"Volver al catálogo",href:"/inventario",description:"Continuar operación",tone:"purple"}
]}/>
<section className="card section"><div className="eyebrow">Ficha del producto</div><h2>{[product.brand,product.model].filter(Boolean).join(" ")||product.product_code}</h2><p className="muted">{product.color||"Color no registrado"} · {product.material||"Material no registrado"}</p><span className="field-hint">La carga de fotografías se habilitará en una siguiente etapa.</span>{product.category==="Lentes"&&<p style={{marginTop:12}}><Link href="/buscador-lunas" className="btn btn-primary">Abrir buscador de lunas →</Link></p>}</section>
      {product.category==="Lentes"&&<section className="card section lens-catalog-overview"><div className="spread"><div><h2 style={{marginBottom:4}}>Ficha técnica óptica</h2><p className="muted">Datos usados por el motor de búsqueda de lunas.</p></div><Link href="/buscador-lunas" className="link-strong">Buscar alternativas</Link></div>
        <div className="lens-summary-grid">
          <div><small>Diseño</small><strong>{product.lens_design||"Pendiente"}</strong></div>
          <div><small>Material</small><strong>{product.lens_material||"Pendiente"}</strong></div>
          <div><small>Índice</small><strong>{product.lens_index==null?"Pendiente":Number(product.lens_index).toFixed(2)}</strong></div>
          <div><small>PHI / diámetro</small><strong>{product.lens_phi_mm==null?"Pendiente":Number(product.lens_phi_mm)+" mm"}</strong></div>
          <div><small>Rango esfera</small><strong>{product.lens_sphere_min==null&&product.lens_sphere_max==null?"Pendiente":`${product.lens_sphere_min==null?"·":Number(product.lens_sphere_min).toFixed(2)} a ${product.lens_sphere_max==null?"·":Number(product.lens_sphere_max).toFixed(2)}`}</strong></div>
          <div><small>Rango cilindro</small><strong>{product.lens_cylinder_min==null&&product.lens_cylinder_max==null?"Pendiente":`${product.lens_cylinder_min==null?"·":Number(product.lens_cylinder_min).toFixed(2)} a ${product.lens_cylinder_max==null?"·":Number(product.lens_cylinder_max).toFixed(2)}`}</strong></div>
          <div><small>Prisma</small><strong>{product.lens_prism_capable?"Proveedor lo admite":"Sin confirmar"}</strong></div>
          <div><small>Tratamientos</small><strong>{(product.lens_coatings??[]).join(" · ")||"No registrados"}</strong></div>
        </div>
      </section>}
{q.error&&<p className="notice" style={{marginTop:18}}>{q.error}</p>}
      {q.updated&&<p className="notice" style={{marginTop:18}}>Producto actualizado.</p>}

      <section className="grid grid-4 section">
        <div className="card"><div className="metric-label">Stock</div><div className="metric-value">{product.stock_qty}</div></div>
        <div className="card"><div className="metric-label">Precio de venta</div><div className="metric-value" style={{fontSize:22}}>S/ {Number(product.sale_price).toFixed(2)}</div></div>
        <div className="card"><div className="metric-label">Modo</div><div className="metric-value" style={{fontSize:18}}>{product.inventory_mode==="stock"?"Stock físico":product.inventory_mode==="on_demand"?"Bajo demanda":"Servicio"}</div></div>
        <div className="card"><div className="metric-label">Estado</div><div className="metric-value" style={{fontSize:18}}>{product.active?"Activo":"Dado de baja"}</div></div>
      </section>

      {canManage && <section id="ficha-producto" className="card section"><h2>Ficha del producto</h2>
        <form action={updateProduct} className="form">
          <input type="hidden" name="id" value={product.id}/>
          <div className="form-grid">
            <div className="field"><label>Categoría</label><select name="category" defaultValue={product.category}><option>Montura</option><option>Lentes</option><option>Tratamiento</option><option>Accesorio</option><option>Servicio</option><option>Otro</option></select></div>
            <div className="field"><label>Marca</label><input name="brand" defaultValue={product.brand||""}/></div>
            <div className="field"><label>Modelo / referencia</label><input name="model" defaultValue={product.model||""}/></div>
            <div className="field"><label>Color</label><input name="color" defaultValue={product.color||""}/></div>
            <div className="field"><label>Material</label><input name="material" defaultValue={product.material||""}/></div>
            <div className="field"><label>Descripción</label><input name="description" defaultValue={product.description||""}/></div>
            <div className="field"><label>Costo</label><input name="cost" type="number" min="0" step="0.01" defaultValue={Number(product.cost).toFixed(2)}/></div>
            <div className="field"><label>Precio de venta</label><input name="sale_price" type="number" min="0" step="0.01" defaultValue={Number(product.sale_price).toFixed(2)}/></div>
            <div className="field"><label>Stock mínimo</label><input name="min_stock" type="number" min="0" step="1" defaultValue={product.min_stock}/></div>
            <div className="field"><label>Modo de inventario</label><select name="inventory_mode" defaultValue={product.inventory_mode}><option value="stock">Stock físico</option><option value="on_demand">Por pedido / bajo demanda</option><option value="service">Servicio, sin stock</option></select></div>
            <div className="field"><label>Estado físico</label><select name="physical_status" defaultValue={product.physical_status}><option>Bueno</option><option>Regular</option><option>Dañado</option><option>Baja</option><option>Otro</option></select></div>
            <div className="field"><label>Fecha de ingreso</label><input name="entry_at" type="date" defaultValue={product.entry_at?new Date(product.entry_at).toISOString().slice(0,10):""}/></div>
          </div>
          <label className="checkline"><input type="checkbox" name="displayed" defaultChecked={product.displayed}/> Está exhibida</label>
          <LensProductFields values={product}/>
          <div className="field"><label>Observaciones</label><input name="notes" defaultValue={product.notes||""}/></div>
          <button className="btn btn-primary">Guardar cambios</button>
        </form>
      </section>}

      <section id="stock-ubicaciones" className="grid grid-2 section">
        <div className="card"><h2>Stock por ubicación</h2><div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Ubicación</th><th>Cantidad</th></tr></thead><tbody>{(stockRows??[]).map(s=><tr key={s.location_id}><td>{locationMap.get(s.location_id)||s.location_id}</td><td>{s.quantity}</td></tr>)}{!stockRows?.length&&<tr><td colSpan={2} className="muted">Sin existencias registradas por ubicación.</td></tr>}</tbody></table></div></div>
        <div className="card"><h2>Datos del artículo</h2><div className="mini-row"><span>Ingreso</span><strong>{product.entry_at?new Date(product.entry_at).toLocaleDateString("es-PE"):"·"}</strong></div><div className="mini-row"><span>Exhibida</span><strong>{product.displayed?"Sí":"No"}</strong></div><div className="mini-row"><span>Estado físico</span><strong>{product.physical_status}</strong></div><div className="mini-row"><span>Ubicación histórica</span><strong>{product.location||"·"}</strong></div><div className="mini-row"><span>Actualizado</span><strong>{new Date(product.updated_at).toLocaleString("es-PE")}</strong></div></div>
      </section>

      <section id="movimientos" className="section"><h2>Movimientos recientes</h2><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Cantidad</th><th>Motivo</th></tr></thead><tbody>{(movements??[]).map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString("es-PE")}</td><td>{m.movement_type}</td><td>{m.quantity}</td><td>{m.note||"·"}</td></tr>)}{!movements?.length&&<tr><td colSpan={4} className="muted">Sin movimientos.</td></tr>}</tbody></table></div></section>
    </div>
  </main></div>;
}
