"use client";

import { useMemo, useState } from "react";

type Client = {
  id: string;
  full_name: string;
  dni: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export function OpticalClientIntake({ clients }: { clients: Client[] }) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [query, setQuery] = useState("");

  const options = useMemo(
    () => clients.map((client) => {
      const details = [
        client.dni ? "DNI " + client.dni : "",
        client.whatsapp || client.phone ? "Tel. " + (client.whatsapp || client.phone) : "",
      ].filter(Boolean);
      return {
        client,
        label: client.full_name + (details.length ? " · " + details.join(" · ") : ""),
      };
    }),
    [clients]
  );

  const selectedId = options.find((option) => option.label === query)?.client.id ?? "";

  return (
    <div className="optical-client-intake">
      <div className="optical-client-mode" role="group" aria-label="Tipo de cliente">
        <button
          type="button"
          className={mode === "search" ? "btn btn-primary" : "btn btn-secondary"}
          aria-pressed={mode === "search"}
          onClick={() => setMode("search")}
        >
          Buscar cliente
        </button>
        <button
          type="button"
          className={mode === "new" ? "btn btn-primary" : "btn btn-secondary"}
          aria-pressed={mode === "new"}
          onClick={() => setMode("new")}
        >
          + Registro rápido
        </button>
      </div>

      {mode === "search" ? (
        <div className="field">
          <label htmlFor="optical-existing-client">Cliente registrado</label>
          <input
            id="optical-existing-client"
            list="optical-client-options"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre, DNI o teléfono"
            autoComplete="off"
            required
          />
          <input type="hidden" name="client_id" value={selectedId} />
          <datalist id="optical-client-options">
            {options.map((option) => (
              <option key={option.client.id} value={option.label} />
            ))}
          </datalist>
          <span className="field-hint">
            {selectedId
              ? "Ficha seleccionada. No se sobrescribirán los datos existentes."
              : "Elige una opción de la lista para evitar asociar una venta a la persona equivocada."}
          </span>
        </div>
      ) : (
        <>
          <input type="hidden" name="client_id" value="" />
          <div className="form-grid">
            <div className="field optical-client-name">
              <label htmlFor="optical-client-name">Nombre completo *</label>
              <input id="optical-client-name" name="client_name" maxLength={160} required placeholder="Nombres y apellidos" />
            </div>
            <div className="field">
              <label htmlFor="optical-client-dni">DNI (8 dígitos)</label>
              <input
                id="optical-client-dni"
                name="client_dni"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                pattern="[0-9]{8}"
                title="Ingresa los 8 dígitos del DNI, sin espacios."
                placeholder="12345678"
              />
            </div>
            <div className="field">
              <label htmlFor="optical-client-phone">Teléfono *</label>
              <input
                id="optical-client-phone"
                name="client_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                pattern="[+0-9 ()-]{7,20}"
                title="Ingresa un teléfono válido con al menos 7 dígitos."
                required
                placeholder="999 999 999"
              />
            </div>
            <div className="field">
              <label htmlFor="optical-client-whatsapp">WhatsApp</label>
              <input
                id="optical-client-whatsapp"
                name="client_whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={20}
                pattern="[+0-9 ()-]{7,20}"
                title="Ingresa un teléfono válido con al menos 7 dígitos."
                placeholder="Opcional, si es distinto"
              />
            </div>
            <div className="field">
              <label htmlFor="optical-client-email">Correo</label>
              <input id="optical-client-email" name="client_email" type="email" maxLength={200} placeholder="Opcional" />
            </div>
          </div>
          <label className="checkline optical-marketing-consent">
            <input type="checkbox" name="marketing_opt_in" />
            El cliente acepta recibir promociones y comunicaciones comerciales por WhatsApp.
          </label>
          <p className="field-hint">La autorización comercial es opcional y queda desmarcada por defecto.</p>
        </>
      )}
    </div>
  );
}
