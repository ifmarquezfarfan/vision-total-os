import Link from "next/link";

type QuickStartItem = {
  label: string;
  href: string;
  description: string;
  tone?: "neutral" | "blue" | "green" | "orange" | "purple";
};

export function QuickStart({items, title="Inicio rápido", hint="Atajos para seguir el camino correcto sin buscar demasiado."}:{items:QuickStartItem[];title?:string;hint?:string}) {
  return (
    <section className="quick-start card section">
      <div className="quick-start-head">
        <div>
          <div className="eyebrow">Atajo</div>
          <h2>{title}</h2>
          <p className="muted">{hint}</p>
        </div>
      </div>
      <div className="quick-start-grid">
        {items.map((item) => (
          <Link key={item.href+item.label} href={item.href} className={`quick-start-item tone-${item.tone||"neutral"}`}>
            <span className="quick-start-dot" />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <span className="quick-start-arrow">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
