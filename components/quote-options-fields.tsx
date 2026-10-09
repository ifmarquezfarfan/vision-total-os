export type QuoteOpticalConfiguration = {
  lens_family?: string | null;
  lens_material?: string | null;
  lens_treatments?: string[] | null;
  lens_series?: string | null;
  package_brand?: string | null;
  price_note?: string | null;
};

const lensFamilies = [
  ["Monofocal (lejos)", "Monofocal (lejos)"],
  ["Monofocal (cerca)", "Monofocal (cerca)"],
  ["Progresivo/Bifocal", "Progresivo / bifocal"],
] as const;

const lensMaterials = [
  ["Resina simple", "Resina simple"],
  ["Cristal-Vidrio", "Cristal / vidrio"],
  ["CR-39 (NK-55)", "CR-39 (NK-55)"],
  ["Policarbonato", "Policarbonato"],
  ["Trivex", "Trivex"],
  ["High Index (Premium)", "High Index (premium)"],
] as const;

const lensTreatments = [
  ["Antirrayas", "Antirrayas"],
  ["Antirreflejo", "Antirreflejo"],
  ["Antiempañante", "Antiempañante"],
  ["Protección UV 400", "Protección UV 400"],
  ["Filtro Azul-Violeta", "Filtro azul-violeta"],
  ["Hidrofóbico/Oleofóbico", "Hidrofóbico / oleofóbico"],
  ["Polarizado", "Polarizado"],
  ["Fotocromático", "Fotocromático"],
] as const;

const lensSeries = [
  ["pending_measurement", "Pendiente de medición"],
  ["1era serie (0.25-2.00)", "1era serie · 0.25 a 2.00"],
  ["2da serie (2.25-4.00)", "2da serie · 2.25 a 4.00"],
  ["3ra serie (4.25-6.00)", "3ra serie · 4.25 a 6.00"],
  ["4ta serie (>6.25)", "4ta serie · mayor de 6.25"],
] as const;

export function QuoteOptionsFields({
  values = {},
  mode = "initial",
}: {
  values?: QuoteOpticalConfiguration;
  mode?: "initial" | "final";
}) {
  const selectedTreatments = values.lens_treatments ?? [];
  return (
    <section className="quote-options-card">
      <div className="quote-options-heading">
        <div>
          <span className="eyebrow">{mode === "final" ? "CONFIGURACIÓN CONFIRMADA" : "OPCIONES PARA ORIENTAR LA COMPRA"}</span>
          <h3>{mode === "final" ? "Actualiza las especificaciones con la medición recibida" : "Define las cualidades que vas a explicar al cliente"}</h3>
          <p>{mode === "final" ? "Estos valores acompañan los productos y precios definitivos." : "Esta sección describe tipos, materiales y tratamientos. Todavía no obliga a escoger una marca o referencia exacta."}</p>
        </div>
        <span className="quote-options-mark">RX</span>
      </div>

      <div className="quote-options-grid">
        <fieldset className="quote-options-fieldset">
          <legend>Tipo de luna</legend>
          {lensFamilies.map(([value, label]) => (
            <label className="quote-choice" key={value}>
              <input type="radio" name="lens_family" value={value} defaultChecked={values.lens_family === value}/>
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="quote-options-fieldset">
          <legend>Material</legend>
          {lensMaterials.map(([value, label]) => (
            <label className="quote-choice" key={value}>
              <input type="radio" name="lens_material" value={value} defaultChecked={values.lens_material === value}/>
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="quote-options-fieldset quote-treatment-fieldset">
          <legend>Tratamientos sugeridos / elegidos</legend>
          <div className="quote-treatment-grid">
            {lensTreatments.map(([value, label]) => (
              <label className="quote-choice" key={value}>
                <input type="checkbox" name="lens_treatments" value={value} defaultChecked={selectedTreatments.includes(value)}/>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="quote-options-fieldset">
          <legend>Medida / serie</legend>
          {lensSeries.map(([value, label]) => (
            <label className="quote-choice" key={value}>
              <input type="radio" name="lens_series" value={value} defaultChecked={(values.lens_series || "pending_measurement") === value}/>
              <span>{label}</span>
            </label>
          ))}
          <small className="field-hint">No fijes la serie antes de recibir la medición. Confirma los rangos según el proveedor.</small>
        </fieldset>

        <div className="quote-package-fields">
          <div className="field">
            <label>Paquete / marca / alternativa</label>
            <input name="package_brand" defaultValue={values.package_brand || ""} placeholder="Ej. Paquete intermedio · marca por definir"/>
          </div>
          <div className="field">
            <label>Nota del precio</label>
            <input name="price_note" defaultValue={values.price_note || (mode === "final" ? "" : "Precio orientativo, sujeto a medición")} placeholder="Ej. sujeto a graduación, disponibilidad y selección final"/>
          </div>
          <p className="quote-options-footnote">El precio se captura en la propuesta económica de abajo. Esta ficha técnica explica qué se está ofreciendo y evita confundir la orientación inicial con una receta o producto ya definido.</p>
        </div>
      </div>
    </section>
  );
}
