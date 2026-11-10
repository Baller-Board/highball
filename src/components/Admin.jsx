import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPendingCrews, reviewCrew } from "../lib/api";

// Only reachable for people listed in site_admins. The database enforces
// that too: review_crew() refuses anyone else.
export default function Admin({ admin, say }) {
  const [crews, setCrews] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetchPendingCrews().then(setCrews).catch((e) => setErr(e.message));

  useEffect(() => {
    if (admin) load();
  }, [admin]);

  if (!admin)
    return (
      <section className="panel center" style={{ marginTop: 26 }}>
        <p className="eyebrow">Admins only</p>
        <h2 className="h2">Nothing to see here</h2>
        <Link className="btn" to="/">Back to the board</Link>
      </section>
    );

  async function decide(id, status, name) {
    setBusy(true);
    try {
      await reviewCrew(id, status);
      say(`${name} ${status}`);
      await load();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <section className="panel" style={{ marginTop: 26 }}>
      <p className="eyebrow">Admin · {crews.length} waiting</p>
      <h2 className="h2">Crews to review</h2>
      <p className="p">
        Approve a crew only when you're satisfied it's the real outfit and the person who registered it
        can vouch for planters' numbers. Check the website, ask around, or email them. Approved crews
        can mark days verified, which is what the ✓ on the board means.
      </p>
      {err && <p className="err">{err}</p>}
      {crews.length === 0 && <p className="ok">Nothing waiting.</p>}
      {crews.map((c) => (
        <div className="req" key={c.id}>
          <span>
            <Link to={`/c/${c.slug}`}><b>{c.name}</b></Link>
            <span className="meta" style={{ display: "block" }}>
              {[c.base, c.country].filter(Boolean).join(" · ") || "No location given"} · registered{" "}
              {new Date(c.created_at).toLocaleDateString()}
            </span>
            {c.website && (
              <a className="meta" href={c.website} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a>
            )}
            {c.about && <span className="p" style={{ display: "block", fontSize: 13, marginTop: 6 }}>{c.about}</span>}
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button className="btn" disabled={busy} onClick={() => decide(c.id, "approved", c.name)}>Approve</button>
            <button className="btn ghost" disabled={busy} onClick={() => decide(c.id, "rejected", c.name)}>Reject</button>
          </span>
        </div>
      ))}
    </section>
  );
}
