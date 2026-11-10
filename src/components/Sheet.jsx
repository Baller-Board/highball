import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPlanter, fetchDays } from "../lib/api";
import { TERRAIN, SEASON, nf, patches } from "../lib/gnar";

export default function Sheet({ mine }) {
  const { handle } = useParams();
  const [row, setRow] = useState(null);
  const [days, setDays] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    (async () => {
      try {
        const planter = await fetchPlanter(handle);
        if (!live) return;
        if (!planter) {
          setState("missing");
          return;
        }
        setRow(planter);
        const d = await fetchDays(planter.id);
        if (!live) return;
        setDays(d);
        setState("done");
        document.title = `${planter.handle} — Highball`;
      } catch {
        if (live) setState("missing");
      }
    })();
    return () => {
      live = false;
      document.title = "Highball — the global tree planters' board";
    };
  }, [handle]);

  if (state === "loading") return <p className="count" style={{ marginTop: 28 }}>Pulling the day sheet…</p>;

  if (state === "missing")
    return (
      <section className="panel center" style={{ marginTop: 26 }}>
        <p className="eyebrow">Off the block</p>
        <h2 className="h2">No planter here</h2>
        <p className="p" style={{ margin: "0 auto 20px" }}>
          Nobody on the board goes by "{handle}".
        </p>
        <Link className="btn" to="/">Back to the board</Link>
      </section>
    );

  const pl = patches(row);
  const isMe = mine && mine.id === row.id;

  return (
    <>
      <div style={{ margin: "26px 0 14px" }}>
        <Link className="btn ghost" to="/">← Back to the board</Link>
      </div>

      <section className="panel">
        <p className="eyebrow">
          {row.base}
          {row.country ? ` · ${row.country}` : ""} · {row.seasons} season{row.seasons === 1 ? "" : "s"}
          {isMe ? " · your profile" : ""}
        </p>
        <h2 className="h2">{row.handle}</h2>
        {row.tagline && <p className="p" style={{ fontStyle: "italic" }}>“{row.tagline}”</p>}
        {row.crew && <p className="meta">Crew · {row.crew}</p>}

        <div className="stats">
          <div className="stat"><b>{nf(row.gnar)}</b><span>Gnar index</span></div>
          <div className="stat"><b>{nf(row.career_trees)}</b><span>Career trees</span></div>
          <div className="stat"><b>{nf(row.season_trees)}</b><span>{SEASON} season</span></div>
          <div className="stat"><b>{nf(row.best_day)}</b><span>Best day</span></div>
          <div className="stat"><b>{nf(row.avg_day)}</b><span>Day average</span></div>
          <div className="stat"><b>{Number(row.ground_factor).toFixed(2)}</b><span>Ground factor</span></div>
        </div>

        {pl.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 22 }}>Patches earned</p>
            <div className="patches">
              {pl.map(([label, tier]) => (
                <span key={label} className={`patch${tier ? " gold" : ""}`}>{label}</span>
              ))}
            </div>
          </>
        )}

        {isMe && (
          <div className="btns">
            <Link className="btn ghost" to="/camp">Edit profile · log a day</Link>
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Day sheet · {days.length} day{days.length === 1 ? "" : "s"} logged</p>
        {days.length === 0 ? (
          <p className="p" style={{ margin: 0 }}>
            No days logged yet. Career total carried in from before joining: {nf(row.prior_trees)} trees.
          </p>
        ) : (
          <div className="slip">
            <div className="slip-head">
              <span>Date</span>
              <span>Block</span>
              <span>Ground</span>
              <span style={{ textAlign: "right" }}>Trees</span>
            </div>
            {days.map((d) => (
              <div className="slip-row" key={d.id}>
                <span>{d.date}</span>
                <span className="note">
                  {d.block || "—"}
                  {d.notes ? ` · ${d.notes}` : ""}
                </span>
                <span><i className="terrain">{TERRAIN[d.terrain]?.label || d.terrain}</i></span>
                <b>{nf(d.trees)}</b>
              </div>
            ))}
          </div>
        )}
        {Number(row.prior_trees) > 0 && days.length > 0 && (
          <p className="hint" style={{ marginTop: 12 }}>
            Plus {nf(row.prior_trees)} trees carried in from seasons before joining the board.
          </p>
        )}
      </section>
    </>
  );
}
