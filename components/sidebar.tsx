import { ActiveNavLink } from "@/components/active-nav-link";
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
          <ActiveNavLink href="/guia">Guía y capacitación</ActiveNavLink>
        </div>
        <div className="nav-group">
          <span>Operación</span>
          <ActiveNavLink href="/atencion">Atención al cliente</ActiveNavLink>
          <ActiveNavLink href="/dashboard">Dashboard</ActiveNavLink>
          <ActiveNavLink href="/clientes">Clientes</ActiveNavLink>
          <ActiveNavLink href="/leads">Leads</ActiveNavLink>
          <ActiveNavLink href="/cotizaciones">Cotizaciones</ActiveNavLink>
          <ActiveNavLink href="/seguimientos">Seguimientos</ActiveNavLink>
          <ActiveNavLink href="/ventas">Ventas</ActiveNavLink>
          <ActiveNavLink href="/pedidos">Pedidos ópticos</ActiveNavLink>
          <ActiveNavLink href="/buscador-lunas">Buscador de lunas</ActiveNavLink>
        </div>

        {isAdmin && (
          <div className="nav-group">
            <span>Gestión</span>
            <ActiveNavLink href="/inventario">Inventario</ActiveNavLink>
            <ActiveNavLink href="/compras">Compras</ActiveNavLink>
            <ActiveNavLink href="/finanzas">Finanzas</ActiveNavLink>
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <span>Sistema</span>
            <ActiveNavLink href="/equipo">Equipo</ActiveNavLink>
            <ActiveNavLink href="/auditoria">Auditoría</ActiveNavLink>
          </div>
        )}
      </nav>

      <form action={signOut} className="sidebar-footer">
        <button className="btn btn-secondary" style={{width:"100%"}}>Cerrar sesión</button>
      </form>
    </aside>
  );
}
