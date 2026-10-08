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
  inventory_mode?: string;
};

type SaleRow = {
  id: number;
  productId: string;
  productText: string;
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
  return { id, productId: "", productText: "", componentType: "other", description: "", quantity: 1, price: "", cost: "", discount: "0" };
}

export function SaleBuilder({
  products,
  showCostField,
  allowPriceOverride,
}: {
  products: Product[];
  showCostField: boolean;
  allowPriceOverride: boolean;
}) {
  const [rows, setRows] = useState<SaleRow[]>([emptyRow(1)]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const codeMap = useMemo(() => new Map(products.map((p) => [p.product_code.toLowerCase(), p])), [products]);

  const updateRow = (id: number, patch: Partial<SaleRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const selectProduct = (id: number, text: string) => {
    const product = codeMap.get(text.trim().toLowerCase());
    if (!product) {
      updateRow(id, { productId: "", productText: text });
      return;
    }

    const componentType =
      product.category === "Montura" ? "frame" :
      product.category === "Lentes" ? "lens" :
      product.category === "Tratamiento" ? "treatment" : "other";

    updateRow(id, {
      productId: product.id,
      productText: product.product_code,
      description: product.description || [product.brand, product.model].filter(Boolean).join(" "),
      componentType,
      price: Number(product.sale_price || 0).toFixed(2),
      cost: Number(product.cost || 0).toFixed(2),
    });
  };

  const applyPreset = (types: string[]) => {
    setRows(types.map((componentType, index) => ({
      ...emptyRow(index + 1),
      componentType,
      description: componentType === "frame" ? "Montura" : componentType === "lens" ? "Lunas" : componentType === "treatment" ? "Tratamiento" : "",
    })));
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    for (const row of rows) {
      const product = row.productId ? productMap.get(row.productId) : null;
      if (product && row.quantity > product.stock_qty) {
        event.preventDefault();
        window.alert(`Stock insuficiente para ${product.product_code}. Disponible: ${product.stock_qty}.`);
        return;
      }
    }
  };

  return (
    <div>
      <div className="notice" style={{ marginBottom: 14 }}>
        Construye la venta por componentes. Puedes agregar todos los productos, servicios o trabajos necesarios para un mismo cliente.
      </div>

      <div className="table-wrap">
        <table style={{ minWidth: showCostField ? 1280 : 1040 }}>
          <thead>
            <tr><th>Producto</th><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Precio</th>{showCostField && <th>Costo</th>}<th>Desc.</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const selected = row.productId ? productMap.get(row.productId) : null;
              return (
                <tr key={row.id}>
                  <td style={{ minWidth: 270 }}>
                    <input
                      list="sale-products"
                      value={row.productText}
                      onChange={(e) => selectProduct(row.id, e.target.value)}
                      placeholder="Buscar por código"
                      autoComplete="off"
                    />
                    <input type="hidden" name={`product_${index + 1}`} value={row.productId} />
                    {selected ? <span className="field-hint">{selected.inventory_mode === "stock" ? `Stock ${selected.stock_qty}` : selected.inventory_mode === "on_demand" ? "Bajo demanda" : "Servicio"} · S/ {Number(selected.sale_price).toFixed(2)}</span> : <span className="field-hint">Personalizado, sin movimiento de stock</span>}
                  </td>
                  <td>
                    <select name={`component_${index + 1}`} value={row.componentType} onChange={(e) => updateRow(row.id,{componentType:e.target.value})}>
                      {componentOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    <input name={`description_${index + 1}`} value={row.description} onChange={(e) => updateRow(row.id,{description:e.target.value})} placeholder={row.componentType === "lens" ? "Ej. Monofocal 1.56 antirreflejo" : "Descripción"} />
                  </td>
                  <td><input name={`quantity_${index + 1}`} type="number" min="1" step="1" value={row.quantity} onChange={(e)=>updateRow(row.id,{quantity:Math.max(1,Number(e.target.value||1))})}/></td>
                  <td>
                    <input
                      name={`price_${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      readOnly={Boolean(selected) && !allowPriceOverride}
                      onChange={(e)=>updateRow(row.id,{price:e.target.value})}
                    />
                    {selected && !allowPriceOverride && <span className="field-hint">Precio de catálogo</span>}
                  </td>
                  {showCostField && <td><input name={`cost_${index + 1}`} type="number" min="0" step="0.01" value={row.cost} readOnly={Boolean(selected)} onChange={(e)=>updateRow(row.id,{cost:e.target.value})}/></td>}
                  <td><input name={`discount_${index + 1}`} type="number" min="0" step="0.01" value={row.discount} onChange={(e)=>updateRow(row.id,{discount:e.target.value})}/></td>
                  <td><button type="button" className="btn btn-secondary" onClick={()=>removeRow(row.id)}>Quitar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <datalist id="sale-products">
        {products.map((product) => (
          <option key={product.id} value={product.product_code}>{[product.brand, product.model, product.description].filter(Boolean).join(" ")} · S/ {Number(product.sale_price).toFixed(2)} · stock {product.stock_qty}</option>
        ))}
      </datalist>

      <input type="hidden" name="item_count" value={rows.length} />

      <div className="sale-summary" style={{marginTop:14}}>
        <div><strong>{rows.length}</strong> {rows.length===1 ? "línea" : "líneas"} de venta</div>
        <div><span className="muted">Subtotal de componentes</span><strong>S/ {total.toFixed(2)}</strong></div>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
        <button type="button" className="btn btn-secondary" onClick={addRow}>+ Agregar otra línea</button>
        <button type="submit" className="btn btn-primary">Registrar venta</button>
      </div>
    </div>
  );
}
