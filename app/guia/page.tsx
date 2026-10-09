import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

const flow = [
  ["1","Cliente + cotización inicial","Busca un cliente existente o registra sus datos en el primer contacto. Explica opciones y prepara el precio orientativo.","/cotizaciones"],
  ["2","Medición externa","Si el cliente acepta continuar, registra el centro/profesional al que se deriva y después captura la receta y la DP recibidas.","/atencion"],
  ["3","Configuración final","Revisa la receta correcta, montura, luna por ojo, índice, material, tratamientos y precio final. Conserva la propuesta inicial como historial.","/atencion"],
  ["4","Pago y comprobante","Registra el medio de pago y el importe realmente cobrado. Genera el comprobante imprimible y continúa con el pedido.","/atencion"],
  ["5","Pedido óptico","Si requiere laboratorio, conecta venta, receta, montura, luna, medidas, control de calidad y entrega.","/pedidos"],
  ["6","Seguimiento","Después de vender, registra adaptación, entrega, reactivación y renovación.","/seguimientos"],
  ["7","Inventario / Compras / Finanzas","Estas herramientas trabajan detrás del proceso: stock, reposición, cobros, gastos y caja.","/inventario"],
  ["8","Auditoría","Revisa quién hizo qué y cuándo, sin interrumpir la atención.","/auditoria"]
] as const;

const modules = [
  ["Dashboard","Centro de control. Te dice qué necesita atención hoy.","/dashboard"],
  ["Clientes","Memoria comercial del cliente y su historial.","/clientes"],
  ["Leads","Oportunidades que todavía no son ventas.","/leads"],
  ["Atención óptica","Centro que organiza el recorrido de la venta en el orden real del mostrador.","/atencion"],
  ["Cotizaciones","Propuestas iniciales y finales con historial.","/cotizaciones"],
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
  "Cotización inicial: se registra al cliente, preferencias, alternativas de montura/lunas y precio orientativo.",
  "Medición externa: se guarda centro/profesional y se transcribe la receta recibida, vinculada al cliente.",
  "Cotización final: se ajustan por ojo las lunas, índice, material, tratamientos y precio con las medidas confirmadas.",
  "Pago: se registra el medio e importe; la venta y el comprobante quedan ligados al mismo cliente.",
  
  "Pedido óptico: vincula venta, receta de lejos/cerca, prisma y base, DP binocular/monocular, alturas, ajuste de montura, diseño/material/índice/PHI, recubrimientos y laboratorio.",
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
          <div className="section-heading"><div><h2>Ejemplo completo de capacitación</h2><p className="muted">Puedes usar este caso con una persona nueva hasta que domine el recorrido.</p></div><Link href="/atencion" className="btn btn-primary">Practicar recorrido completo</Link></div>
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
              <div><strong>Atención óptica:</strong> empieza con el cliente y la cotización. La aplicación te indica cuándo enviar a medir, terminar la configuración y cobrar.</div>
              <div><strong>Configuración final:</strong> parte de la propuesta inicial para no volver a cargar todo. Ajusta el producto y el precio tras la medición.</div>
              <div><strong>Pago y comprobante:</strong> confirma el importe recibido. El comprobante no reemplaza la boleta electrónica fiscal hasta integrar el proveedor autorizado.</div>
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
