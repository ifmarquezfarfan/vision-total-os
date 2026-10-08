"use client";

type OpticalPreset = {
  label: string;
  description: string;
  values: Record<string,string>;
};

const presets: OpticalPreset[] = [
  {
    label: "Monofocal · 1.56 · AR",
    description: "Plantilla de captura",
    values: { lens_design:"Monofocal", lens_material:"1.56", lens_index:"1.56", treatments:"Antirreflejo" }
  },
  {
    label: "Progresivo · 1.60 · AR",
    description: "Plantilla de captura",
    values: { lens_design:"Progresivo", lens_material:"1.60", lens_index:"1.60", treatments:"Antirreflejo" }
  },
  {
    label: "Fotocromático + AR",
    description: "Plantilla de captura",
    values: { lens_type:"Fotocromática", treatments:"Antirreflejo + Fotocromático" }
  }
];

function apply(values:Record<string,string>) {
  for (const [name,value] of Object.entries(values)) {
    const el = document.querySelector<HTMLSelectElement | HTMLInputElement>(`[name="${name}"]`);
    if (!el) continue;
    el.value = value;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  }
}

export function OpticalOrderQuickStart() {
  return (
    <div className="optical-quick-start">
      <div>
        <div className="eyebrow">Inicio rápido óptico</div>
        <strong>Plantillas para capturar el pedido sin repetir trabajo</strong>
        <p className="muted">Son atajos de registro comercial/operativo, no sustituyen la validación profesional de la receta o la configuración final de las lunas.</p>
      </div>
      <div className="chip-row">
        {presets.map((preset) => (
          <button type="button" key={preset.label} className="chip-button" onClick={() => apply(preset.values)}>
            <span>{preset.label}</span>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
