import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

type SearchParams = {
  q?: string;
  design?: string;
  material?: string;
  min_index?: string;
  phi_min?: string;
  sphere?: string;
  cylinder?: string;
  axis?: string;
  pd?: string;
  max_price?: string;
  prism?: string;
  sort?: string;
  coating?: string | string[];
};

type LensProduct = {
  id: string;
  product_code: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  sale_price: number | string;
  stock_qty: number | null;
  inventory_mode: string;
  lens_design: string | null;
  lens_material: string | null;
  lens_index: number | string | null;
  lens_phi_mm: number | string | null;
  lens_coatings: string[] | null;
  lens_prism_capable: boolean;
  lens_sphere_min: number | string | null;
  lens_sphere_max: number | string | null;
  lens_cylinder_min: number | string | null;
  lens_cylinder_max: number | string | null;
};

const coatingOptions = [
  ["Antirreflejo", "Antirreflejo"],
  ["Filtro UV", "Filtro UV"],
  ["Filtro azul", "Filtro azul"],
  ["Fotocromático", "Fotocromático"],
  ["Polarizado", "Polarizado"],
  ["Antirrayas", "Antirrayas"],
  ["Hidrofóbico", "Hidrofóbico"],
  ["Oleofóbico", "Oleofóbico"],
  ["Espejado", "Espejado"],
] as const;

function val(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function list(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
function num(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function matchesRange(value: number | null, min: unknown, max: unknown) {
  if (value === null) return true;
  const lo = num(min);
  const hi = num(max);
  if (lo !== null && value < lo) return false;
  if (hi !== null && value > hi) return false;
  return true;
}
function formatPower(value: unknown) {
  const n = num(value);
  if (n === null) return "·";
  return n > 0 ? "+" + n.toFixed(2) : n.toFixed(2);
}
function productName(product: LensProduct) {
  return [product.brand, product.model].filter(Boolean).join(" ") || product.description || product.product_code;
}

export default async function LensEnginePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  const { data: branch } = await supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
  if (!membership || !branch) redirect("/onboarding");

  const q = val(params.q).trim();
  const design = val(params.design);
  const material = val(params.material);
  const minIndex = num(val(params.min_index));
  const phiMin = num(val(params.phi_min));
  const sphere = num(val(params.sphere));
  const cylinder = num(val(params.cylinder));
  const axis = num(val(params.axis));
  const pd = num(val(params.pd));
  const maxPrice = num(val(params.max_price));
  const prismRequired = val(params.prism) === "on";
  const coatings = list(params.coating).filter(Boolean);
  const sort = val(params.sort) || "relevance";

  let productQuery = supabase
    .from("products")
    .select("id,product_code,brand,model,description,sale_price,stock_qty,inventory_mode,lens_design,lens_material,lens_index,lens_phi_mm,lens_coatings,lens_prism_capable,lens_sphere_min,lens_sphere_max,lens_cylinder_min,lens_cylinder_max")
    .eq("organization_id", membership.organization_id)
    .eq("branch_id", branch.branch_id)
    .eq("active", true)
    .eq("category", "Lentes")
    .order("brand")
    .limit(500);

  if (q) {
    const safe = q.replace(/[%,()]/g, "").slice(0, 80);
    if (safe) productQuery = productQuery.or(`product_code.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  const { data, error } = await productQuery;
  const catalog = (data ?? []) as LensProduct[];
  const filtered = catalog.filter((product) => {
    if (design && product.lens_design !== design) return false;
    if (material && product.lens_material !== material) return false;
    if (minIndex !== null && (num(product.lens_index) === null || num(product.lens_index)! < minIndex)) return false;
    if (phiMin !== null && (num(product.lens_phi_mm) === null || num(product.lens_phi_mm)! < phiMin)) return false;
    if (sphere !== null && !matchesRange(sphere, product.lens_sphere_min, product.lens_sphere_max)) return false;
    if (cylinder !== null && !matchesRange(cylinder, product.lens_cylinder_min, product.lens_cylinder_max)) return false;
    if (maxPrice !== null && Number(product.sale_price) > maxPrice) return false;
    if (prismRequired && !product.lens_prism_capable) return false;
    const availableCoatings = product.lens_coatings ?? [];
    if (coatings.some((coating) => !availableCoatings.includes(coating))) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "price_asc") return Number(a.sale_price) - Number(b.sale_price);
    if (sort === "price_desc") return Number(b.sale_price) - Number(a.sale_price);
    if (sort === "index_asc") return (num(a.lens_index) ?? 99) - (num(b.lens_index) ?? 99);
    if (sort === "name") return productName(a).localeCompare(productName(b), "es");
    return productName(a).localeCompare(productName(b), "es");
  });

  const filtersActive = Boolean(q || design || material || minIndex !== null || phiMin !== null || sphere !== null || cylinder !== null || maxPrice !== null || prismRequired || coatings.length);
  const completeCount = filtered.filter((p) => p.lens_design && p.lens_material && num(p.lens_index) !== null && num(p.lens_phi_mm) !== null).length;
  const formatter = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

  return (
    <div className="shell">
      <Sidebar />
      <main className="main lens-engine-page">
        <header className="topbar"><strong>Lens Engine / Buscador de lunas</strong><span className="muted">{user.email}</span></header>
        <div className="content lens-engine-content">
          <div className="lens-page-heading">
            <div>
              <div className="eyebrow">VISIÓN TOTAL · SELECCIÓN ÓPTICA</div>
              <h1 className="page-title">Buscador de lunas</h1>
              <p className="subtitle">Encuentra productos del catálogo por diseño, índice, receta registrada y tratamientos.</p>
            </div>
            <div className="lens-heading-actions">
              <Link href="/pedidos" className="btn btn-secondary">Pedidos ópticos</Link>
              <Link href="/inventario#nuevo-producto" className="btn btn-primary">＋ Agregar luna</Link>
            </div>
          </div>

          <div className="lens-engine-layout">
            <aside className="lens-filters-panel">
              <div className="lens-filters-top">
                <div className="lens-search-icon"><span>⌕</span></div>
                <div><span className="lens-eyebrow">PARÁMETROS</span><h2>Buscar lentes</h2><p>Define lo que necesitas. No es necesario llenar todos los campos.</p></div>
              </div>
              <form method="get" action="/buscador-lunas" className="lens-filter-form">
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-query">BUSCAR POR NOMBRE</label>
                  <input id="lens-query" name="q" type="search" placeholder="Marca, modelo o código" defaultValue={q}/>
                </div>
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-design">DISEÑO</label>
                  <select id="lens-design" name="design" defaultValue={design}><option value="">Todos los diseños</option><option>Monofocal</option><option>Bifocal</option><option>Progresivo</option><option>Ocupacional</option><option>Otro</option></select>
                </div>
                <div className="lens-filter-section">
                  <div className="lens-filter-label">RECETA (DIÓPTRÍAS)</div>
                  <div className="lens-number-pair">
                    <div><label htmlFor="lens-sphere">ESFERA / SPH</label><input id="lens-sphere" name="sphere" type="number" min="-30" max="30" step="0.25" placeholder="-3.00" defaultValue={val(params.sphere)}/></div>
                    <div><label htmlFor="lens-cylinder">CILINDRO / CYL</label><input id="lens-cylinder" name="cylinder" type="number" min="-15" max="15" step="0.25" placeholder="-1.00" defaultValue={val(params.cylinder)}/></div>
                  </div>
                  <p className="lens-filter-help">Se compara con el rango declarado en la ficha del producto. Si el rango está vacío, la potencia queda pendiente de confirmar.</p>
                </div>
                <div className="lens-filter-section">
                  <div className="lens-number-pair">
                    <div><label htmlFor="lens-axis">EJE / AXIS</label><input id="lens-axis" name="axis" type="number" min="1" max="180" step="1" placeholder="90°" defaultValue={val(params.axis)}/></div>
                    <div><label htmlFor="lens-pd">DP (mm)</label><input id="lens-pd" name="pd" type="number" min="1" max="100" step="0.5" placeholder="63" defaultValue={val(params.pd)}/></div>
                  </div>
                  <p className="lens-filter-help">Eje y DP se muestran como contexto para el pedido; no determinan por sí solos la compatibilidad del diseño.</p>
                  <label className="lens-checkline"><input type="checkbox" name="prism" defaultChecked={prismRequired}/> Requiere fabricación con prisma</label>
                </div>
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-material">MATERIAL</label>
                  <select id="lens-material" name="material" defaultValue={material}><option value="">Todos los materiales</option><option>Resina orgánica</option><option>Policarbonato</option><option>Trivex</option><option>Vidrio mineral</option><option>Resina de alto índice</option><option>Otro</option></select>
                </div>
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-index">ÍNDICE MÍNIMO</label>
                  <select id="lens-index" name="min_index" defaultValue={val(params.min_index)}><option value="">Cualquier índice</option><option value="1.50">1.50 o superior</option><option value="1.53">1.53 o superior</option><option value="1.56">1.56 o superior</option><option value="1.59">1.59 o superior</option><option value="1.60">1.60 o superior</option><option value="1.67">1.67 o superior</option><option value="1.74">1.74</option></select>
                </div>
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-phi">PHI / DIÁMETRO MÍNIMO</label>
                  <select id="lens-phi" name="phi_min" defaultValue={val(params.phi_min)}><option value="">Sin mínimo</option><option value="65">65 mm o más</option><option value="67">67 mm o más</option><option value="70">70 mm o más</option><option value="75">75 mm o más</option><option value="80">80 mm o más</option></select>
                </div>
                <div className="lens-filter-section">
                  <label className="lens-filter-label" htmlFor="lens-max-price">PRECIO DE VENTA MÁXIMO</label>
                  <input id="lens-max-price" name="max_price" type="number" min="0" step="0.01" placeholder="S/ 250.00" defaultValue={val(params.max_price)}/>
                </div>
                <div className="lens-filter-section">
                  <div className="lens-filter-label">TRATAMIENTOS / COATING</div>
                  <div className="lens-coating-options">{coatingOptions.map(([value,label])=><label key={value} className="lens-checkline"><input type="checkbox" name="coating" value={value} defaultChecked={coatings.includes(value)}/>{label}</label>)}</div>
                </div>
                <div className="lens-filter-actions">
                  <button type="submit" className="btn lens-search-button"><span>⌕</span> Buscar lunas</button>
                  <Link href="/buscador-lunas" className="lens-clear-button">Limpiar filtros</Link>
                </div>
              </form>
            </aside>

            <section className="lens-results-panel">
              <div className="lens-results-head">
                <div>
                  <div className="lens-breadcrumb">Lens engine <span>/</span> <strong>Resultados del catálogo</strong></div>
                  <h2>Opciones para tu pedido</h2>
                  <p className="muted">{filtered.length} resultado(s) · {completeCount} con ficha óptica básica completa · máximo 500 productos revisados.</p>
                </div>
                <form method="get" action="/buscador-lunas" className="lens-sort-form">
                  {Object.entries(params).flatMap(([key,value]) => list(value).map((v)=>({key,value:v}))).filter((entry)=>entry.key!=="sort").map((entry,i)=><input key={entry.key+"-"+i} type="hidden" name={entry.key} value={entry.value}/>)}
                  <label htmlFor="lens-sort">ORDENAR</label>
                  <select id="lens-sort" name="sort" defaultValue={sort}><option value="relevance">Nombre</option><option value="name">Nombre A–Z</option><option value="price_asc">Precio: menor a mayor</option><option value="price_desc">Precio: mayor a menor</option><option value="index_asc">Índice: menor a mayor</option></select>
                  <button className="btn btn-secondary">Ordenar</button>
                </form>
              </div>

              {(sphere!==null||cylinder!==null||axis!==null||pd!==null) && <div className="lens-rx-summary">
                <strong>Parámetros de receta</strong>
                <span>SPH {formatPower(sphere)} · CYL {formatPower(cylinder)} · EJE {axis===null?"·":axis+"°"} · DP {pd===null?"·":pd+" mm"}</span>
                <small>Antes de ordenar, verifica la receta original, el centrado y los requisitos del laboratorio.</small>
              </div>}

              {error && <div className="notice notice-error">No se pudo leer el catálogo. Verifica la conexión e inténtalo de nuevo.</div>}

              <div className="lens-result-list">
                {filtered.map((product) => {
                  const index=num(product.lens_index);
                  const phi=num(product.lens_phi_mm);
                  const name=productName(product);
                  const rangeComplete=num(product.lens_sphere_min)!==null&&num(product.lens_sphere_max)!==null&&num(product.lens_cylinder_min)!==null&&num(product.lens_cylinder_max)!==null;
                  const specComplete=Boolean(product.lens_design&&product.lens_material&&index!==null&&phi!==null);
                  return <article className="lens-product-card" key={product.id}>
                    <div className="lens-product-mark"><div className="lens-product-icon">◉</div><small>{product.product_code}</small></div>
                    <div className="lens-product-main">
                      <div className="lens-product-heading"><div><h3>{name}</h3><p>{product.description||product.lens_design||"Luna óptica"}</p></div><span className={"lens-spec-status "+(specComplete?"complete":"incomplete")}>{specComplete?"Ficha básica completa":"Ficha pendiente"}</span></div>
                      <div className="lens-tags">
                        {product.lens_design&&<span>{product.lens_design}</span>}
                        {product.lens_material&&<span>{product.lens_material}</span>}
                        {index!==null&&<span>Índice {index.toFixed(2)}</span>}
                        {phi!==null&&<span>PHI {phi} mm</span>}
                        {product.lens_prism_capable&&<span>Admite prisma</span>}
                      </div>
                      <div className="lens-product-details">
                        <div><small>Esfera</small><strong>{product.lens_sphere_min!==null||product.lens_sphere_max!==null?`${formatPower(product.lens_sphere_min)} a ${formatPower(product.lens_sphere_max)}`:"Rango no registrado"}</strong></div>
                        <div><small>Cilindro</small><strong>{product.lens_cylinder_min!==null||product.lens_cylinder_max!==null?`${formatPower(product.lens_cylinder_min)} a ${formatPower(product.lens_cylinder_max)}`:"Rango no registrado"}</strong></div>
                        <div><small>Tratamientos</small><strong>{(product.lens_coatings??[]).join(" · ")||"No registrados"}</strong></div>
                        <div><small>Disponibilidad</small><strong>{product.inventory_mode==="stock"?(Number(product.stock_qty)>0?`${product.stock_qty} unidad(es)`:"Sin stock"):"Bajo pedido"}</strong></div>
                      </div>
                    </div>
                    <div className="lens-product-side"><strong className="lens-product-price">{formatter.format(Number(product.sale_price)||0)}</strong><Link href={`/pedidos?lens_product_id=${encodeURIComponent(product.id)}`} className="btn btn-primary">Aplicar al pedido <span>→</span></Link><Link href={`/inventario/${product.id}`} className="lens-product-link">Ver ficha completa</Link></div>
                    {((sphere!==null||cylinder!==null)&&!rangeComplete)&&<div className="lens-unknown-note">Hay rangos de potencia sin registrar para este producto. Confirma su capacidad con el proveedor antes de seleccionarlo.</div>}
                  </article>;
                })}
                {!filtered.length&&<div className="lens-empty-state">
                  <div className="lens-empty-icon">⌕</div>
                  <h3>{catalog.length===0?"Todavía no hay lunas en el catálogo":"No encontramos coincidencias con estos filtros"}</h3>
                  <p>{catalog.length===0?"Agrega las lunas reales que trabajas y completa índice, material, PHI y recubrimientos. El buscador usará esos datos, no una lista ficticia.":"Prueba quitar un filtro o amplía el rango de precio, índice o potencia."}</p>
                  <div className="lens-empty-actions"><Link className="btn btn-primary" href="/inventario#nuevo-producto">Agregar luna al catálogo</Link><Link className="btn btn-secondary" href="/buscador-lunas">Reiniciar búsqueda</Link></div>
                </div>}
              </div>

              <div className="lens-results-footer"><span>Catálogo de esta sucursal</span><span>{filtered.length} opciones mostradas</span></div>
              <p className="lens-disclaimer">Las coincidencias se basan únicamente en la información cargada en Visión Total. La selección final, el centrado y la fabricación deben verificarse con la receta y el laboratorio.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
