import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { PrintButton } from "@/components/print-button";

export default async function SaleReceiptPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string}>}) {
  const {id}=await params;
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const {data:sale}=await supabase.from("sales")
    .select("id,sale_code,sale_at,client_id,total,paid_amount,balance_due,payment_status,payment_method,responsible,organization_id,branch_id")
    .eq("id",id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle();
  if(!sale) redirect("/ventas?error=Venta%20no%20encontrada");
  const [{data:client},{data:items},{data:payments}]=await Promise.all([
    sale.client_id?supabase.from("clients").select("full_name,dni,phone,whatsapp,email").eq("id",sale.client_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from("sale_items").select("description,component_type,quantity,unit_price,discount,line_total").eq("sale_id",sale.id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id),
    supabase.from("sale_payments").select("paid_at,amount,payment_method,reference").eq("sale_id",sale.id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).order("paid_at",{ascending:true})
  ]);
  const fmt=(v:unknown)=>Number(v||0).toFixed(2);
  const status=sale.payment_status==="paid"?"PAGADO":sale.payment_status==="partial"?"PAGO PARCIAL":sale.payment_status==="voided"?"ANULADO":"PENDIENTE";
  return <div className="shell receipt-shell"><Sidebar/><main className="main"><header className="topbar"><strong>Comprobante interno de venta</strong><span className="muted">{user.email}</span></header><div className="content receipt-content">
    <div className="spread receipt-toolbar"><div><h1 className="page-title">Ticket de venta</h1><p className="subtitle">Formato imprimible para papel térmico o PDF. No es un comprobante tributario electrónico.</p></div><div className="inline no-print"><Link href={"/ventas/"+sale.id} className="btn btn-secondary">Detalle de venta</Link><PrintButton/></div></div>
    {query.created&&<p className="notice attention-alert no-print">Venta {query.created} registrada correctamente.</p>}
    <article className="thermal-receipt">
      <header className="receipt-center">
        <div className="receipt-mark">VT</div>
        <h2>ÓPTICA VISIÓN TOTAL</h2>
        <p>Atención óptica · Arequipa, Perú</p>
        <div className="receipt-rule"></div>
        <strong>NOTA DE VENTA</strong>
        <strong className="receipt-code">{sale.sale_code}</strong>
        <p>{new Date(sale.sale_at).toLocaleString("es-PE")}</p>
      </header>
      <div className="receipt-rule"></div>
      <div className="receipt-customer">
        <strong>CLIENTE</strong>
        <p>{client?.full_name||"Venta de mostrador"}</p>
        {client?.dni&&<p>Documento: {client.dni}</p>}
        {(client?.whatsapp||client?.phone)&&<p>Contacto: {client.whatsapp||client.phone}</p>}
      </div>
      <div className="receipt-rule"></div>
      <table className="receipt-lines"><thead><tr><th>DETALLE</th><th>CANT.</th><th>IMPORTE</th></tr></thead><tbody>
        {(items??[]).map((item,index)=><tr key={index}><td><strong>{item.description||"Artículo"}</strong><small>{item.component_type||"Producto"} · S/ {fmt(item.unit_price)} c/u{Number(item.discount)>0?" · Desc. S/ "+fmt(item.discount):""}</small></td><td>{Number(item.quantity)}</td><td>{fmt(item.line_total)}</td></tr>)}
      </tbody></table>
      <div className="receipt-rule"></div>
      <div className="receipt-total-row"><span>TOTAL</span><strong>S/ {fmt(sale.total)}</strong></div>
      <div className="receipt-total-row"><span>Pagado</span><strong>S/ {fmt(sale.paid_amount)}</strong></div>
      <div className="receipt-total-row"><span>Saldo</span><strong>S/ {fmt(sale.balance_due)}</strong></div>
      <div className="receipt-total-row"><span>Estado</span><strong>{status}</strong></div>
      <div className="receipt-rule"></div>
      <div className="receipt-payments"><strong>PAGOS REGISTRADOS</strong>
        {(payments??[]).length?(payments??[]).map((payment,index)=><p key={index}>{new Date(payment.paid_at).toLocaleDateString("es-PE")} · {payment.payment_method} · S/ {fmt(payment.amount)}</p>):<p>Sin pagos registrados</p>}
      </div>
      <div className="receipt-rule"></div>
      <footer className="receipt-center">
        <p>Gracias por confiar en Visión Total.</p>
        <p>Conserva este ticket como constancia interna de la operación.</p>
        <small>Este documento es una nota interna y no reemplaza la boleta/factura electrónica autorizada por SUNAT.</small>
        {sale.responsible&&<small>Atendió: {sale.responsible}</small>}
      </footer>
    </article>
    <div className="receipt-next-steps no-print"><Link href="/atencion" className="btn btn-primary">Volver a Atención al cliente</Link><Link href={"/pedidos?from_sale="+sale.id} className="btn btn-secondary">Abrir pedido óptico</Link></div>
  </div></main></div>;
}
