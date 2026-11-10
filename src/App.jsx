import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";
import { supabase, configured } from "./lib/supabase";
import { fetchMine } from "./lib/api";
import { SEASON } from "./lib/gnar";

import Board from "./components/Board";
import Sheet from "./components/Sheet";
import Camp from "./components/Camp";
import Scoring from "./components/Scoring";
import SignIn from "./components/SignIn";
import Setup from "./components/Setup";

export default function App() {
  const [session, setSession] = useState(null);
  const [mine, setMine] = useState(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();

  const say = useCallback((t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2800);
  }, []);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reloadMine = useCallback(async () => {
    if (!session?.user) {
      setMine(null);
      return null;
    }
    try {
      const row = await fetchMine(session.user.id);
      setMine(row);
      return row;
    } catch {
      setMine(null);
      return null;
    }
  }, [session]);

  useEffect(() => {
    reloadMine();
  }, [reloadMine]);

  async function signOut() {
    await supabase.auth.signOut();
    setMine(null);
    navigate("/");
    say("Signed out");
  }

  if (!configured) return <Setup />;

  return (
    <>
      <header className="mast">
        <div className="tape">Flagged · counted · chalked</div>
        <div className="mast-in">
          <Link className="logo" to="/">
            High<em>ball</em>
          </Link>
          <p className="sub">The global tree planters' board · {SEASON} season</p>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "on" : "")}>
              The board
            </NavLink>
            <NavLink to="/camp" className={({ isActive }) => (isActive ? "on" : "")}>
              {mine ? "My camp" : "Get on the board"}
            </NavLink>
            <NavLink to="/gnar" className={({ isActive }) => (isActive ? "on" : "")}>
              How Gnar works
            </NavLink>
            <span className="spacer" />
            {session ? (
              <button onClick={signOut}>Sign out</button>
            ) : (
              <NavLink to="/signin" className={({ isActive }) => (isActive ? "on" : "")}>
                Sign in
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {!ready ? (
          <p className="count" style={{ marginTop: 28 }}>Reading the tally sheets…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Board mine={mine} />} />
            <Route path="/p/:handle" element={<Sheet mine={mine} />} />
            <Route
              path="/camp"
              element={
                <Camp session={session} mine={mine} reload={reloadMine} say={say} />
              }
            />
            <Route path="/gnar" element={<Scoring />} />
            <Route path="/signin" element={<SignIn session={session} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function NotFound() {
  return (
    <section className="panel center" style={{ marginTop: 26 }}>
      <p className="eyebrow">Off the block</p>
      <h2 className="h2">No planter here</h2>
      <p className="p" style={{ margin: "0 auto 20px" }}>
        That camp name isn't on the board, or the link lost a character somewhere.
      </p>
      <Link className="btn" to="/">Back to the board</Link>
    </section>
  );
}
