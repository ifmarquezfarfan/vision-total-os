"use client";

import { useEffect, useMemo, useState } from "react";

type Client = { id: string; full_name: string; dni: string | null };

export function ClientPicker({ clients }: { clients: Client[] }) {
  const options = useMemo(
    () => clients.map((client) => ({
      value: client.full_name + (client.dni ? " · " + client.dni : ""),
      client,
    })),
    [clients]
  );
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const match = options.find((option) => option.value === text);
    setSelectedId(match?.client.id ?? "");
  }, [options, text]);

  const selected = options.find((option) => option.client.id === selectedId)?.client;

  return (
    <div>
      <input
        list="client-options"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Buscar por nombre o DNI"
        autoComplete="off"
      />
      <input type="hidden" name="client_id" value={selectedId} />
      <datalist id="client-options">
        {options.map((option) => (
          <option key={option.client.id} value={option.value} />
        ))}
      </datalist>
      <span className="field-hint">
        {selected
          ? "Cliente seleccionado" + (selected.dni ? " · DNI " + selected.dni : "")
          : "Escribe para buscar. Sin selección se registra como mostrador."}
      </span>
    </div>
  );
}
