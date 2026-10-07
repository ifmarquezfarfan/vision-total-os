import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="logo-mark">VT</div>
        <h1 className="page-title">Visión Total OS</h1>
        <p className="subtitle">El centro operativo de Óptica Visión Total.</p>

        {params.error && <p className="notice" style={{ marginTop: 18 }}>{params.error}</p>}
        {params.message && <p className="notice" style={{ marginTop: 18 }}>{params.message}</p>}

        <form action={signIn} className="form" style={{ marginTop: 24 }}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" type="submit">Entrar</button>
        </form>

        <form action={signUp} style={{ marginTop: 10 }}>
          <input type="hidden" name="email" value="" />
          <input type="hidden" name="password" value="" />
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Para crear la primera cuenta, usa el mismo formulario con tus credenciales desde Supabase Auth o habilitamos un registro dedicado en el siguiente paso.
          </p>
        </form>
      </section>
    </main>
  );
}