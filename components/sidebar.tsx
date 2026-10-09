import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;

  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    isAdmin = membership?.role === "owner" || membership?.role === "admin";
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>VISIÓN TOTAL</strong>
        <span>OS / Control Center</span>
      </div>

      <nav className="nav">
        <div className="nav-group nav-help">
          <span>Ayuda</span>
          <Link href="/guia">Guía y capacitación</Link>
        </div>
        <div className="nav-group">
          <span>Operación</span>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/atencion">Atención óptica</Link>
          <Link href="/clientes">Clientes</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/cotizaciones">Cotizaciones</Link>
          <Link href="/seguimientos">Seguimientos</Link>
          <Link href="/ventas">Ventas</Link>
          <Link href="/pedidos">Pedidos ópticos</Link>
          <Link href="/buscador-lunas">Buscador de lunas</Link>
        </div>

        {isAdmin && (
          <div className="nav-group">
            <span>Gestión</span>
            <Link href="/inventario">Inventario</Link>
            <Link href="/compras">Compras</Link>
            <Link href="/finanzas">Finanzas</Link>
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <span>Sistema</span>
            <Link href="/equipo">Equipo</Link>
            <Link href="/auditoria">Auditoría</Link>
          </div>
        )}
      </nav>

      <form action={signOut} className="sidebar-footer">
        <button className="btn btn-secondary" style={{width:"100%"}}>Cerrar sesión</button>
      </form>
    </aside>
  );
}
