import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { PrintButton } from "@/components/print-button";

const money=new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"});
const componentLabel:Record<string,string>={frame:"Montura",lens:"Lunas",treatment:"Tratamiento",service:"Servicio",accessory:"Accesorio",other:"Otro"};

export default async function SaleReceiptPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  const {data:branch}=await supabase.from("branch_members").select("branch_id").eq("user_id",user.id).eq("active",true).limit(1).maybeSingle();
  if(!membership||!branch) redirect("/onboarding");

  const {data:sale}=await supabase.from("sales")
    .select("id,sale_code,sale_at,client_id,subtotal,discount,total,paid_amount,balance_due,payment_status,payment_method,responsible,notes,organization_id,branch_id")
    .eq("id",id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle();
  if(!sale) redirect("/ventas?error=Venta%20no%20encontrada");
  const [{data:client},{data:items},{data:payments},{data:order}]=await Promise.all([
    sale.client_id?supabase.from("clients").select("full_name,dni,phone,whatsapp").eq("id",sale.client_id).eq("organization_id",membership.organization_id).eq("branch_id",branch.branch_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from("sale_items").select("id,description,component_type,quantity,unit_price,discount,line_total").eq("sale_id",sale.id).order("id"),
    supabase.from("sale_payments").select("paid_at,amount,payment_method,reference").eq("sale_id",sale.id).order("paid_at"),
    supabase.from("optical_orders").select("order_code,status,lab,promised_at").eq("sale_id",sale.id).maybeSingle()
  ]);

  return <div className="shell"><Sidebar/><main className="main">
    <header className="topbar"><strong>Constancia de venta</strong><span className="muted">{user.email}</span></header>
    <div className="content receipt-page">
      <div className="receipt-actions"><Link href={"/ventas/"+sale.id} className="btn btn-secondary">← Volver a venta</Link><PrintButton label="Imprimir / guardar PDF"/></div>
      <article className="sales-receipt">
        <header className="sales-receipt-head"><div className="sales-receipt-mark">VT</div><h1>ÓPTICA VISIÓN TOTAL</h1><p>Constancia de venta</p><strong>{sale.sale_code}</strong><span>{new Date(sale.sale_at).toLocaleString("es-PE")}</span></header>
        <div className="receipt-rule"></div>
        <section className="receipt-client"><small>CLIENTE</small><strong>{client?.full_name||"Cliente de mostrador"}</strong>{client?.dni&&<span>Doc. {client.dni}</span>}{(client?.whatsapp||client?.phone)&&<span>{client.whatsapp||client.phone}</span>}</section>
        <div className="receipt-rule dashed"></div>
        <table className="receipt-items"><thead><tr><th>Detalle</th><th>Cant.</th><th>Total</th></tr></thead><tbody>
          {(items??[]).map(item=><tr key={item.id}><td><strong>{item.description}</strong><small>{componentLabel[item.component_type]||item.component_type}{Number(item.discount)>0?" · Desc. "+money.format(Number(item.discount)):""}</small><small>{money.format(Number(item.unit_price)||0)} c/u</small></td><td>{Number(item.quantity)}</td><td>{money.format(Number(item.line_total)||0)}</td></tr>)}
        </tbody></table>
        <div className="receipt-rule dashed"></div>
        <section className="receipt-totals"><div><span>Subtotal</span><strong>{money.format(Number(sale.subtotal)||0)}</strong></div><div><span>Descuento</span><strong>{money.format(Number(sale.discount)||0)}</strong></div><div className="receipt-total"><span>TOTAL</span><strong>{money.format(Number(sale.total)||0)}</strong></div><div><span>Pagado</span><strong>{money.format(Number(sale.paid_amount)||0)}</strong></div><div><span>Saldo pendiente</span><strong>{money.format(Number(sale.balance_due)||0)}</strong></div></section>
        <section className="receipt-payment"><small>ESTADO DEL PAGO</small><strong>{sale.payment_status==="paid"?"Pagado":sale.payment_status==="partial"?"Pago parcial":"Pendiente"}</strong><span>Medio inicial: {sale.payment_method||"No indicado"}</span>{sale.responsible&&<span>Atendido por: {sale.responsible}</span>}</section>
        {(payments??[]).length>0&&<section className="receipt-payment-history"><small>REGISTRO DE PAGOS</small>{(payments??[]).map((payment,i)=><div key={i}><span>{new Date(payment.paid_at).toLocaleDateString("es-PE")} · {payment.payment_method||"Sin medio"}</span><strong>{money.format(Number(payment.amount)||0)}</strong></div>)}</section>}
        {order&&<section className="receipt-order"><small>PEDIDO ÓPTICO</small><strong>{order.order_code}</strong><span>{({received:"Recibido",in_preparation:"En preparación",at_lab:"En laboratorio",ready:"Listo",delivered:"Entregado",cancelled:"Cancelado"} as Record<string,string>)[order.status]||order.status}{order.lab?" · "+order.lab:""}</span>{order.promised_at&&<span>Fecha prometida: {new Date(order.promised_at).toLocaleDateString("es-PE")}</span>}</section>}
        {sale.notes&&<section className="receipt-notes"><small>NOTAS</small><p>{sale.notes}</p></section>}
        <footer className="sales-receipt-footer"><strong>¡Gracias por confiar en Visión Total!</strong><p>Conserva esta constancia para consultar tu compra, pagos y pedido.</p><div className="receipt-rule dashed"></div><span>Documento interno de control. No es una boleta electrónica ni comprobante fiscal autorizado.</span></footer>
      </article>
      <div className="receipt-legal-note"><strong>Sobre la boleta electrónica</strong><span>Esta vista sirve para imprimir la constancia de la operación y guardarla como PDF. Para emitir la boleta fiscal y conectar un POS real, hay que integrar el proveedor y la autorización correspondiente.</span></div>
    </div>
  </main></div>;
}
