import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>VISIÓN TOTAL</strong>
        <span>OS / Control Center</span>
      </div>

      <nav className="nav">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/clientes">Clientes</Link>
        <Link href="/leads">Leads</Link>
        <Link href="/seguimientos">Seguimientos</Link>
        <Link href="/ventas">Ventas</Link>
        <Link href="/inventario">Inventario</Link>
        <Link href="/compras">Compras</Link>
        <Link href="/pedidos">Pedidos ópticos</Link>
        <Link href="/finanzas">Finanzas</Link>
      </nav>

      <form action={signOut} style={{marginTop:"auto"}}>
        <button className="btn btn-secondary" style={{width:"100%"}}>Cerrar sesión</button>
      </form>
    </aside>
  );
}
