import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createOrder } from "./actions";
import { QuickStart } from "@/components/quick-start";
import { OpticalOrderQuickStart } from "@/components/optical-order-quick-start";

const statusLabel:Record<string,string>={received:"Recibido",in_preparation:"En preparación",at_lab:"En laboratorio",ready:"Listo",delivered:"Entregado",cancelled:"Cancelado"};

export default async function OrdersPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;updated?:string;from_sale?:string;lens_product_id?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:clients},{data:sales},{data:products},{data:lensProducts},{data:prescriptions},{data:orders}]=await Promise.all([
    supabase.from("clients").select("id,full_name,dni").order("full_name").limit(300),
    supabase.from("sales").select("id,sale_code,client_id").order("sale_at",{ascending:false}).limit(200),
    supabase.from("products").select("id,product_code,brand,model,description,category").eq("active",true).eq("category","Montura").order("brand").limit(300),
    supabase.from("products").select("id,product_code,brand,model,description,sale_price,lens_design,lens_material,lens_index,lens_phi_mm,lens_coatings,lens_prism_capable,lens_sphere_min,lens_sphere_max,lens_cylinder_min,lens_cylinder_max").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("active",true).eq("category","Lentes").order("brand").limit(500),
    supabase.from("prescriptions").select("id,client_id,exam_at").order("exam_at",{ascending:false}).limit(500),
    supabase.from("optical_orders").select("id,order_code,client_id,status,lab,lab_reference,lens_type,treatments,promised_at,qc_status,pickup_notified_at").order("created_at",{ascending:false}).limit(100)
  ]);

  const clientMap=new Map((clients??[]).map(c=>[c.id,c.full_name]));
  const productMap=new Map((products??[]).map(p=>[p.id,[p.brand,p.model].filter(Boolean).join(" ")||p.product_code]));
  const params=await searchParams;

  const primarySaleId = String(params.from_sale ?? "");
  const primarySale = primarySaleId ? (sales ?? []).find(s => s.id === primarySaleId) : null;
  const primaryLensId = String(params.lens_product_id ?? "");
  const selectedLens = primaryLensId ? (lensProducts ?? []).find(p => p.id === primaryLensId) : null;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Pedidos ópticos</strong><span className="muted">{user.email}</span></header><div className="content">
    <div className="spread"><div><h1 className="page-title">Pedidos ópticos</h1><p className="subtitle">La orden de laboratorio concentra receta de lejos/cerca, prisma, centrado, montura, diseño/material/índice/PHI, recubrimientos, QC, entrega y adaptación.</p></div><div className="inline"><Link href="/guia" className="btn btn-secondary">Aprender</Link><Link href="/ventas" className="btn btn-secondary">Volver a ventas</Link></div></div>
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
            {selectedLens&&<div className="notice lens-selected-notice" style={{marginBottom:12}}>Luna del catálogo seleccionada: <strong>{[selectedLens.brand,selectedLens.model].filter(Boolean).join(" ")||selectedLens.product_code}</strong>. Verifica que corresponda a la receta antes de confirmar.</div>}
            <div className="field"><label>Producto del catálogo (opcional)</label><select name="lens_product_id" defaultValue={selectedLens?.id||""}><option value="">Configuración manual</option>{(lensProducts??[]).map(p=><option key={p.id} value={p.id}>{p.product_code} · {[p.brand,p.model].filter(Boolean).join(" ")} · S/ {Number(p.sale_price).toFixed(2)}</option>)}</select><span className="field-hint"><Link href="/buscador-lunas" className="link-strong">Abrir motor de búsqueda de lunas →</Link></span></div>
            <div className="field"><label>Diseño</label><select name="lens_design" defaultValue={selectedLens?.lens_design||""}><option value="">Seleccionar</option><option value="Monofocal">Monofocal</option><option value="Bifocal">Bifocal</option><option value="Progresivo">Progresivo</option><option value="Ocupacional">Ocupacional</option><option value="Otro">Otro</option></select></div>
            <div className="field"><label>Material</label><select name="lens_material" defaultValue={selectedLens?.lens_material||""}><option value="">Seleccionar</option><option value="Resina orgánica">Resina orgánica</option><option value="CR-39">CR-39</option><option value="Policarbonato">Policarbonato</option><option value="Trivex">Trivex</option><option value="Vidrio mineral">Vidrio mineral</option><option value="Resina de alto índice">Resina de alto índice</option><option value="Otro">Otro</option></select><span className="field-hint">Material e índice son datos distintos. Registra cada uno en su campo.</span></div>
            <div className="field"><label>Índice de refracción</label><input name="lens_index" list="lens-index-suggestions" placeholder="Ej. 1.56, 1.60, 1.67" defaultValue={selectedLens?.lens_index==null?"":String(selectedLens.lens_index)} /><datalist id="lens-index-suggestions"><option value="1.50"/><option value="1.53"/><option value="1.56"/><option value="1.59"/><option value="1.60"/><option value="1.67"/><option value="1.70"/><option value="1.74"/></datalist></div>
            <div className="field"><label>Diámetro mínimo / PHI (mm)</label><input name="lens_diameter_mm" type="number" step="1" min="1" max="120" placeholder="Ej. según cálculo o laboratorio" defaultValue={selectedLens?.lens_phi_mm==null?"":String(selectedLens.lens_phi_mm)} /><span className="field-hint">Opcional. Confirma el diámetro requerido con el proveedor o laboratorio.</span></div>
            <div className="field"><label>Espesor central objetivo (mm)</label><input name="lens_center_thickness_mm" type="number" step="0.1" min="0.1" max="20" placeholder="Solo si el laboratorio lo solicita" /></div>
            <div className="field"><label>Espesor de borde objetivo (mm)</label><input name="lens_edge_thickness_mm" type="number" step="0.1" min="0.1" max="20" placeholder="Solo si el laboratorio lo solicita" /></div>
            <div className="field"><label>Marca de luna</label><input name="lens_brand" placeholder="Ej. Essilor, Hoya, Zeiss" defaultValue={selectedLens?.brand||""} /></div>
            <div className="field"><label>Tipo / tecnología</label><input name="lens_type" list="lens-type-suggestions" placeholder="Ej. asférica, digital, freeform" defaultValue={selectedLens?.lens_design||selectedLens?.description||""} /></div>
            <datalist id="lens-type-suggestions"><option value="Digital"/><option value="Asférica"/><option value="Freeform"/><option value="Ocupacional"/><option value="Fotocromática"/><option value="Polarizada"/><option value="Filtro azul"/><option value="Monofocal digital"/></datalist>
            <div className="field"><label>Tinte / color</label><input name="lens_tint_color" placeholder="Ej. gris, marrón, verde, sin tinte" /></div>
          </div>
          <div className="card"><h2>Tratamientos y laboratorio</h2>
            <div className="field"><label>Recubrimientos y tratamientos</label><div className="check-grid">
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Antirreflejo" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Antirreflejo")} /> Antirreflejo</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Filtro UV" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Filtro UV")} /> Filtro UV</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Filtro azul" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Filtro azul")} /> Filtro azul</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Fotocromático" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Fotocromático")} /> Fotocromático</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Polarizado" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Polarizado")} /> Polarizado</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Antirrayas" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Antirrayas")} /> Antirrayas</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Hidrofóbico / fácil limpieza" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Hidrofóbico")} /> Hidrofóbico / fácil limpieza</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Oleofóbico" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Oleofóbico")} /> Oleofóbico</label>
              <label className="checkline"><input type="checkbox" name="treatment_option" value="Espejado" defaultChecked={(selectedLens?.lens_coatings??[]).includes("Espejado")} /> Espejado</label>
            </div></div>
            <div className="field"><label>Otro tratamiento / especificación</label><input name="treatments_other" placeholder="Tinte especial, coating del proveedor, etc." /><span className="field-hint">Puedes marcar varias opciones y añadir una indicación libre.</span></div>
            <div className="field"><label>Laboratorio</label><input name="lab" /></div>
            <div className="field"><label>Referencia de laboratorio</label><input name="lab_reference" /></div>
            <div className="field"><label>Fecha prometida</label><input name="promised_at" type="datetime-local" /></div>
          </div>
        </div>

        <div className="grid grid-3" style={{marginTop:14}}>
          <div className="card">
            <h2>Centrado y alturas</h2>
            <p className="muted">Usa milímetros y registra lo que fue medido. En progresivos, altura de montaje para cada ojo.</p>
            <div className="form-grid">
              <div className="field"><label>DP lejos binocular (mm)</label><input name="pd_binocular" type="number" step="0.5" min="1" max="100" /></div>
              <div className="field"><label>DP lejos OD (mm)</label><input name="pd_od" type="number" step="0.5" min="1" max="50" /></div>
              <div className="field"><label>DP lejos OI (mm)</label><input name="pd_os" type="number" step="0.5" min="1" max="50" /></div>
              <div className="field"><label>DP cerca binocular (mm)</label><input name="pd_near_binocular" type="number" step="0.5" min="1" max="100" /></div>
              <div className="field"><label>DP cerca OD (mm)</label><input name="pd_near_od" type="number" step="0.5" min="1" max="50" /></div>
              <div className="field"><label>DP cerca OI (mm)</label><input name="pd_near_os" type="number" step="0.5" min="1" max="50" /></div>
              <div className="field"><label>Altura OD (mm)</label><input name="height_od" type="number" step="0.5" min="0" /></div>
              <div className="field"><label>Altura OI (mm)</label><input name="height_os" type="number" step="0.5" min="0" /></div>
              <div className="field"><label>Distancia de trabajo (cm)</label><input name="working_distance_cm" type="number" step="1" min="1" max="500" /></div>
            </div>
          </div>
          <div className="card">
            <h2>Adaptación de montura</h2>
            <p className="muted">Medidas que ayudan al centrado, cálculo óptico y elección de montaje. No inventes valores si no fueron tomados.</p>
            <div className="form-grid">
              <div className="field"><label>Calibre A (mm)</label><input name="frame_a" type="number" step="0.5" min="1" /></div>
              <div className="field"><label>Altura B (mm)</label><input name="frame_b" type="number" step="0.5" min="1" /></div>
              <div className="field"><label>Diámetro efectivo ED (mm)</label><input name="frame_ed" type="number" step="0.5" min="1" /></div>
              <div className="field"><label>Puente DBL (mm)</label><input name="frame_dbl" type="number" step="0.5" min="1" /></div>
              <div className="field"><label>Patilla / temple (mm)</label><input name="frame_temple" type="number" step="1" min="1" /></div>
              <div className="field"><label>Ancho frontal (mm)</label><input name="frame_front_width" type="number" step="0.5" min="1" /></div>
              <div className="field"><label>Distancia vértice (mm)</label><input name="vertex" type="number" step="0.5" min="0" /></div>
              <div className="field"><label>Inclinación pantoscópica (°)</label><input name="pantoscopic" type="number" step="0.5" min="-30" max="45" /></div>
              <div className="field"><label>Ángulo de envolvimiento (°)</label><input name="wrap" type="number" step="0.5" min="0" max="90" /></div>
              <div className="field"><label>Tipo de montaje</label><select name="mounting_type" defaultValue=""><option value="">No especificado</option><option value="Aro completo">Aro completo</option><option value="Ranurado / nylor">Ranurado / nylor</option><option value="Al aire / perforado">Al aire / perforado</option><option value="Especial">Especial</option></select></div>
            </div>
          </div>
          <div className="card">
            <h2>Verificación de datos</h2>
            <p className="muted">Antes de enviar al laboratorio, confirma que la receta coincide con el cliente y que cada medida corresponde al ojo correcto.</p>
            <div className="field"><label>Referencia / identificación de montura</label><input name="frame_reference" placeholder="Marca, modelo o SKU si aplica" /></div>
            <div className="field"><label>Medida o instrucción adicional</label><textarea name="measurement_notes" rows={3} placeholder="Prisma, descentramiento indicado por laboratorio, ranurado, perforaciones, etc." /></div>
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
