import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createProduct, adjustStock, deactivateProduct } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { QuickStart } from "@/components/quick-start";

export default async function InventoryPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;adjusted?:string;deactivated?:string;q?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const params=await searchParams;
  const q=String(params.q??"").trim();

  let productQuery=supabase.from("products").select("id,product_code,category,brand,model,description,color,material,cost,sale_price,stock_qty,min_stock,location,displayed,physical_status,entry_at,notes,inventory_mode,active").eq("active",true).order("created_at",{ascending:false}).limit(500);
  if(q){
    const safe=q.replace(/[%,]/g,"");
    productQuery=productQuery.or(`product_code.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  const [{data:products},{data:locations},{data:movements},{data:stockRows}]=await Promise.all([
    productQuery,
    supabase.from("inventory_locations").select("id,name,code,location_type").eq("branch_id",branch.branch_id).eq("active",true).order("created_at"),
    supabase.from("inventory_movements").select("id,product_id,quantity,movement_type,note,created_at").eq("branch_id",branch.branch_id).order("created_at",{ascending:false}).limit(20),
    supabase.from("inventory_stock").select("product_id,location_id,quantity").limit(5000)
  ]);

  const locationMap=new Map((locations??[]).map(l=>[l.id,l.name]));
  const productStock=new Map<string,{quantity:number;locations:string[]}>();
  for(const row of stockRows??[]){
    const current=productStock.get(row.product_id)??{quantity:0,locations:[]};
    current.quantity+=Number(row.quantity||0);
    const locationName=locationMap.get(row.location_id);
    if(locationName&&!current.locations.includes(locationName)) current.locations.push(locationName);
    productStock.set(row.product_id,current);
  }

  const lowStock=(products??[]).filter(p=>p.inventory_mode==="stock"&&Number(p.stock_qty)<=Number(p.min_stock??0));
  const canManage=membership.role==="owner"||membership.role==="admin";

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Inventario</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">Inventario</h1><p className="subtitle">Catálogo, stock, ubicación y estado físico en una sola vista.</p></div><div className="inline"><Link href="/guia" className="btn btn-secondary">Aprender</Link><Link href="/importacion" className="btn btn-secondary">Importar Excel</Link></div></div>
    <QuickStart title="Inicio rápido de inventario" hint="Crear → ubicar → revisar stock → reponer." items={[
      {label:"Nuevo producto",href:"#nuevo-producto",description:"Registra la ficha del artículo",tone:"blue"},
      {label:"Ajustar stock",href:"#ajustar-stock",description:"Entrada o salida controlada",tone:"green"},
      {label:"Catálogo visual",href:"#catalogo",description:"Busca por código o modelo",tone:"purple"},
      {label:"Comprar reposición",href:"/compras",description:"Abastece lo que está bajo",tone:"orange"}
    ]}/>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}
    {params.created&&<p className="notice" style={{marginTop:18}}>Producto creado correctamente.</p>}
    {params.adjusted&&<p className="notice" style={{marginTop:18}}>Stock ajustado correctamente.</p>}
    {params.deactivated&&<p className="notice" style={{marginTop:18}}>Producto dado de baja.</p>}

    <section className="grid grid-3 section">
      <div className="card"><div className="metric-label">Artículos</div><div className="metric-value">{products?.length??0}</div></div>
      <div className="card"><div className="metric-label">Stock bajo</div><div className="metric-value">{lowStock.length}</div></div>
      <div className="card"><div className="metric-label">Ubicaciones</div><div className="metric-value">{locations?.length??0}</div></div>
    </section>

    {canManage&&<section id="nuevo-producto" className="grid grid-3 section"><div className="card" style={{gridColumn:"span 2"}}><h2>Nuevo producto</h2><p className="muted" style={{marginBottom:12}}>La carga de fotografías se habilitará en una siguiente etapa. Por ahora registra los datos del producto y su ubicación.</p><form action={createProduct} className="form">
      <div className="form-grid">
        <div className="field"><label>Categoría</label><select name="category" defaultValue="Montura"><option>Montura</option><option>Lentes</option><option>Tratamiento</option><option>Accesorio</option><option>Servicio</option><option>Otro</option></select></div>
        <div className="field"><label>Marca</label><input name="brand" placeholder="Ej. Ray-Ban"/></div>
        <div className="field"><label>Modelo / referencia</label><input name="model" placeholder="Ej. RX123"/></div>
        <div className="field"><label>Color</label><input name="color" placeholder="Ej. Negro"/></div>
        <div className="field"><label>Material</label><input name="material" placeholder="Ej. Acetato"/></div>
        <div className="field"><label>Descripción</label><input name="description" placeholder="Forma, detalles, etc."/></div>
        <div className="field"><label>Costo</label><input name="cost" type="number" min="0" step="0.01"/></div>
        <div className="field"><label>Precio de venta</label><input name="sale_price" type="number" min="0" step="0.01"/></div>
        <div className="field"><label>Modo de inventario</label><select name="inventory_mode" defaultValue="stock"><option value="stock">Stock físico</option><option value="on_demand">Por pedido / bajo demanda</option><option value="service">Servicio, sin stock</option></select></div>
        <div className="field"><label>Stock inicial</label><input name="initial_stock" type="number" min="0" step="1" defaultValue="0"/></div>
        <div className="field"><label>Estado físico</label><select name="physical_status" defaultValue="Bueno"><option>Bueno</option><option>Regular</option><option>Dañado</option><option>Baja</option><option>Otro</option></select></div>
        <div className="field"><label>Fecha de ingreso</label><input name="entry_at" type="date"/></div>
      </div>
      <label className="checkline"><input type="checkbox" name="displayed"/> Está exhibida</label>
      <div className="field"><label>Observaciones</label><input name="notes" placeholder="Detalles internos"/></div>
      <button className="btn btn-primary">Crear producto</button>
    </form></div>

    <div id="ajustar-stock" className="card"><h2>Ajustar stock</h2><p className="muted">Usa positivo para entrada y negativo para salida.</p><form action={adjustStock} className="form" style={{marginTop:12}}>
      <div className="field"><label>Producto</label><select name="product_id" required defaultValue=""><option value="">Seleccionar</option>{(products??[]).map(p=><option key={p.id} value={p.id}>{p.product_code} · {p.brand||""} {p.model||p.description||""}</option>)}</select></div>
      <div className="field"><label>Ubicación</label><select name="location_id" required defaultValue=""><option value="">Seleccionar</option>{(locations??[]).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div className="field"><label>Cantidad</label><input name="delta" type="number" step="1" required/></div>
      <div className="field"><label>Motivo</label><input name="note" placeholder="Conteo, daño, ingreso, etc."/></div>
      <button className="btn btn-secondary">Aplicar movimiento</button>
    </form></div></section>}

    <section id="catalogo" className="card section"><div className="spread"><div><h2 style={{marginBottom:4}}>Catálogo</h2><p className="muted">{q?`${products?.length??0} resultado(s)`:"Busca por código, marca o modelo."}</p></div><form method="get" className="inline"><input name="q" defaultValue={q} placeholder="Buscar producto"/><button className="btn btn-secondary">Buscar</button>{q&&<Link href="/inventario" className="btn btn-secondary">Limpiar</Link>}</form></div>
      <div className="section-heading" style={{marginTop:14}}><div/><div className="chip-legend"><span className="status-badge status-success">OK</span><span className="status-badge status-warning">Stock bajo</span><span className="status-badge status-danger">Dañado / baja</span></div></div>
      <div className="table-wrap"><table style={{minWidth:1260}}><thead><tr><th>Código</th><th>Producto</th><th>Detalle</th><th>Venta</th><th>Modo</th><th>Stock</th><th>Ubicación</th><th>Exhibida</th><th>Estado físico</th><th>Ingreso</th><th></th></tr></thead><tbody>
        {(products??[]).map(p=>{const stock=productStock.get(p.id);const qty=stock?.quantity??Number(p.stock_qty||0);return <tr key={p.id}>
          <td><Link href={"/inventario/"+p.id} className="link-strong">{p.product_code}</Link></td>
          <td>{[p.brand,p.model].filter(Boolean).join(" ")||p.description||"Sin descripción"}</td>
          <td>{[p.color,p.material].filter(Boolean).join(" · ")||"·"}</td>
          <td>S/ {Number(p.sale_price).toFixed(2)}</td>
          <td>{p.inventory_mode==="stock"?"Stock físico":p.inventory_mode==="on_demand"?"Bajo demanda":"Servicio"}</td>
          <td>{p.inventory_mode==="stock"?(Number(qty)<=Number(p.min_stock)?<span className="status-badge status-warning">{qty} · bajo</span>:<span className="status-badge status-success">{qty} · OK</span>):<span className="status-badge status-info">{p.inventory_mode==="on_demand"?"Bajo demanda":"Servicio"}</span>}</td>
          <td>{stock?.locations.join(", ")||p.location||"·"}</td>
          <td>{p.displayed?"Sí":"No"}</td><td><span className={`status-badge ${p.physical_status==="Bueno"?"status-success":p.physical_status==="Regular"?"status-warning":"status-danger"}`}>{p.physical_status}</span></td><td>{p.entry_at?new Date(p.entry_at).toLocaleDateString("es-PE"):"·"}</td>
          <td>{canManage&&qty===0?<form action={deactivateProduct}><input type="hidden" name="product_id" value={p.id}/><ConfirmSubmit message="Dar de baja este producto? Se conservará el historial.">Dar de baja</ConfirmSubmit></form>:"·"}</td>
        </tr>})}
        {!products?.length&&<tr><td colSpan={10} className="muted">{q?"No se encontró ningún producto.":"Todavía no hay productos."}</td></tr>}
      </tbody></table></div>
    </section>

    <section className="section"><h2>Últimos movimientos</h2><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Movimiento</th><th>Cantidad</th><th>Nota</th><th>Fecha</th></tr></thead><tbody>
      {(movements??[]).map(m=>{const p=(products??[]).find(x=>x.id===m.product_id);return <tr key={m.id}><td>{p?.product_code||m.product_id}</td><td>{m.movement_type}</td><td>{m.quantity}</td><td>{m.note||"·"}</td><td>{new Date(m.created_at).toLocaleString("es-PE")}</td></tr>})}
      {!movements?.length&&<tr><td colSpan={5} className="muted">Todavía no hay movimientos.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
