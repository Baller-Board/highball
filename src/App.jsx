import React, { useEffect, useState, useCallback, useRef } from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";
import { supabase, configured } from "./lib/supabase";
import { fetchMine, amSiteAdmin } from "./lib/api";
import { SEASON } from "./lib/gnar";

import Board from "./components/Board";
import Sheet from "./components/Sheet";
import Camp from "./components/Camp";
import Scoring from "./components/Scoring";
import SignIn from "./components/SignIn";
import Setup from "./components/Setup";
import Crews from "./components/Crews";
import NewCrew from "./components/NewCrew";
import Crew from "./components/Crew";
import Admin from "./components/Admin";

export default function App() {
  const [session, setSession] = useState(null);
  const [mine, setMine] = useState(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [admin, setAdmin] = useState(false);
  const toastTimer = useRef(null);
  const navigate = useNavigate();

  // Each new message gets the full 2.8s, instead of being cut short by the
  // previous message's timer.
  const say = useCallback((t) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
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

  // Keyed on the user id, not the session object: Supabase issues a new
  // session object on every token refresh, and refetching then would wipe
  // whatever the planter was halfway through typing on the camp page.
  const userId = session?.user?.id || null;

  const reloadMine = useCallback(async () => {
    if (!userId) {
      setMine(null);
      return null;
    }
    try {
      const row = await fetchMine(userId);
      setMine(row);
      return row;
    } catch {
      setMine(null);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    reloadMine();
  }, [reloadMine]);

  useEffect(() => {
    if (!userId) return setAdmin(false);
    amSiteAdmin(userId).then(setAdmin).catch(() => setAdmin(false));
  }, [userId]);

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
            <NavLink to="/crews" className={({ isActive }) => (isActive ? "on" : "")}>
              Crews
            </NavLink>
            <NavLink to="/gnar" className={({ isActive }) => (isActive ? "on" : "")}>
              How Gnar works
            </NavLink>
            <span className="spacer" />
            {admin && (
              <NavLink to="/admin" className={({ isActive }) => (isActive ? "on" : "")}>
                Admin
              </NavLink>
            )}
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
            <Route path="/crews" element={<Crews session={session} />} />
            <Route path="/crews/new" element={<NewCrew session={session} say={say} />} />
            <Route path="/c/:slug" element={<Crew session={session} mine={mine} say={say} reloadMine={reloadMine} />} />
            <Route path="/admin" element={<Admin admin={admin} say={say} />} />
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
