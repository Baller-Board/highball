import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBoard } from "../lib/api";
import { SORTS, nf } from "../lib/gnar";

export default function Board({ mine }) {
  const [sort, setSort] = useState("gnar");
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setState("loading");
    fetchBoard(sort)
      .then((data) => {
        if (!live) return;
        setRows(data);
        setState("done");
      })
      .catch((e) => {
        if (!live) return;
        setErr(e.message);
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [sort]);

  const active = SORTS.find((s) => s.key === sort);
  const top = rows.length ? Number(rows[0][sort]) || 1 : 1;

  return (
    <>
      <div className="sorts">
        {SORTS.map((s) => (
          <button key={s.key} className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {state === "loading" && <p className="count">Reading the tally sheets…</p>}

      {state === "error" && (
        <div className="empty">
          <p className="eyebrow">Couldn't load the board</p>
          <h2 className="h2">The board didn't answer</h2>
          <p className="p" style={{ margin: "0 auto 18px" }}>{err}</p>
          <button className="btn ghost" onClick={() => setSort(sort)}>Try again</button>
        </div>
      )}

      {state === "done" && rows.length === 0 && (
        <div className="empty">
          <p className="eyebrow">Nothing chalked up yet</p>
          <h2 className="h2">Be the first number on the board</h2>
          <p className="p" style={{ margin: "0 auto 20px" }}>
            Make a profile, log your days, and the board sorts itself out.
          </p>
          <Link className="btn flag" to="/camp">Create a profile</Link>
        </div>
      )}

      {state === "done" && rows.length > 0 && (
        <>
          <p className="count">
            {rows.length} planter{rows.length === 1 ? "" : "s"} on the board · sorted by {active.label.toLowerCase()}
          </p>
          {rows.map((r, i) => (
            <Link
              key={r.id}
              to={`/p/${encodeURIComponent(r.handle)}`}
              className={`row${i === 0 ? " first" : ""}`}
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            >
              {i === 0 && <span className="ribbon">Highballer</span>}
              {mine && mine.id === r.id && <span className="mine">You</span>}
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <h3 className="handle">{r.handle}</h3>
                <p className="meta">
                  {r.base}
                  {r.country ? ` · ${r.country}` : ""}
                  {r.crew ? ` · ${r.crew}` : ""}
                </p>
              </span>
              <span className="score">
                <b>{nf(r[sort])}</b>
                <span>{active.unit}</span>
              </span>
              <span className="bar">
                <i style={{ width: `${Math.max(2, (Number(r[sort]) / top) * 100)}%` }} />
                {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((t) => (
                  <u key={t} style={{ left: `${t}%` }} />
                ))}
              </span>
            </Link>
          ))}
        </>
      )}
    </>
  );
}
