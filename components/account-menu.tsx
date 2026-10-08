import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

function initials(name: string | null, email: string | undefined) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0,2)).toUpperCase();
}

export async function AccountMenu() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("organization_members").select("role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
  ]);

  const role = membership?.role === "owner"
    ? "Dueña"
    : membership?.role === "admin"
    ? "Administrador"
    : "Empleado / Vendedora";

  return (
    <details className="account-menu">
      <summary className="account-trigger" aria-label="Abrir cuenta">
        <span className="account-avatar">{initials(profile?.full_name || null, user.email)}</span>
      </summary>
      <div className="account-popover">
        <div className="account-head">
          <span className="account-avatar account-avatar-lg">{initials(profile?.full_name || null, user.email)}</span>
          <div>
            <strong>{profile?.full_name || "Usuario"}</strong>
            <span>{role}</span>
          </div>
        </div>
        <div className="account-email">{user.email}</div>
        <div className="account-links">
          <Link href="/perfil">Mi perfil</Link>
          <Link href="/equipo">Equipo</Link>
        </div>
        <form action={signOut}>
          <button className="account-signout">Cerrar sesión</button>
        </form>
      </div>
    </details>
  );
}
