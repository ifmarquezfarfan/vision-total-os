"use client";

import { Fragment, useMemo, useState } from "react";

type Product={id:string;product_code:string;category:string|null;brand:string|null;model:string|null;description:string|null;cost:number;sale_price:number};
type Row={id:number;productId:string;productText:string;componentType:string;description:string;quantity:number;price:string;cost:string;discount:string};

const options=[["frame","Montura"],["lens","Lunas"],["treatment","Tratamiento"],["service","Servicio"],["accessory","Accesorio"],["other","Otro"]] as const;
function emptyRow(id:number):Row{return{id,productId:"",productText:"",componentType:"other",description:"",quantity:1,price:"",cost:"",discount:"0"};}

export function QuoteBuilder({products}:{products:Product[]}) {
  const [rows,setRows]=useState<Row[]>([emptyRow(1)]);
  const map=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);
  const codeMap=useMemo(()=>new Map(products.map(p=>[p.product_code.toLowerCase(),p])),[products]);

  const update=(id:number,patch:Partial<Row>)=>setRows(cur=>cur.map(r=>r.id===id?{...r,...patch}:r));
  const selectProduct=(id:number,text:string)=>{
    const p=codeMap.get(text.trim().toLowerCase());
    if(!p){update(id,{productId:"",productText:text});return;}
    const componentType=p.category?.toLowerCase().includes("montura")?"frame":p.category?.toLowerCase().includes("lente")?"lens":"other";
    update(id,{productId:p.id,productText:p.product_code,componentType,description:p.description||[p.brand,p.model].filter(Boolean).join(" "),price:Number(p.sale_price||0).toFixed(2),cost:Number(p.cost||0).toFixed(2)});
  };
  const replacePreset=(types:string[])=>setRows(types.map((componentType,i)=>({...emptyRow(i+1),componentType,description:componentType==="frame"?"Montura":componentType==="lens"?"Lunas":componentType==="treatment"?"Tratamiento":""})));
  const addBlock=()=>setRows(cur=>{
    const base=Math.max(...cur.map(r=>r.id),0);
    return [...cur,emptyRow(base+1),emptyRow(base+2),emptyRow(base+3)];
  });
  const addRow=()=>setRows(cur=>[...cur,emptyRow(Math.max(...cur.map(r=>r.id),0)+1)]);
  const total=rows.reduce((s,r)=>s+Math.max(Number(r.quantity||0)*Number(r.price||0)-Number(r.discount||0),0),0);

  return <div>
    <div className="quote-suggestions">
      <div><div className="eyebrow">Sugerencias para cotizar</div><strong>Parte de una estructura óptica común y ajusta solo lo necesario.</strong><p className="muted">Las plantillas vienen de la misma lógica de Inicio rápido de Ventas.</p></div>
      <div className="chip-row">
        <button type="button" className="chip-button" onClick={()=>replacePreset(["frame","lens","treatment"])}><span>Montura + lunas + AR</span><small>3 líneas</small></button>
        <button type="button" className="chip-button" onClick={()=>replacePreset(["frame","lens"])}><span>Montura + lunas</span><small>2 líneas</small></button>
        <button type="button" className="chip-button" onClick={()=>replacePreset(["lens","treatment"])}><span>Lunas + tratamiento</span><small>2 líneas</small></button>
        <button type="button" className="chip-button" onClick={addBlock}><span>+ Otro bloque</span><small>3 líneas más</small></button>
      </div>
    </div>
    <div className="table-wrap"><table style={{minWidth:1120}}><thead><tr><th>Producto</th><th>Componente</th><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Costo</th><th>Desc.</th><th></th></tr></thead><tbody>
      {rows.map((row,index)=>{
        const selected=row.productId?map.get(row.productId):null;
        return <Fragment key={row.id}>{index%3===0&&<tr><td colSpan={8} className="sale-block-label">Paquete {Math.floor(index/3)+1} · {index===0?"Primera operación":"Par adicional"}</td></tr>}<tr>
          <td style={{minWidth:280}}><input list="quote-products" value={row.productText} onChange={e=>selectProduct(row.id,e.target.value)} placeholder="Código de producto" autoComplete="off"/><input type="hidden" name={`product_${index+1}`} value={row.productId}/><span className="field-hint">{selected?[selected.brand,selected.model].filter(Boolean).join(" ")||selected.description||"Producto seleccionado":"Personalizado"}</span></td>
          <td><select name={`component_${index+1}`} value={row.componentType} onChange={e=>update(row.id,{componentType:e.target.value})}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
          <td><input name={`description_${index+1}`} value={row.description} onChange={e=>update(row.id,{description:e.target.value})} placeholder="Descripción"/></td>
          <td><input name={`quantity_${index+1}`} type="number" min="1" step="1" value={row.quantity} onChange={e=>update(row.id,{quantity:Math.max(1,Number(e.target.value||1))})}/></td>
          <td><input name={`price_${index+1}`} type="number" min="0" step="0.01" value={row.price} onChange={e=>update(row.id,{price:e.target.value})}/></td>
          <td><input name={`cost_${index+1}`} type="number" min="0" step="0.01" value={row.cost} onChange={e=>update(row.id,{cost:e.target.value})}/></td>
          <td><input name={`discount_${index+1}`} type="number" min="0" step="0.01" value={row.discount} onChange={e=>update(row.id,{discount:e.target.value})}/></td>
          <td><button type="button" className="btn btn-secondary" onClick={()=>setRows(cur=>cur.length===1?cur.filter(()=>true):cur.filter(r=>r.id!==row.id))}>Quitar</button></td>
        </tr>
      })}
    </tbody></table></div>
    <datalist id="quote-products">{products.map(p=><option key={p.id} value={p.product_code}>{[p.brand,p.model,p.description].filter(Boolean).join(" ")} · S/ {Number(p.sale_price).toFixed(2)}</option>)}</datalist>
    <input type="hidden" name="item_count" value={rows.length}/>
    <div className="sale-summary" style={{marginTop:14}}><div><strong>{rows.length}</strong> {rows.length===1?"línea":"líneas"}</div><div><span className="muted">Subtotal estimado</span><strong>S/ {total.toFixed(2)}</strong></div></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
      <button type="button" className="btn btn-secondary" onClick={addBlock}>+ Agregar 3 líneas</button>
      <button type="button" className="btn btn-secondary" onClick={addRow}>+ Agregar 1 línea</button>
      <button type="submit" className="btn btn-primary">Crear cotización</button>
    </div>
  </div>;
}
