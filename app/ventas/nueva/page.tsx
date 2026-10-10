import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { SaleBuilder } from "@/components/sale-builder";
import { OpticalClientIntake } from "@/components/optical-client-intake";
import { createCompleteOpticalSale } from "./actions";

const treatmentOptions = [
  "Antirreflejo",
  "Filtro UV",
  "Filtro azul",
  "Fotocromático",
  "Polarizado",
  "Antirrayas",
  "Hidrofóbico",
  "Oleofóbico",
] as const;

export default async function NewOpticalSalePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [membershipRes, branchRes] = await Promise.all([
    supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
    supabase.from("branch_members").select("branch_id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
  ]);
  if (!membershipRes.data || !branchRes.data) redirect("/onboarding");

  const organizationId = membershipRes.data.organization_id;
  const branchId = branchRes.data.branch_id;
  const [{ data: clients }, { data: products }, params] = await Promise.all([
    supabase.from("clients")
      .select("id,full_name,dni,phone,whatsapp")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .order("full_name")
      .limit(800),
    supabase.from("products")
      .select("id,product_code,category,brand,model,description,cost,sale_price,stock_qty,inventory_mode")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("brand")
      .limit(500),
    searchParams,
  ]);

  const canOverridePrice = membershipRes.data.role === "owner" || membershipRes.data.role === "admin";

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <strong>Nueva venta · POS óptico</strong>
          <span className="muted">{user.email}</span>
        </header>
        <div className="content optical-pos-content">
          <div className="spread optical-pos-heading">
            <div>
              <div className="eyebrow">VISIÓN TOTAL · PUNTO DE VENTA</div>
              <h1 className="page-title">Atención óptica integral</h1>
              <p className="subtitle">Cliente, receta, componentes, pedido de laboratorio y pago en una sola operación.</p>
            </div>
            <div className="inline">
              <Link href="/ventas" className="btn btn-secondary">Ventas</Link>
              <Link href="/buscador-lunas" className="btn btn-secondary">Buscar lunas</Link>
            </div>
          </div>

          <ol className="flow optical-pos-flow" aria-label="Pasos de la venta">
            <li data-n="1" className="is-current"><strong>Cliente</strong><small>Buscar o registrar</small></li>
            <li data-n="2"><strong>Receta</strong><small>Graduación y DP</small></li>
            <li data-n="3"><strong>Componentes</strong><small>Productos y stock</small></li>
            <li data-n="4"><strong>Cierre</strong><small>Pago y comprobante</small></li>
          </ol>

          {params.error && <div className="notice notice-error optical-pos-error" role="alert">{params.error}</div>}

          <form action={createCompleteOpticalSale} className="optical-pos-form">
            <section className="card optical-pos-section" id="cliente">
              <div className="optical-pos-section-heading">
                <span className="optical-pos-step">01</span>
                <div>
                  <h2>Cliente</h2>
                  <p>Busca una ficha existente o registra los datos mínimos sin salir de la venta.</p>
                </div>
              </div>
              <OpticalClientIntake clients={clients ?? []} />
            </section>

            <section className="card optical-pos-section" id="receta">
              <div className="optical-pos-section-heading">
                <span className="optical-pos-step">02</span>
                <div>
                  <h2>Receta y medición</h2>
                  <p>Transcribe los datos de la receta original. Los campos vacíos se guardan como no registrados, no como cero.</p>
                </div>
              </div>
              <label className="checkline optical-pos-toggle">
                <input type="checkbox" name="record_prescription" defaultChecked />
                Registrar una receta óptica en esta operación
              </label>
              <div className="form-grid optical-rx-meta">
                <div className="field">
                  <label htmlFor="optical-exam-at">Fecha del examen</label>
                  <input id="optical-exam-at" name="exam_at" type="datetime-local" />
                </div>
                <div className="field">
                  <label htmlFor="optical-rx-type">Tipo / uso *</label>
                  <select id="optical-rx-type" name="rx_type" defaultValue="Monofocal">
                    <option>Monofocal</option>
                    <option>Lejos</option>
                    <option>Cerca</option>
                    <option>Lejos y cerca</option>
                    <option>Bifocal</option>
                    <option>Progresivo</option>
                    <option>Ocupacional</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="optical-cylinder-notation">Formato de cilindro</label>
                  <select id="optical-cylinder-notation" name="cylinder_notation" defaultValue="negative">
                    <option value="negative">Cilindro negativo</option>
                    <option value="positive">Cilindro positivo</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="optical-rx-source">Origen de receta</label>
                  <select id="optical-rx-source" name="rx_source" defaultValue="Medición externa">
                    <option>Medición externa</option>
                    <option>Receta presentada por el cliente</option>
                    <option>Registro histórico</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="optical-rx-expiry">Vencimiento de receta</label>
                  <input id="optical-rx-expiry" name="expires_at" type="date" />
                </div>
                <div className="field">
                  <label htmlFor="optical-prescriber">Profesional / centro</label>
                  <input id="optical-prescriber" name="prescriber_name" maxLength={160} placeholder="Si figura en la receta" />
                </div>
                <div className="field">
                  <label htmlFor="optical-prescriber-license">Registro profesional</label>
                  <input id="optical-prescriber-license" name="prescriber_license" maxLength={80} placeholder="Opcional" />
                </div>
              </div>

              <div className="table-wrap optical-rx-table-wrap">
                <table className="attention-rx-table optical-rx-table">
                  <thead><tr><th>Ojo</th><th>Esfera / SPH</th><th>Cilindro / CYL</th><th>Eje / AXIS</th><th>Adición / ADD</th></tr></thead>
                  <tbody>
                    <tr>
                      <th>OD · Derecho</th>
                      <td><input aria-label="Esfera OD" name="od_sphere" type="number" min="-30" max="30" step="0.25" placeholder="-1.75" /></td>
                      <td><input aria-label="Cilindro OD" name="od_cylinder" type="number" min="-15" max="15" step="0.25" placeholder="-0.50" /></td>
                      <td><input aria-label="Eje OD" name="od_axis" type="number" min="1" max="180" step="1" placeholder="90" /></td>
                      <td><input aria-label="Adición OD" name="od_add" type="number" min="0" max="10" step="0.25" placeholder="+" /></td>
                    </tr>
                    <tr>
                      <th>OI · Izquierdo</th>
                      <td><input aria-label="Esfera OI" name="os_sphere" type="number" min="-30" max="30" step="0.25" placeholder="+1.00" /></td>
                      <td><input aria-label="Cilindro OI" name="os_cylinder" type="number" min="-15" max="15" step="0.25" placeholder="-0.50" /></td>
                      <td><input aria-label="Eje OI" name="os_axis" type="number" min="1" max="180" step="1" placeholder="90" /></td>
                      <td><input aria-label="Adición OI" name="os_add" type="number" min="0" max="10" step="0.25" placeholder="+" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="form-grid optical-rx-bottom">
                <div className="field">
                  <label htmlFor="optical-pd">Distancia pupilar binocular (mm)</label>
                  <input id="optical-pd" name="pd" type="number" min="1" max="100" step="0.5" placeholder="63" />
                </div>
                <div className="field">
                  <label htmlFor="optical-prescription-notes">Observaciones</label>
                  <input id="optical-prescription-notes" name="prescription_notes" maxLength={2000} placeholder="Indicaciones que figuren en la receta" />
                </div>
              </div>
            </section>

            <section className="card optical-pos-section" id="componentes">
              <div className="optical-pos-section-heading">
                <span className="optical-pos-step">03</span>
                <div>
                  <h2>Montura, lunas y tratamientos</h2>
                  <p>El catálogo y el control transaccional de stock se aplican al confirmar la venta.</p>
                </div>
              </div>
              <SaleBuilder
                products={products ?? []}
                showCostField={canOverridePrice}
                allowPriceOverride={canOverridePrice}
                hideSubmit
              />

              <div className="optical-order-panel">
                <label className="checkline optical-pos-toggle">
                  <input type="checkbox" name="create_optical_order" defaultChecked />
                  Crear también el pedido para taller / laboratorio
                </label>
                <p className="field-hint">Para generar un pedido debes registrar una receta y añadir una montura o unas lunas.</p>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="optical-lab">Laboratorio / proveedor</label>
                    <input id="optical-lab" name="lab" maxLength={160} placeholder="Nombre del laboratorio" />
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lab-reference">Referencia del laboratorio</label>
                    <input id="optical-lab-reference" name="lab_reference" maxLength={120} placeholder="Opcional" />
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lens-type">Tipo de luna / diseño</label>
                    <select id="optical-lens-type" name="lens_type" defaultValue="">
                      <option value="">Por definir</option>
                      <option>Monofocal</option>
                      <option>Bifocal</option>
                      <option>Progresivo</option>
                      <option>Ocupacional</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lens-design">Diseño de luna</label>
                    <select id="optical-lens-design" name="lens_design" defaultValue="">
                      <option value="">Por definir</option>
                      <option>Monofocal</option>
                      <option>Bifocal</option>
                      <option>Progresivo</option>
                      <option>Ocupacional</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lens-material">Material</label>
                    <select id="optical-lens-material" name="lens_material" defaultValue="">
                      <option value="">Por definir</option>
                      <option>Resina orgánica</option>
                      <option>Policarbonato</option>
                      <option>Trivex</option>
                      <option>Vidrio mineral</option>
                      <option>Resina de alto índice</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lens-index">Índice</label>
                    <select id="optical-lens-index" name="lens_index" defaultValue="">
                      <option value="">Por definir</option>
                      <option>1.50</option>
                      <option>1.53</option>
                      <option>1.56</option>
                      <option>1.59</option>
                      <option>1.60</option>
                      <option>1.67</option>
                      <option>1.74</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="optical-lens-brand">Marca de luna</label>
                    <input id="optical-lens-brand" name="lens_brand" maxLength={120} placeholder="Opcional" />
                  </div>
                  <div className="field">
                    <label htmlFor="optical-promised-at">Fecha prometida</label>
                    <input id="optical-promised-at" name="promised_at" type="date" />
                  </div>
                </div>
                <fieldset className="optical-treatment-fieldset">
                  <legend>Tratamientos</legend>
                  <div className="optical-treatment-grid">
                    {treatmentOptions.map((treatment) => (
                      <label className="checkline" key={treatment}>
                        <input type="checkbox" name="treatments" value={treatment} />
                        {treatment}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor="optical-order-notes">Notas para taller / laboratorio</label>
                  <textarea id="optical-order-notes" name="order_notes" maxLength={2000} rows={2} placeholder="Detalles que deben acompañar al pedido" />
                </div>
              </div>
            </section>

            <section className="card optical-pos-section" id="cierre">
              <div className="optical-pos-section-heading">
                <span className="optical-pos-step">04</span>
                <div>
                  <h2>Cierre de venta</h2>
                  <p>Registra el adelanto o pago total. El saldo se calcula desde el total real de la transacción.</p>
                </div>
              </div>
              <div className="form-grid optical-payment-grid">
                <div className="field">
                  <label htmlFor="optical-payment-method">Medio de pago</label>
                  <select id="optical-payment-method" name="payment_method" defaultValue="Efectivo">
                    <option>Efectivo</option>
                    <option>Yape</option>
                    <option>Plin</option>
                    <option>Tarjeta</option>
                    <option>Transferencia</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="optical-paid-amount">Pago recibido (S/)</label>
                  <input id="optical-paid-amount" name="paid_amount" type="number" min="0" step="0.01" defaultValue="0" />
                  <span className="field-hint">Deja S/ 0.00 si solo registrarás la venta a cuenta.</span>
                </div>
                <div className="field">
                  <label htmlFor="optical-sale-discount">Descuento global (S/)</label>
                  <input id="optical-sale-discount" name="sale_discount" type="number" min="0" step="0.01" defaultValue="0" />
                </div>
                <div className="field">
                  <label htmlFor="optical-responsible">Responsable</label>
                  <input id="optical-responsible" name="responsible" maxLength={160} defaultValue={user.email ?? ""} />
                </div>
              </div>
              <div className="notice optical-pos-safety-note">
                <strong>Una sola confirmación:</strong> cliente, receta, venta, movimientos de inventario, pago y pedido óptico se guardan dentro de una transacción. Si falla un paso, se revierte toda la operación.
              </div>
              <div className="optical-pos-submit-row">
                <Link href="/ventas" className="btn btn-secondary">Cancelar</Link>
                <button type="submit" className="btn btn-primary optical-pos-submit">Confirmar venta y generar comprobante →</button>
              </div>
            </section>
          </form>
        </div>
      </main>
    </div>
  );
}
