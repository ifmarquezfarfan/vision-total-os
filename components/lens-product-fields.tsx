type LensProductValues = {
  lens_design?: string | null;
  lens_material?: string | null;
  lens_index?: number | string | null;
  lens_phi_mm?: number | string | null;
  lens_coatings?: string[] | null;
  lens_prism_capable?: boolean | null;
  lens_sphere_min?: number | string | null;
  lens_sphere_max?: number | string | null;
  lens_cylinder_min?: number | string | null;
  lens_cylinder_max?: number | string | null;
};

const coatings = [
  ["Antirreflejo","Antirreflejo"],
  ["Filtro UV","Filtro UV"],
  ["Filtro azul","Filtro azul"],
  ["Fotocromático","Fotocromático"],
  ["Polarizado","Polarizado"],
  ["Antirrayas","Antirrayas"],
  ["Hidrofóbico","Hidrofóbico"],
  ["Oleofóbico","Oleofóbico"],
  ["Espejado","Espejado"],
] as const;

export function LensProductFields({ values = {} }: { values?: LensProductValues }) {
  const selectedCoatings = values.lens_coatings ?? [];
  return (
    <details className="lens-spec-details">
      <summary>
        <span>
          <strong>Ficha técnica de la luna</strong>
          <small>Diseño, índice, diámetro, rango de receta y recubrimientos</small>
        </span>
        <span className="lens-spec-chevron">＋</span>
      </summary>
      <div className="lens-spec-body">
        <div className="form-grid">
          <div className="field"><label>Diseño</label><select name="lens_design" defaultValue={values.lens_design ?? ""}><option value="">No especificado</option><option value="Monofocal">Monofocal</option><option value="Bifocal">Bifocal</option><option value="Progresivo">Progresivo</option><option value="Ocupacional">Ocupacional</option><option value="Otro">Otro</option></select></div>
          <div className="field"><label>Material óptico</label><select name="lens_material" defaultValue={values.lens_material ?? ""}><option value="">No especificado</option><option value="Resina orgánica">Resina orgánica</option><option value="Policarbonato">Policarbonato</option><option value="Trivex">Trivex</option><option value="Vidrio mineral">Vidrio mineral</option><option value="Resina de alto índice">Resina de alto índice</option><option value="Otro">Otro</option></select></div>
          <div className="field"><label>Índice de refracción</label><input name="lens_index" type="number" min="1" max="2" step="0.01" placeholder="Ej. 1.60" defaultValue={values.lens_index ?? ""}/></div>
          <div className="field"><label>Diámetro / PHI (mm)</label><input name="lens_phi_mm" type="number" min="1" max="120" step="0.5" placeholder="Ej. 70" defaultValue={values.lens_phi_mm ?? ""}/></div>
        </div>
        <div className="lens-rx-range">
          <div><strong>Rango esférico</strong><span>Potencia que declara el proveedor, en dioptrías.</span></div>
          <div className="lens-range-fields">
            <div className="field"><label>Mínimo</label><input name="lens_sphere_min" type="number" step="0.25" placeholder="Ej. -10.00" defaultValue={values.lens_sphere_min ?? ""}/></div>
            <div className="field"><label>Máximo</label><input name="lens_sphere_max" type="number" step="0.25" placeholder="Ej. +6.00" defaultValue={values.lens_sphere_max ?? ""}/></div>
          </div>
        </div>
        <div className="lens-rx-range">
          <div><strong>Rango cilíndrico</strong><span>Conserva el formato de cilindro definido por el proveedor.</span></div>
          <div className="lens-range-fields">
            <div className="field"><label>Mínimo</label><input name="lens_cylinder_min" type="number" step="0.25" placeholder="Ej. -6.00" defaultValue={values.lens_cylinder_min ?? ""}/></div>
            <div className="field"><label>Máximo</label><input name="lens_cylinder_max" type="number" step="0.25" placeholder="Ej. 0.00" defaultValue={values.lens_cylinder_max ?? ""}/></div>
          </div>
        </div>
        <div className="field">
          <label>Recubrimientos / propiedades</label>
          <div className="check-grid">
            {coatings.map(([value,label])=><label className="checkline" key={value}><input type="checkbox" name="lens_coatings" value={value} defaultChecked={selectedCoatings.includes(value)}/>{label}</label>)}
          </div>
        </div>
        <label className="checkline"><input type="checkbox" name="lens_prism_capable" defaultChecked={values.lens_prism_capable ?? false}/> El proveedor confirma que admite fabricación con prisma</label>
        <p className="field-hint">Registra especificaciones del fabricante o laboratorio. Deja vacío lo que no esté confirmado; el buscador mostrará el catálogo incompleto como pendiente de revisión.</p>
      </div>
    </details>
  );
}
