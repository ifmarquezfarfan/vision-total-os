const STEPS = [
  { title: "Cotización", hint: "Datos del cliente y opciones" },
  { title: "Medición", hint: "Receta del proveedor" },
  { title: "Cotización final", hint: "Montura, lunas y precio" },
  { title: "Pago y entrega", hint: "Comprobante y pedido" },
] as const;

const DONE: Record<string, number> = {
  initial_quote: 1,
  measurement_pending: 1,
  measurement_received: 2,
  final_quote: 3,
  sale_completed: 4,
};

export default function FlowSteps({ stage }: { stage: string }) {
  if (stage === "cancelled") {
    return (
      <p>
        <span className="badge" data-status="cancelled">
          Cotización cancelada
        </span>
      </p>
    );
  }

  const done = DONE[stage] ?? 0;

  return (
    <ol className="flow" aria-label="Avance de la venta">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          data-n={i + 1}
          className={i < done ? "is-done" : i === done ? "is-current" : undefined}
          aria-current={i === done ? "step" : undefined}
        >
          <strong>{step.title}</strong>
          <small>{step.hint}</small>
        </li>
      ))}
    </ol>
  );
}
