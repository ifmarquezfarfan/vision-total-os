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
            <label htmlFor="login-email">Correo</label>
            <input id="login-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <input id="login-password" name="password" type="password" required minLength={6} autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" type="submit">Entrar</button>
        </form>

        <div style={{ borderTop: "1px solid var(--line)", margin: "26px 0 20px" }} />

        <h2 style={{ margin: 0, fontSize: 17 }}>Primera vez aquí</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Crea la cuenta administradora inicial de Visión Total OS.
        </p>

        <form action={signUp} className="form" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="signup-email">Correo</label>
            <input id="signup-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="signup-password">Contraseña</label>
            <input id="signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <button className="btn btn-secondary" type="submit">Crear cuenta</button>
        </form>
      </section>
    </main>
  );
}