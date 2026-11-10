import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCrews } from "../lib/api";

export default function Crews({ session }) {
  const [crews, setCrews] = useState([]);
  const [state, setState] = useState("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    fetchCrews()
      .then((c) => live && (setCrews(c), setState("done")))
      .catch((e) => live && (setErr(e.message), setState("error")));
    return () => {
      live = false;
    };
  }, [session?.user?.id]);

  const approved = crews.filter((c) => c.status === "approved");
  const mineWaiting = crews.filter((c) => c.status !== "approved");

  return (
    <>
      <section className="panel" style={{ marginTop: 26 }}>
        <p className="eyebrow">Crew verification</p>
        <h2 className="h2">Crews</h2>
        <p className="p">
          A crew vouches for its planters. Join yours, and your foreman or checker can mark your logged
          days as verified against the tally sheet. Planters whose days are mostly verified carry the{" "}
          <span className="vtick">✓</span> on the board.
        </p>
        <p className="p">
          Every crew is checked by Highball before it goes live, so a crew name here means the real
          outfit.
        </p>
        <div className="btns">
          <Link className="btn" to="/crews/new">Register a crew</Link>
        </div>
      </section>

      {state === "loading" && <p className="count">Rounding up the crews…</p>}
      {state === "error" && <p className="err">{err}</p>}

      {mineWaiting.length > 0 && (
        <>
          <p className="count">Your crews waiting on review</p>
          {mineWaiting.map((c) => (
            <CrewRow key={c.id} c={c} />
          ))}
        </>
      )}

      {state === "done" && approved.length === 0 && (
        <div className="empty">
          <p className="eyebrow">No crews yet</p>
          <h2 className="h2">Put your outfit on the map</h2>
          <p className="p" style={{ margin: "0 auto 20px" }}>
            Run a crew, or check for one? Register it, and once it's approved your planters can join.
          </p>
          <Link className="btn flag" to="/crews/new">Register a crew</Link>
        </div>
      )}

      {approved.length > 0 && (
        <>
          <p className="count">
            {approved.length} crew{approved.length === 1 ? "" : "s"} verifying
          </p>
          {approved.map((c) => (
            <CrewRow key={c.id} c={c} />
          ))}
        </>
      )}
    </>
  );
}

function CrewRow({ c }) {
  return (
    <Link to={`/c/${c.slug}`} className="row crew-row">
      <span>
        <h3 className="handle">{c.name}</h3>
        <p className="meta">
          {[c.base, c.country].filter(Boolean).join(" · ") || "—"}
          {c.status === "pending" && " · awaiting review"}
          {c.status === "rejected" && " · not approved"}
        </p>
      </span>
      <span className="score">
        <b>{c.members}</b>
        <span>planter{c.members === 1 ? "" : "s"}</span>
      </span>
    </Link>
  );
}
