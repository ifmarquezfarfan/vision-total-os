"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string; product_code: string; category: string | null; brand: string | null;
  model: string | null; description: string | null; cost: number; sale_price: number;
  stock_qty: number; inventory_mode?: string;
};
type SaleRow = {
  id:number; productId:string; productText:string; componentType:string; description:string;
  quantity:number; price:string; cost:string; discount:string;
};
const componentOptions=[["frame","Montura"],["lens","Lunas"],["treatment","Tratamiento"],["service","Servicio"],["accessory","Accesorio"],["other","Otro"]] as const;
function emptyRow(id:number):SaleRow{return{id,productId:"",productText:"",componentType:"other",description:"",quantity:1,price:"",cost:"",discount:"0"};}

export function SaleBuilder({products,showCostField,allowPriceOverride}:{products:Product[];showCostField:boolean;allowPriceOverride:boolean}){
  const [rows,setRows]=useState<SaleRow[]>([emptyRow(1)]);
  const productMap=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);
  const codeMap=useMemo(()=>new Map(products.map(p=>[p.product_code.toLowerCase(),p])),[products]);
  const updateRow=(id:number,patch:Partial<SaleRow>)=>setRows(cur=>cur.map(row=>row.id===id?{...row,...patch}:row));
  const selectProduct=(id:number,text:string)=>{
    const product=codeMap.get(text.trim().toLowerCase());
    if(!product){updateRow(id,{productId:"",productText:text});return;}
    const componentType=product.category==="Montura"?"frame":product.category==="Lentes"?"lens":product.category==="Tratamiento"?"treatment":"other";
    updateRow(id,{productId:product.id,productText:product.product_code,description:product.description||[product.brand,product.model].filter(Boolean).join(" "),componentType,price:Number(product.sale_price||0).toFixed(2),cost:Number(product.cost||0).toFixed(2)});
  };
  const applyPreset=(types:string[])=>setRows(types.map((componentType,index)=>({...emptyRow(index+1),componentType,description:componentType==="frame"?"Montura":componentType==="lens"?"Lunas":componentType==="treatment"?"Tratamiento":""})));
  const addRow=()=>setRows(cur=>[...cur,emptyRow(Math.max(...cur.map(r=>r.id),0)+1)]);
  const addBlock=()=>setRows(cur=>{
    const base=Math.max(...cur.map(r=>r.id),0);
    return [...cur,emptyRow(base+1),emptyRow(base+2),emptyRow(base+3)];
  });
  const removeRow=(id:number)=>setRows(cur=>cur.length===1?cur:cur.filter(row=>row.id!==id));
  const total=rows.reduce((sum,row)=>sum+Math.max(Number(row.quantity||0)*Number(row.price||0)-Number(row.discount||0),0),0);

  return <div>
    <div className="notice" style={{marginBottom:14}}>Construye la venta por componentes. El sistema permite tantos componentes como necesite una operación óptica.</div>
    <div className="sale-presets">
      <span className="field-hint" style={{marginTop:0}}>Inicio rápido</span>
      <button type="button" className="btn btn-secondary" onClick={()=>applyPreset(["frame","lens","treatment"])}>Montura + lunas</button>
      <button type="button" className="btn btn-secondary" onClick={()=>applyPreset(["frame"])}>Solo montura</button>
      <button type="button" className="btn btn-secondary" onClick={()=>applyPreset(["lens","treatment"])}>Lunas + tratamiento</button>
      <button type="button" className="btn btn-secondary" onClick={()=>applyPreset(["service"])}>Servicio</button>
      <button type="button" className="btn btn-secondary" onClick={()=>setRows([emptyRow(1)])}>Limpiar</button>
    </div>
    <div className="table-wrap">
      <table style={{minWidth:showCostField?1280:1040}}>
        <thead><tr><th>Producto</th><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Precio</th>{showCostField&&<th>Costo</th>}<th>Desc.</th><th></th></tr></thead>
        <tbody>{rows.map((row,index)=>{
          const selected=row.productId?productMap.get(row.productId):null;
          return <><React.Fragment key={row.id+"group"}>{index%3===0&&<tr><td colSpan={showCostField?8:7} className="sale-block-label">Paquete {Math.floor(index/3)+1} · {index===0?"Primera operación":"Par adicional"}</td></tr>}</React.Fragment><tr key={row.id}>
            <td style={{minWidth:280}}>
              <input list="sale-products" value={row.productText} onChange={e=>selectProduct(row.id,e.target.value)} placeholder="Buscar por código" autoComplete="off"/>
              <input type="hidden" name={`product_${index+1}`} value={row.productId}/>
              <span className="field-hint">{selected?(selected.inventory_mode==="stock"?`Stock ${selected.stock_qty}`:selected.inventory_mode==="on_demand"?"Bajo demanda":"Servicio")+" · S/ "+Number(selected.sale_price).toFixed(2):"Personalizado, sin movimiento de stock"}</span>
            </td>
            <td><select name={`component_${index+1}`} value={row.componentType} onChange={e=>updateRow(row.id,{componentType:e.target.value})}>{componentOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td>
            <td><input name={`description_${index+1}`} value={row.description} onChange={e=>updateRow(row.id,{description:e.target.value})} placeholder={row.componentType==="lens"?"Ej. Monofocal 1.56 antirreflejo":"Descripción"}/></td>
            <td><input name={`quantity_${index+1}`} type="number" min="1" step="1" value={row.quantity} onChange={e=>updateRow(row.id,{quantity:Math.max(1,Number(e.target.value||1))})}/></td>
            <td><input name={`price_${index+1}`} type="number" min="0" step="0.01" value={row.price} readOnly={Boolean(selected)&&!allowPriceOverride} onChange={e=>updateRow(row.id,{price:e.target.value})}/>{selected&&!allowPriceOverride&&<span className="field-hint">Precio de catálogo</span>}</td>
            {showCostField&&<td><input name={`cost_${index+1}`} type="number" min="0" step="0.01" value={row.cost} readOnly={Boolean(selected)} onChange={e=>updateRow(row.id,{cost:e.target.value})}/></td>}
            <td><input name={`discount_${index+1}`} type="number" min="0" step="0.01" value={row.discount} onChange={e=>updateRow(row.id,{discount:e.target.value})}/></td>
            <td><button type="button" className="btn btn-secondary" onClick={()=>removeRow(row.id)}>Quitar</button></td>
          </tr></> 
        })}</tbody>
      </table>
    </div>
    <datalist id="sale-products">{products.map(p=><option key={p.id} value={p.product_code}>{[p.brand,p.model,p.description].filter(Boolean).join(" ")} · S/ {Number(p.sale_price).toFixed(2)} · stock {p.inventory_mode==="stock"?p.stock_qty:"no aplica"}</option>)}</datalist>
    <input type="hidden" name="item_count" value={rows.length}/>
    <div className="sale-summary" style={{marginTop:14}}><div><strong>{rows.length}</strong> {rows.length===1?"línea":"líneas"} de venta</div><div><span className="muted">Subtotal</span><strong>S/ {total.toFixed(2)}</strong></div></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
      <button type="button" className="btn btn-secondary" onClick={addBlock}>+ Agregar 3 líneas</button>
      <button type="button" className="btn btn-secondary" onClick={addRow}>+ Agregar 1 línea</button>
      <button type="submit" className="btn btn-primary">Registrar venta</button>
    </div>
  </div>;
}