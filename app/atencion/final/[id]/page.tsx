import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { QuoteBuilder } from "@/components/quote-builder";
import { createFinalQuoteFromMeasurement } from "../../actions";

type ProductRow = {id:string;product_code:string;category:string|null;brand:string|null;model:string|null;description:string|null;cost:number|string;sale_price:number|string};
type QuoteItemRow = {product_id:string|null;description:string|null;component_type:string|null;quantity:number|string;unit_price:number|string;unit_cost:number|string;discount:number|string};
type Configuration = {intended_use?:string|null;priority?:string|null;budget_reference?:number|string|null;client_preference?:string|null;sale_channel?:string|null};

const fmt = (value:unknown) => value===null||value===undefined||value===""?"·":(Number(value)>0?"+":"")+Number(value).toFixed(2);
const money = (value:unknown) => "S/ "+Number(value||0).toFixed(2);

export default async function FinalQuotePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {
  const {id:initialQuoteId}=await params;
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const {data:parent}=await supabase.from("quotes")
    .select("id,quote_code,client_id,lead_id,total,notes,workflow_stage,quote_kind,measurement_status,prescription_id,measurement_provider,measurement_received_at,optical_configuration")
    .eq("id",initialQuoteId).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle();
  if(!parent||parent.workflow_stage!=="measurement_received"||parent.measurement_status!=="received"||!parent.prescription_id||parent.quote_kind!=="initial") {
    redirect("/atencion?error=Primero%20registra%20la%20medición%20externa");
  }
  const {data:activeFinal}=await supabase.from("quotes").select("id,quote_code")
    .eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("parent_quote_id",parent.id).eq("quote_kind","final")
    .not("status","in","(cancelled,rejected,expired)").limit(1).maybeSingle();
  if(activeFinal) redirect("/atencion?error=Esta%20atención%20ya%20tiene%20una%20cotización%20final%20activa");

  const [{data:client},{data:rx},{data:initialItemsRaw},{data:productRows}] = await Promise.all([
    supabase.from("clients").select("id,full_name,dni,whatsapp,phone").eq("id",parent.client_id).maybeSingle(),
    supabase.from("prescriptions").select("exam_at,expires_at,rx_type,cylinder_notation,od_sphere,od_cylinder,od_axis,od_add,os_sphere,os_cylinder,os_axis,os_add,od_near_sphere,od_near_cylinder,od_near_axis,os_near_sphere,os_near_cylinder,os_near_axis,od_prism_horizontal,od_prism_horizontal_base,od_prism_vertical,od_prism_vertical_base,os_prism_horizontal,os_prism_horizontal_base,os_prism_vertical,os_prism_vertical_base,pd,pd_od,pd_os,notes,prescriber_name").eq("id",parent.prescription_id).eq("client_id",parent.client_id).maybeSingle(),
    supabase.from("quote_items").select("product_id,description,component_type,quantity,unit_price,unit_cost,discount").eq("quote_id",parent.id),
    supabase.from("products").select("id,product_code,category,brand,model,description,cost,sale_price").eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).eq("active",true).order("brand").limit(500)
  ]);
  if(!rx) redirect("/atencion?error=No%20se%20encontró%20la%20receta%20vinculada%20a%20esta%20atención");
  const products=((productRows??[]) as ProductRow[]).map((product)=>({...product,cost:Number(product.cost||0),sale_price:Number(product.sale_price||0)}));
  const productMap=new Map<string,ProductRow>(products.map(product=>[product.id,product]));
  const items=(initialItemsRaw??[]) as QuoteItemRow[];
  const initialItems=items.map(item=>{
    const product=item.product_id?productMap.get(item.product_id):undefined;
    return {
      productId:item.product_id,
      productText:product?.product_code??"",
      componentType:item.component_type??"other",
      description:item.description??"",
      quantity:Number(item.quantity??1),
      price:Number(item.unit_price??0).toFixed(2),
      cost:Number(item.unit_cost??0).toFixed(2),
      discount:Number(item.discount??0).toFixed(2)
    };
  });
  const config=(parent.optical_configuration??{}) as Configuration;

  return <div className="shell"><Sidebar/><main className="main"><header className="topbar"><strong>Cotización final</strong><span className="muted">{user.email}</span></header><div className="content final-quote-content">
    <div className="final-quote-back"><Link href="/atencion" className="link-strong">← Volver al flujo de atención</Link></div>
    <div className="spread final-quote-heading"><div><div className="eyebrow">PASO 03 · DESPUÉS DE LA MEDICIÓN</div><h1 className="page-title">Afinar la propuesta y fijar precio</h1><p className="subtitle">La propuesta inicial se copia para que puedas ajustar cada componente sin volver a escribirlo.</p></div><span className="status-badge status-success">Receta vinculada</span></div>
    {query.error&&<p className="notice notice-error">{query.error}</p>}
    <section className="grid grid-3 section final-quote-context">
      <div className="card"><div className="metric-label">Cliente</div><h2>{client?.full_name||"Cliente"}</h2><p className="muted">{client?.dni?"DNI "+client.dni+" · ":""}{client?.whatsapp||client?.phone||"Sin contacto"}</p></div>
      <div className="card"><div className="metric-label">Cotización inicial</div><h2>{parent.quote_code}</h2><p className="muted">Precio referencial {money(parent.total)}</p><p className="muted">Medición recibida {parent.measurement_received_at?new Date(parent.measurement_received_at).toLocaleString("es-PE"):""}</p></div>
      <div className="card"><div className="metric-label">Medición externa</div><h2>{parent.measurement_provider||"Centro externo"}</h2><p className="muted">{rx.prescriber_name||"Profesional no especificado"}</p><p className="muted">{rx.rx_type||"Receta"} · Cilindro {rx.cylinder_notation==="positive"?"positivo":"negativo"}</p></div>
    </section>

    <section className="card section">
      <div className="spread"><div><h2 style={{marginBottom:5}}>Receta confirmada</h2><p className="muted">Verifica contra la receta física o digital. No modifiques valores clínicos para hacer que una luna encaje.</p></div><span className="status-badge status-info">Solo lectura</span></div>
      <div className="table-wrap"><table className="attention-rx-table" style={{minWidth:850}}><thead><tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje °</th><th>ADD</th><th>Prisma H</th><th>Base H</th><th>Prisma V</th><th>Base V</th></tr></thead><tbody>
        <tr><th>OD · Derecho</th><td>{fmt(rx.od_sphere)}</td><td>{fmt(rx.od_cylinder)}</td><td>{rx.od_axis??"·"}</td><td>{fmt(rx.od_add)}</td><td>{fmt(rx.od_prism_horizontal)}</td><td>{rx.od_prism_horizontal_base||"·"}</td><td>{fmt(rx.od_prism_vertical)}</td><td>{rx.od_prism_vertical_base||"·"}</td></tr>
        <tr><th>OI · Izquierdo</th><td>{fmt(rx.os_sphere)}</td><td>{fmt(rx.os_cylinder)}</td><td>{rx.os_axis??"·"}</td><td>{fmt(rx.os_add)}</td><td>{fmt(rx.os_prism_horizontal)}</td><td>{rx.os_prism_horizontal_base||"·"}</td><td>{fmt(rx.os_prism_vertical)}</td><td>{rx.os_prism_vertical_base||"·"}</td></tr>
      </tbody></table></div>
      <div className="final-quote-rx-foot"><span>DP binocular: {rx.pd??"·"} mm</span><span>OD: {rx.pd_od??"·"} mm</span><span>OI: {rx.pd_os??"·"} mm</span><span>Leída: {new Date(rx.exam_at).toLocaleDateString("es-PE")}</span></div>
      {rx.notes&&<p className="notice" style={{marginTop:12}}>Observaciones de receta: {rx.notes}</p>}
    </section>

    <form action={createFinalQuoteFromMeasurement} className="form">
      <input type="hidden" name="parent_quote_id" value={parent.id}/>
      <section className="card section">
        <h2>Preferencias y configuración definitiva</h2>
        <p className="muted">Cada ojo puede tener su propia línea de producto y precio. Las medidas no cambian; lo que se define aquí es la solución comercial recomendada y aprobada con el cliente.</p>
        <div className="form-grid">
          <div className="field"><label>Uso principal</label><select name="final_intended_use" defaultValue={config.intended_use||""}><option value="">Por determinar</option><option>Uso diario</option><option>Pantallas / oficina</option><option>Lectura</option><option>Conducción</option><option>Exterior / deporte</option><option>Ocupacional</option><option>Multifocal / progresivo</option><option>Otro</option></select></div>
          <div className="field"><label>Prioridad del cliente</label><select name="final_priority" defaultValue={config.priority||""}><option value="">Por determinar</option><option>Precio</option><option>Equilibrio precio-calidad</option><option>Calidad / duración</option><option>Diseño / estética</option><option>Comodidad / peso</option></select></div>
          <div className="field"><label>Tipo de montaje</label><select name="final_mounting_type" defaultValue=""><option value="">Por determinar</option><option>Aro completo</option><option>Ranurado / nylor</option><option>Al aire / perforado</option><option>Especial</option></select></div>
          <div className="field"><label>Tratamientos confirmados</label><input name="final_treatment_notes" placeholder="AR, fotocromático, filtro UV..." /></div>
          <div className="field"><label>Especificación de luna OD</label><input name="right_lens_spec" placeholder="Marca, material, diseño o indicación"/></div>
          <div className="field"><label>Especificación de luna OI</label><input name="left_lens_spec" placeholder="Marca, material, diseño o indicación"/></div>
        </div>
      </section>
      <section className="card section">
        <div className="spread final-quote-builder-heading"><div><h2 style={{marginBottom:5}}>Composición y precio final</h2><p className="muted">Las líneas iniciales están precargadas. Cambia los códigos, agrega OD/OI por separado, ajusta precios y elimina lo que ya no se ofrecerá.</p></div><Link href="/buscador-lunas" className="btn btn-secondary">Buscar una luna</Link></div>
        <QuoteBuilder products={products} initialItems={initialItems} submitLabel="Crear cotización final →"/>
      </section>
      <section className="card section">
        <div className="form-grid">
          <div className="field"><label>Vigencia de la propuesta final</label><input name="expires_at" type="date"/></div>
          <div className="field"><label>Descuento final (S/)</label><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></div>
          <div className="field" style={{gridColumn:"span 2"}}><label>Notas para el cliente / taller</label><textarea name="notes" rows={2} defaultValue={parent.notes||""} placeholder="Incluye lo acordado, no reinterpretaciones de la receta."/></div>
        </div>
        <label className="checkline final-quote-confirm"><input type="checkbox" name="recipe_confirmed" required/> Confirmo que verifiqué la receta, los componentes OD/OI, tratamientos, precio y elección con el cliente.</label>
      </section>
    </form>
  </div></main></div>;
}
