"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  product_code: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  cost: number;
  sale_price: number;
  stock_qty: number;
};

type SaleRow = {
  id: number;
  productId: string;
  componentType: string;
  description: string;
  quantity: number;
  price: string;
  cost: string;
  discount: string;
};

const componentOptions = [
  ["frame", "Montura"],
  ["lens", "Lunas"],
  ["treatment", "Tratamiento"],
  ["service", "Servicio"],
  ["accessory", "Accesorio"],
  ["other", "Otro"],
] as const;

function emptyRow(id: number): SaleRow {
  return {
    id,
    productId: "",
    componentType: "other",
    description: "",
    quantity: 1,
    price: "",
    cost: "",
    discount: "0",
  };
}

export function SaleBuilder({
  products,
  showCostField,
}: {
  products: Product[];
  showCostField: boolean;
}) {
  const [rows, setRows] = useState<SaleRow[]>([emptyRow(1)]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const updateRow = (id: number, patch: Partial<SaleRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const selectProduct = (id: number, productId: string) => {
    const product = productMap.get(productId);
    updateRow(id, {
      productId,
      description: product?.description || [product?.brand, product?.model].filter(Boolean).join(" "),
      componentType: product?.category === "Montura"
        ? "frame"
        : product?.category === "Lentes"
        ? "lens"
        : product?.category === "Tratamiento"
        ? "treatment"
        : "other",
      price: product ? Number(product.sale_price || 0).toFixed(2) : "",
      cost: product ? Number(product.cost || 0).toFixed(2) : "",
    });
  };

  const addRow = () => {
    setRows((current) => [...current, emptyRow(Math.max(...current.map((r) => r.id), 0) + 1)]);
  };

  const removeRow = (id: number) => {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));
  };

  const total = rows.reduce((sum, row) => {
    const qty = Number(row.quantity || 0);
    const price = Number(row.price || 0);
    const discount = Number(row.discount || 0);
    return sum + Math.max(qty * price - discount, 0);
  }, 0);

  return (
    <div>
      <div className="notice" style={{ marginBottom: 14 }}>
        Agrega tantos componentes como necesites. Una venta puede tener montura, lunas, tratamientos, accesorios y servicios sin límite práctico de 5 líneas.
      </div>

      <div className="table-wrap">
        <table style={{ minWidth: showCostField ? 1280 : 1120 }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>Precio</th>
              {showCostField && <th>Costo interno</th>}
              <th>Desc.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const selected = row.productId ? productMap.get(row.productId) : null;
              return (
                <tr key={row.id}>
                  <td>
                    <select
                      name={`product_${index + 1}`}
                      value={row.productId}
                      onChange={(e) => selectProduct(row.id, e.target.value)}
                    >
                      <option value="">Componente personalizado</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.product_code} · {[product.brand, product.model].filter(Boolean).join(" ")}
                          {selected?.id === product.id ? "" : ` · S/ ${Number(product.sale_price).toFixed(2)} · stock ${product.stock_qty}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      name={`component_${index + 1}`}
                      value={row.componentType}
                      onChange={(e) => updateRow(row.id, { componentType: e.target.value })}
                    >
                      {componentOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      name={`description_${index + 1}`}
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      placeholder={row.componentType === "lens" ? "Ej. Monofocal 1.56 antirreflejo" : "Descripción"}
                    />
                  </td>
                  <td>
                    <input
                      name={`quantity_${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                  </td>
                  <td>
                    <input
                      name={`price_${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateRow(row.id, { price: e.target.value })}
                      placeholder="0 = precio del producto"
                    />
                  </td>
                  {showCostField && (
                    <td>
                      <input
                        name={`cost_${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cost}
                        onChange={(e) => updateRow(row.id, { cost: e.target.value })}
                        placeholder="Solo personalizados"
                      />
                    </td>
                  )}
                  <td>
                    <input
                      name={`discount_${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.discount}
                      onChange={(e) => updateRow(row.id, { discount: e.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary" onClick={() => removeRow(row.id)} aria-label={`Quitar línea ${row.id}`}>
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.map((row, index) => (
        <input key={row.id} type="hidden" name="item_count" value={rows.length} />
      ))}

      <div className="spread" style={{ marginTop: 14, alignItems: "center" }}>
        <div className="muted">
          {rows.length} {rows.length === 1 ? "línea" : "líneas"} · Total estimado antes del descuento global
        </div>
        <strong style={{ fontSize: 20 }}>S/ {total.toFixed(2)}</strong>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button type="button" className="btn btn-secondary" onClick={addRow}>
          + Agregar otra línea
        </button>
        <button type="submit" className="btn btn-primary">
          Registrar venta
        </button>
      </div>
    </div>
  );
}
