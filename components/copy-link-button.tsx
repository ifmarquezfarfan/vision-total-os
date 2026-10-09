"use client";

import { useState } from "react";

export function CopyLinkButton({ path, label = "Copiar enlace" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  const copy = async () => {
    const url = window.location.origin + path;
    setFallback("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setFallback(url);
    }
  };
  return <span className="copy-link-control">
    <button type="button" className="btn btn-secondary copy-link-button" onClick={copy}>{copied ? "✓ Enlace copiado" : label}</button>
    {fallback && <input className="copy-link-fallback" aria-label="Enlace para copiar manualmente" readOnly value={fallback} onFocus={(event)=>event.currentTarget.select()} />}
  </span>;
}
