import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createOrder } from "./actions";

const statusLabel:Record<string,string>={received:"Recibido",in_preparation:"En preparación",at_lab:"En laboratorio",ready:"Listo",delivered:"Entregado",cancelled:"Cancelado"};

export default async function OrdersPage({searchParams}:{searchParams:Promise<{error?:string;created?:string;updated?:string}>}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const [{data:clients},{data:sales},{data:products},{data:prescriptions},{data:orders}]=await Promise.all([
    supabase.from("clients").select("id,full_name,dni").order("full_name").limit(300),
    supabase.from("sales").select("id,sale_code,client_id").order("sale_at",{ascending:false}).limit(200),
    supabase.from("products").select("id,product_code,brand,model,description").eq("active",true).order("brand").limit(300),
    supabase.from("prescriptions").select("id,client_id,exam_at").order("exam_at",{ascending:false}).limit(500),
    supabase.from("optical_orders").select("id,order_code,client_id,status,lab,lab_reference,lens_type,treatments,promised_at,qc_status,pickup_notified_at").order("created_at",{ascending:false}).limit(100)
  ]);

  const clientMap=new Map((clients??[]).map(c=>[c.id,c.full_name]));
  const productMap=new Map((products??[]).map(p=>[p.id,[p.brand,p.model].filter(Boolean).join(" ")||p.product_code]));
  const params=await searchParams;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Pedidos ópticos</strong><span className="muted">{user.email}</span></header><div className="content">
    <h1 className="page-title">Pedidos ópticos</h1><p className="subtitle">Desde la receta y elección de montura hasta laboratorio, control de calidad, aviso y entrega.</p>
    {params.error&&<p className="notice" style={{marginTop:18}}>{params.error}</p>}{params.created&&<p className="notice" style={{marginTop:18}}>Pedido creado.</p>}{params.updated&&<p className="notice" style={{marginTop:18}}>Pedido actualizado.</p>}

    <section className="card section"><h2>Nuevo pedido</h2><form action={createOrder} className="form"><div className="form-grid">
      <div className="field"><label>Cliente *</label><select name="client_id" required defaultValue=""><option value="">Seleccionar</option>{(clients??[]).map(c=><option key={c.id} value={c.id}>{c.full_name}{c.dni ? " · "+c.dni : ""}</option>)}</select></div>
      <div className="field"><label>Venta relacionada</label><select name="sale_id" defaultValue=""><option value="">Ninguna</option>{(sales??[]).map(s=><option key={s.id} value={s.id}>{s.sale_code}</option>)}</select></div>
      <div className="field"><label>Receta</label><select name="prescription_id" defaultValue=""><option value="">Sin receta</option>{(prescriptions??[]).map(p=><option key={p.id} value={p.id}>{new Date(p.exam_at).toLocaleDateString("es-PE")} · {clientMap.get(p.client_id)||"Cliente"}</option>)}</select></div>
      <div className="field"><label>Montura</label><select name="frame_product_id" defaultValue=""><option value="">Sin montura vinculada</option>{(products??[]).map(p=><option key={p.id} value={p.id}>{p.product_code} · {productMap.get(p.id)||""}</option>)}</select></div>
      <div className="field"><label>Tipo de lente</label><input name="lens_type" placeholder="Monofocal, progresivo, etc."/></div>
      <div className="field"><label>Tratamientos</label><input name="treatments" placeholder="Antirreflejo, filtro, etc."/></div>
      <div className="field"><label>Laboratorio</label><input name="lab"/></div>
      <div className="field"><label>Referencia de laboratorio</label><input name="lab_reference"/></div>
      <div className="field"><label>Fecha prometida</label><input name="promised_at" type="datetime-local"/></div>
      <div className="field"><label>Seguimiento adaptación</label><input name="adaptation_followup_at" type="datetime-local"/></div>
      <div className="field"><label>Estado inicial</label><select name="status" defaultValue="received"><option value="received">Recibido</option><option value="in_preparation">En preparación</option><option value="at_lab">En laboratorio</option><option value="ready">Listo</option></select></div>
      <div className="field"><label>Notas</label><input name="notes"/></div>
    </div><button className="btn btn-primary">Crear pedido</button></form></section>

    <section className="section"><h2>Pedidos recientes</h2><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Estado</th><th>QC</th><th>Laboratorio</th><th>Prometido</th><th>Acceso</th></tr></thead><tbody>
      {(orders??[]).map(o=><tr key={o.id}><td><Link href={"/pedidos/"+o.id} className="link-strong">{o.order_code}</Link></td><td>{clientMap.get(o.client_id)||"Cliente"}</td><td>{statusLabel[o.status]||o.status}</td><td>{o.qc_status}</td><td>{o.lab||"·"}</td><td>{o.promised_at?new Date(o.promised_at).toLocaleString("es-PE"):"·"}</td><td><Link href={"/pedidos/"+o.id} className="link-strong">Gestionar</Link></td></tr>)}
      {!orders?.length&&<tr><td colSpan={7} className="muted">Todavía no hay pedidos ópticos.</td></tr>}
    </tbody></table></div></section>
  </div></main></div>;
}
