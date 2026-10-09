"use client";

import { useMemo, useState } from "react";

type Client = { id: string; full_name: string; dni: string | null; phone?: string | null; whatsapp?: string | null };

export function ClientIntakePicker({ clients }: { clients: Client[] }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const options = useMemo(() => clients.map((client) => ({
    client,
    value: client.full_name + (client.dni ? " · " + client.dni : ""),
  })), [clients]);
  const selected = options.find((option) => option.value === search)?.client;

  return (
    <div className="client-intake">
      <div className="client-intake-switch" role="group" aria-label="Tipo de cliente">
        <button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>Cliente registrado</button>
        <button type="button" className={mode === "new" ? "active" : ""} onClick={() => { setMode("new"); setSearch(""); }}>Nuevo cliente</button>
      </div>
      {mode === "existing" ? (
        <div className="form">
          <div className="field">
            <label htmlFor="client-intake-search">Buscar por nombre o DNI *</label>
            <input id="client-intake-search" list="client-intake-options" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe nombre completo o DNI" autoComplete="off" />
            <input type="hidden" name="client_id" value={selected?.id ?? ""} />
            <datalist id="client-intake-options">{options.map((option) => <option key={option.client.id} value={option.value} />)}</datalist>
            <span className="field-hint">{selected ? "Ficha seleccionada. " + (selected.whatsapp || selected.phone || "Agrega WhatsApp si el cliente desea seguimiento.") : "Selecciona un resultado de la lista; no basta con escribir el nombre."}</span>
          </div>
        </div>
      ) : (
        <div className="form">
          <input type="hidden" name="client_id" value="" />
          <div className="form-grid">
            <div className="field"><label htmlFor="new-client-name">Nombre completo *</label><input id="new-client-name" name="new_client_full_name" required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nombre y apellidos" /></div>
            <div className="field"><label>DNI / documento</label><input name="new_client_dni" inputMode="numeric" placeholder="Si corresponde" /></div>
            <div className="field"><label>Teléfono</label><input name="new_client_phone" inputMode="tel" placeholder="Número de contacto" /></div>
            <div className="field"><label>WhatsApp</label><input name="new_client_whatsapp" inputMode="tel" placeholder="Para enviar cotización o coordinar" /></div>
            <div className="field"><label>Correo</label><input name="new_client_email" type="email" placeholder="Opcional" /></div>
            <div className="field"><label>Origen de atención</label><select name="new_client_source" defaultValue="Presencial"><option>Presencial</option><option>WhatsApp</option><option>Instagram</option><option>Web</option><option>Referido</option><option>Otro</option></select></div>
          </div>
          <label className="checkline"><input type="checkbox" name="new_client_marketing_opt_in" /> Acepta recibir promociones y comunicaciones comerciales</label>
          <p className="field-hint">La ficha se crea ahora, junto con la cotización inicial. No tendrás que esperar hasta el pago para guardar sus datos.</p>
        </div>
      )}
    </div>
  );
}
