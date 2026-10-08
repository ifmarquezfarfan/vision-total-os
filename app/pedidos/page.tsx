import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createOrder } from "./actions";
import { QuickStart } from "@/components/quick-start";
import { OpticalOrderQuickStart } from "@/components/optical-order-quick-start";

const statusLabel:Record<string,string>={received:"Recibido",in_preparation:"En preparación",at_lab:"En laboratorio",ready:"Listo",delivered:"Entregado",cancelled:"Cancelado"};

export default async function OrdersPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;updated?:string;from_sale?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:clients},{data:sales},{data:products},{data:prescriptions},{data:orders}]=await Promise.all([
    supabase.from("clients").select("id,full_name,dni").order("full_name").limit(300),
    supabase.from("sales").select("id,sale_code,client_id").order("sale_at",{ascending:false}).limit(200),
    supabase.from("products").select("id,product_code,brand,model,description,category").eq("active",true).eq("category","Montura").order("brand").limit(300),
    supabase.from("prescriptions").select("id,client_id,exam_at").order("exam_at",{ascending:false}).limit(500),
    supabase.from("optical_orders").select("id,order_code,client_id,status,lab,lab_reference,lens_type,treatments,promised_at,qc_status,pickup_notified_at").order("created_at",{ascending:false}).limit(100)
  ]);

  const clientMap=new Map((clients??[]).map(c=>[c.id,c.full_name]));
  const productMap=new Map((products??[]).map(p=>[p.id,[p.brand,p.model].filter(Boolean).join(" ")||p.product_code]));
  const params=await searchParams;

  const primarySaleId = String(params.from_sale ?? "");
  const primarySale = primarySaleId ? (sales ?? []).find(s => s.id === primarySaleId) : null;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Pedidos ópticos</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">Pedidos ópticos</h1><p className="subtitle">La orden de laboratorio concentra receta, lentes, montura, medidas, tratamientos, QC, entrega y adaptación.</p></div><div className="inline"><Link href="/guia" className="btn btn-secondary">Aprender</Link><Link href="/ventas" className="btn btn-secondary">Volver a ventas</Link></div></div>
    <QuickStart title="Inicio rápido de pedido óptico" hint="Ruta recomendada: venta → receta → montura → configuración de luna → medidas → laboratorio → QC → aviso → entrega." items={[
      {label:"Pedido desde venta",href:"#nuevo-pedido",description:"Mantén el contexto completo",tone:"green"},
      {label:"Captura especializada",href:"#configuracion-optica",description:"Lunas, tratamientos y laboratorio",tone:"blue"},
      {label:"Control de calidad",href:"#flujo-pedido",description:"No entregues sin QC aprobado",tone:"orange"},
      {label:"Seguimiento",href:"/seguimientos",description:"Agenda adaptación / postventa",tone:"purple"}
    ]}/>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}{params.created&&<p className="notice" style={{marginTop:18}}>Pedido creado.</p>}{params.updated&&<p className="notice" style={{marginTop:18}}>Pedido actualizado.</p>}

    <section id="nuevo-pedido" className="card section"><h2>Nuevo pedido óptico</h2>
      {primarySale&&<div className="notice" style={{marginBottom:16}}>Creando pedido para <strong>{primarySale.sale_code}</strong> · {clientMap.get(primarySale.client_id)||"Cliente"}.</div>}
      <form action={createOrder} className="form">
        <div className="field"><label>Cliente *</label><select name="client_id" required defaultValue={primarySale?.client_id||""}><option value="">Seleccionar</option>{(clients??[]).map(c=><option key={c.id} value={c.id}>{c.full_name}{c.dni ? " · "+c.dni : ""}</option>)}</select></div>
        <input type="hidden" name="sale_id" value={primarySale?.id||""}/>
        <div className="grid grid-3" style={{marginTop:14}}>
          <div className="card"><h2>Producto óptico</h2>
            <div className="field"><label>Receta</label><select name="prescription_id" defaultValue=""><option value="">Sin receta</option>{(prescriptions??[]).map(p=><option key={p.id} value={p.id}>{new Date(p.exam_at).toLocaleDateString("es-PE")} · {clientMap.get(p.client_id)||"Cliente"}</option>)}</select></div>
            <div className="field"><label>Montura</label><select name="frame_product_id" defaultValue=""><option value="">Sin montura vinculada</option>{(products??[]).map(p=><option key={p.id} value={p.id}>{p.product_code} · {productMap.get(p.id)||""}</option>)}</select></div>
          </div>
          <div className="card optical-card"><h2>Lunas</h2><OpticalOrderQuickStart/>
            <div className="field"><label>Diseño</label><select name="lens_design" defaultValue=""><option value="">Seleccionar</option><option value="Monofocal">Monofocal</option><option value="Bifocal">Bifocal</option><option value="Progresivo">Progresivo</option><option value="Ocupacional">Ocupacional</option><option value="Otro">Otro</option></select></div>
            <div className="field"><label>Material</label><select name="lens_material" defaultValue=""><option value="">Seleccionar</option><option value="CR-39">CR-39</option><option value="Policarbonato">Policarbonato</option><option value="1.56">1.56</option><option value="1.60">1.60</option><option value="1.67">1.67</option><option value="1.74">1.74</option><option value="Otro">Otro</option></select></div>
            <div className="field"><label>Índice</label><input name="lens_index" placeholder="Ej. 1.56" /></div>
            <div className="field"><label>Marca de luna</label><input name="lens_brand" placeholder="Ej. Essilor, Hoya, Zeiss" /></div>
            <div className="field"><label>Tipo / descripción</label><input name="lens_type" list="lens-type-suggestions" placeholder="Ej. Digital, ocupacional, fotocromática" /></div>
            <datalist id="lens-type-suggestions"><option value="Digital"/><option value="Ocupacional"/><option value="Fotocromática"/><option value="Polarizada"/><option value="Monofocal digital"/></datalist>
          </div>
          <div className="card"><h2>Tratamientos y laboratorio</h2>
            <div className="field"><label>Tratamientos</label><input name="treatments" list="treatment-suggestions" placeholder="Antirreflejo, filtro azul, fotocromático, etc." /><span className="field-hint">Registra lo elegido o solicitado; valida la configuración antes de enviarla.</span></div>
            <datalist id="treatment-suggestions"><option value="Antirreflejo"/><option value="Filtro azul"/><option value="Fotocromático"/><option value="Antirreflejo + Fotocromático"/><option value="Antirreflejo + Filtro azul"/></datalist>
            <div className="field"><label>Laboratorio</label><input name="lab" /></div>
            <div className="field"><label>Referencia de laboratorio</label><input name="lab_reference" /></div>
            <div className="field"><label>Fecha prometida</label><input name="promised_at" type="datetime-local" /></div>
          </div>
        </div>

        <div className="card" style={{marginTop:14}}>
          <h2>Medidas de montaje</h2>
          <p className="muted">No todas son necesarias en todos los trabajos. Se guardan estructuradas para que el pedido pueda viajar completo al laboratorio.</p>
          <div className="form-grid">
            <div className="field"><label>DP binocular</label><input name="pd_binocular" placeholder="mm" /></div>
            <div className="field"><label>DP monocular OD</label><input name="pd_od" placeholder="mm" /></div>
            <div className="field"><label>DP monocular OI</label><input name="pd_os" placeholder="mm" /></div>
            <div className="field"><label>Altura OD</label><input name="height_od" placeholder="mm" /></div>
            <div className="field"><label>Altura OI</label><input name="height_os" placeholder="mm" /></div>
            <div className="field"><label>Distancia vértice</label><input name="vertex" placeholder="mm" /></div>
            <div className="field"><label>Inclinación pantoscópica</label><input name="pantoscopic" placeholder="°" /></div>
            <div className="field"><label>Ángulo de envolvimiento</label><input name="wrap" placeholder="°" /></div>
            <div className="field"><label>Calibre A</label><input name="frame_a" placeholder="mm" /></div>
            <div className="field"><label>Calibre B</label><input name="frame_b" placeholder="mm" /></div>
            <div className="field"><label>Puente DBL</label><input name="frame_dbl" placeholder="mm" /></div>
            <div className="field"><label>Patilla / Temple</label><input name="frame_temple" placeholder="mm" /></div>
          </div>
        </div>

        <div className="grid grid-3" style={{marginTop:14}}>
          <div className="card"><h2>Flujo</h2>
            <div className="field"><label>Seguimiento adaptación</label><input name="adaptation_followup_at" type="datetime-local" /></div>
            <div className="field"><label>Estado inicial</label><select name="status" defaultValue="received"><option value="received">Recibido</option><option value="in_preparation">En preparación</option><option value="at_lab">En laboratorio</option><option value="ready">Listo</option></select></div>
          </div>
          <div className="card" style={{gridColumn:"span 2"}}><h2>Notas</h2><div className="field"><label>Indicaciones especiales</label><input name="notes" placeholder="Curvatura, perforado, montaje especial, observaciones..." /></div></div>
        </div>

        <button className="btn btn-primary">Crear pedido óptico</button>
      </form>
    </section>

    <section className="section"><h2>Pedidos recientes</h2><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Estado</th><th>QC</th><th>Lunas</th><th>Tratamientos</th><th>Laboratorio</th><th>Prometido</th><th></th></tr></thead><tbody>
      {(orders??[]).map(o=><tr key={o.id}><td><Link href={"/pedidos/"+o.id} className="link-strong">{o.order_code}</Link></td><td>{clientMap.get(o.client_id)||"Cliente"}</td><td><span className={`status-badge ${o.status==="delivered"?"status-success":o.status==="ready"?"status-info":o.status==="cancelled"?"status-danger":"status-warning"}`}>{statusLabel[o.status]||o.status}</span></td><td><span className={`status-badge ${o.qc_status==="approved"?"status-success":o.qc_status==="rework"?"status-danger":"status-warning"}`}>{o.qc_status}</span></td><td>{o.lens_type||"·"}</td><td>{o.treatments||"·"}</td><td>{o.lab||"·"}</td><td>{o.promised_at?new Date(o.promised_at).toLocaleString("es-PE"):"·"}</td><td><Link href={"/pedidos/"+o.id} className="link-strong">Gestionar</Link></td></tr>)}
      {!orders?.length&&<tr><td colSpan={9} className="muted">Todavía no hay pedidos ópticos.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
