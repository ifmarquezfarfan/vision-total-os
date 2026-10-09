"use client";

import { useState } from "react";

export function ShareQuoteActions({shareUrl, whatsappUrl}:{shareUrl:string;whatsappUrl:string}) {
  const [copied,setCopied]=useState(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <div className="share-quote-actions">
    <input aria-label="Enlace público de cotización" readOnly value={shareUrl} onFocus={(event)=>event.currentTarget.select()} />
    <button type="button" className="btn btn-secondary" onClick={copyLink}>{copied?"Enlace copiado ✓":"Copiar enlace"}</button>
    <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar por WhatsApp ↗</a>
  </div>;
}
