import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function SignIn({ session, heading, blurb }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) {
    return (
      <section className="panel" style={{ marginTop: 26 }}>
        <p className="eyebrow">Signed in as {session.user.email}</p>
        <h2 className="h2">You're in</h2>
        <div className="btns">
          <Link className="btn flag" to="/camp">Go to my camp</Link>
          <Link className="btn ghost" to="/">View the board</Link>
        </div>
      </section>
    );
  }

  async function send() {
    setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter an email address that works.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/camp` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <section className="panel" style={{ marginTop: 26 }}>
      <p className="eyebrow">No password to forget in camp</p>
      <h2 className="h2">{heading || "Sign in"}</h2>
      <p className="p">
        {blurb || "Enter your email and we'll send a sign-in link. No password to remember, no app to install."}
      </p>

      {sent ? (
        <>
          <p className="ok">Link sent to {email}. Open it on this device to finish signing in.</p>
          <p className="hint" style={{ marginTop: 10 }}>
            Nothing after a minute? Check spam, or send it again.
          </p>
          <div className="btns">
            <button className="btn ghost" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        </>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 380 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="you@example.com"
            />
          </div>
          {err && <p className="err">{err}</p>}
          <div className="btns">
            <button className="btn flag" onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Send sign-in link"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
