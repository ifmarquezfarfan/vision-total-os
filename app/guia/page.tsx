import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

const flow = [
  ["1","Clientes","Busca por DNI/nombre. Crea el cliente cuando realmente sea necesario.","/clientes"],
  ["2","Leads","Úsalo cuando todavía existe una oportunidad que puede convertirse en venta.","/leads"],
  ["3","Cotización","Cuando el cliente necesita una propuesta, arma la combinación de montura + lunas + tratamientos y deja el siguiente paso.","/cotizaciones"],
  ["4","Venta","La venta es el registro comercial definitivo. Usa Inicio rápido y agrega bloques de 3 líneas para pares adicionales.","/ventas"],
  ["5","Pedido óptico","Cuando hay trabajo óptico, conecta venta + cliente + receta + montura + lunas + medidas + laboratorio.","/pedidos"],
  ["6","Seguimiento","Después de vender, registra la próxima acción. Entrega, adaptación, reactivación y renovación viven aquí.","/seguimientos"],
  ["7","Inventario / Compras / Finanzas","Inventario controla producto y stock; Compras abastece; Finanzas controla cobros, gastos y caja.","/inventario"],
  ["8","Auditoría","Es la última capa: quién hizo qué y cuándo. No es para operar, es para revisar y proteger la trazabilidad.","/auditoria"]
] as const;

const modules = [
  ["Dashboard","Centro de control. Te dice qué necesita atención hoy.","/dashboard"],
  ["Clientes","Memoria comercial del cliente y su historial.","/clientes"],
  ["Leads","Oportunidades que todavía no son ventas.","/leads"],
  ["Cotizaciones","Propuestas que pueden convertirse en venta sin perder contexto.","/cotizaciones"],
  ["Ventas","Caja y registro comercial de la operación.","/ventas"],
  ["Pedidos ópticos","Producción óptica especializada, desde receta y medidas hasta QC y entrega.","/pedidos"],
  ["Seguimientos","Agenda de próximas acciones y postventa.","/seguimientos"],
  ["Inventario","Qué tienes, cuánto, dónde, cómo está y qué se está mostrando.","/inventario"],
  ["Compras","Entrada de mercadería, proveedores y pagos de compras.","/compras"],
  ["Finanzas","Facturación, cobros, compras, gastos, margen y caja registrada.","/finanzas"],
  ["Equipo","Usuarios, roles y permisos.","/equipo"],
  ["Auditoría","Bitácora de cambios relevantes.","/auditoria"]
] as const;

const example = [
  "Cliente: Andrea López, nueva compradora.",
  "Cotización: Montura + lunas 1.56 + antirreflejo.",
  "Venta: 1 paquete, adelanto registrado.",
  "Pedido óptico: se vincula la venta, receta, montura, diseño, material, tratamientos, medidas y laboratorio.",
  "QC: revisión aprobada. Luego se marca aviso de recojo y, finalmente, entrega.",
  "Seguimiento: se agenda adaptación y un futuro control.",
  "Resultado: la venta no termina en el pago. Deja producto, pedido, cliente, agenda y trazabilidad."
];

export default function GuidePage() {
  return (
    <div className="shell"><Sidebar/><main className="main">
      <header className="topbar"><strong>Guía y capacitación</strong><span className="muted">Manual operativo</span></header>
      <div className="content">
        <div className="guide-hero card">
          <div>
            <div className="eyebrow">VISIÓN TOTAL OS</div>
            <h1 className="page-title">Aprende el camino, no memorices botones.</h1>
            <p className="subtitle">Esta sección sirve como capacitación rápida para ti y para cualquier persona que entre a trabajar en la óptica.</p>
          </div>
          <div className="guide-rule"><strong>Regla de oro</strong><span>Cada interacción debe terminar con una próxima acción o con un estado final claro.</span></div>
        </div>

        <section className="section">
          <div className="section-heading"><div><h2>El camino de una venta bien hecha</h2><p className="muted">Sigue esta secuencia cuando no sepas qué módulo abrir.</p></div></div>
          <div className="guide-flow">
            {flow.map(([number,title,description,href]) => (
              <Link href={href} className="guide-step" key={number}>
                <span className="guide-step-number">{number}</span>
                <span><strong>{title}</strong><small>{description}</small></span>
                <span className="quick-start-arrow">›</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card section">
          <div className="section-heading"><div><h2>Ejemplo completo de capacitación</h2><p className="muted">Puedes usar este caso con una persona nueva hasta que domine el recorrido.</p></div><Link href="/ventas" className="btn btn-primary">Practicar en Ventas</Link></div>
          <div className="training-example">
            {example.map((line,index)=><div key={line} className="training-row"><span>{index+1}</span><p>{line}</p></div>)}
          </div>
        </section>

        <section className="section">
          <div className="section-heading"><div><h2>¿Para qué sirve cada apartado?</h2><p className="muted">La pregunta rápida antes de entrar a cualquier pantalla.</p></div></div>
          <div className="module-guide-grid">
            {modules.map(([name,description,href])=>(
              <Link href={href} className="module-guide-card" key={name}>
                <strong>{name}</strong>
                <span>{description}</span>
                <small>Abrir ›</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-2 section">
          <div className="card">
            <h2>Atajos que ahorran tiempo</h2>
            <div className="tip-list">
              <div><strong>Venta:</strong> Inicio rápido crea 3 líneas de una operación. Usa “Agregar 3 líneas” para el segundo o tercer par.</div>
              <div><strong>Cotización:</strong> parte de una combinación sugerida y ajusta solo lo necesario.</div>
              <div><strong>Pedido óptico:</strong> usa una plantilla de captura y luego valida cada campo antes de enviarlo al laboratorio.</div>
              <div><strong>Dashboard:</strong> úsalo para decidir qué mover primero, no como pantalla decorativa.</div>
            </div>
          </div>
          <div className="card">
            <h2>Errores que esta guía ayuda a evitar</h2>
            <div className="tip-list">
              <div>No registrar una venta porque “ya está en WhatsApp”. WhatsApp comunica; el sistema conserva la memoria.</div>
              <div>Crear una venta sin conectar el pedido óptico cuando el trabajo debe pasar por laboratorio.</div>
              <div>Marcar un pedido como entregado sin QC aprobado y sin registrar el aviso al cliente.</div>
              <div>Usar Auditoría para operar. Auditoría es control, no caja ni inventario.</div>
            </div>
          </div>
        </section>
      </div>
    </main></div>
  );
}
