"use client";

type OpticalPreset = {
  label: string;
  description: string;
  values: Record<string,string|string[]>;
};

const presets: OpticalPreset[] = [
  {
    label: "Monofocal · 1.56 · AR",
    description: "Plantilla de captura",
    values: { lens_design:"Monofocal", lens_material:"Resina orgánica", lens_index:"1.56", treatment_option:["Antirreflejo"] }
  },
  {
    label: "Progresivo · 1.60 · AR",
    description: "Plantilla de captura",
    values: { lens_design:"Progresivo", lens_material:"Resina de alto índice", lens_index:"1.60", treatment_option:["Antirreflejo"] }
  },
  {
    label: "Fotocromático + AR",
    description: "Plantilla de captura",
    values: { lens_type:"Fotocromática", treatment_option:["Antirreflejo","Fotocromático"] }
  }
];

function apply(values:Record<string,string|string[]>) {
  for (const [name,value] of Object.entries(values)) {
    const fields = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (!fields.length) continue;
    const valuesToSelect = Array.isArray(value) ? value : value.split(" · ");
    if (fields[0] instanceof HTMLInputElement && fields[0].type === "checkbox") {
      fields.forEach((field) => {
        if (field instanceof HTMLInputElement) field.checked = valuesToSelect.includes(field.value);
      });
      continue;
    }
    const field = fields[0];
    field.value = Array.isArray(value) ? (value[0] ?? "") : value;
    field.dispatchEvent(new Event("input",{bubbles:true}));
    field.dispatchEvent(new Event("change",{bubbles:true}));
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
