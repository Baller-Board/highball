import React from "react";

// Shown when the Supabase environment variables are missing, so a fresh
// clone explains itself instead of failing with a blank screen.
export default function Setup() {
  return (
    <>
      <header className="mast">
        <div className="mast-in">
          <span className="logo">High<em>ball</em></span>
          <p className="sub">Setup needed</p>
        </div>
      </header>
      <main className="wrap">
        <section className="panel" style={{ marginTop: 26 }}>
          <p className="eyebrow">Two keys missing</p>
          <h2 className="h2">Connect a database</h2>
          <p className="p">
            The app can't reach Supabase yet. Create a project at supabase.com, run
            <code> supabase/migrations/0001_init.sql</code> in the SQL editor, then add both keys.
          </p>
          <div className="formula">
            VITE_SUPABASE_URL=https://yourproject.supabase.co<br />
            VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Locally these go in <code>.env.local</code>. On Netlify they go in Site configuration →
            Environment Variables, then redeploy. Full steps are in README.md.
          </p>
        </section>
      </main>
    </>
  );
}
