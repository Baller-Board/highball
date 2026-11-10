import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchCrew,
  fetchStaff,
  fetchRoster,
  fetchReviewQueue,
  requestToJoin,
  leaveCrew,
  decideMember,
  addChecker,
  removeChecker,
  judgeDays,
  updateCrew,
} from "../lib/api";
import { TERRAIN, nf } from "../lib/gnar";

export default function Crew({ session, mine, say, reloadMine }) {
  const { slug } = useParams();
  const userId = session?.user?.id || null;

  const [crew, setCrew] = useState(null);
  const [staff, setStaff] = useState([]);
  const [roster, setRoster] = useState([]);
  const [state, setState] = useState("loading");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await fetchCrew(slug);
      if (!c) return setState("missing");
      const [s, r] = await Promise.all([fetchStaff(c.id), fetchRoster(c.id)]);
      setCrew(c);
      setStaff(s);
      setRoster(r);
      setState("done");
      document.title = `${c.name} — Highball`;
    } catch (e) {
      setErr(e.message);
      setState("error");
    }
  }, [slug]);

  useEffect(() => {
    setState("loading");
    load();
    return () => {
      document.title = "Highball — the global tree planters' board";
    };
  }, [load, userId]);

  const me = staff.find((s) => s.user_id === userId);
  const isStaff = Boolean(me);
  const isOwner = me?.role === "owner";
  const active = roster.filter((m) => m.status === "active");
  const pending = roster.filter((m) => m.status === "pending");
  const myMembership = mine ? roster.find((m) => m.planter_id === mine.id) : null;

  async function act(fn, message) {
    setErr("");
    setBusy(true);
    try {
      await fn();
      if (message) say(message);
      await load();
      reloadMine?.();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  if (state === "loading") return <p className="count" style={{ marginTop: 28 }}>Rounding up the crew…</p>;
  if (state === "error") return <p className="err" style={{ marginTop: 28 }}>{err}</p>;
  if (state === "missing")
    return (
      <section className="panel center" style={{ marginTop: 26 }}>
        <p className="eyebrow">Off the block</p>
        <h2 className="h2">No crew here</h2>
        <p className="p" style={{ margin: "0 auto 20px" }}>
          There's no approved crew at "{slug}". New crews show up once a Highball admin has checked them.
        </p>
        <Link className="btn" to="/crews">All crews</Link>
      </section>
    );

  const approved = crew.status === "approved";

  return (
    <>
      <div style={{ margin: "26px 0 14px" }}>
        <Link className="btn ghost" to="/crews">← All crews</Link>
      </div>

      <section className="panel">
        <p className="eyebrow">
          {[crew.base, crew.country].filter(Boolean).join(" · ") || "Crew"}
          {isOwner ? " · you run this crew" : isStaff ? " · you check for this crew" : ""}
        </p>
        <h2 className="h2">{crew.name}</h2>
        {crew.about && <p className="p">{crew.about}</p>}
        {crew.website && (
          <p className="meta">
            <a href={crew.website} target="_blank" rel="noopener noreferrer nofollow">
              {crew.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}

        {crew.status === "pending" && (
          <div className="warn" style={{ marginTop: 16 }}>
            Waiting on review. A Highball admin checks every crew before it goes live. Until then it
            isn't listed publicly, planters can't join, and you can't verify days. Renaming a crew sends
            it back for review.
          </div>
        )}
        {crew.status === "rejected" && (
          <div className="warn" style={{ marginTop: 16 }}>
            This crew wasn't approved. If that's a mistake, get in touch with the Highball admins.
          </div>
        )}

        <div className="stats">
          <div className="stat"><b>{active.length}</b><span>Planters</span></div>
          <div className="stat">
            <b>{active.filter((m) => m.planter.crew_verified).length}</b><span>Crew verified</span>
          </div>
          <div className="stat">
            <b>{nf(active.reduce((t, m) => t + Number(m.planter.season_trees), 0))}</b><span>Trees this season</span>
          </div>
        </div>

        {approved && mine && !isStaff && <JoinButton m={myMembership} busy={busy} act={act} crew={crew} />}
        {approved && mine && isStaff && !myMembership && (
          <div className="btns">
            <button className="btn ghost" disabled={busy}
              onClick={() => act(() => requestToJoin(crew.id), "Request sent")}>
              List me on the roster too
            </button>
          </div>
        )}
        {approved && !session && (
          <p className="hint" style={{ marginTop: 14 }}>
            <Link to="/signin">Sign in</Link> to ask to join this crew.
          </p>
        )}
        {approved && session && !mine && (
          <p className="hint" style={{ marginTop: 14 }}>
            <Link to="/camp">Make a profile</Link> first, then ask to join.
          </p>
        )}
        {err && <p className="err">{err}</p>}
      </section>

      <section className="panel">
        <p className="eyebrow">Roster · sorted by Gnar</p>
        {active.length === 0 ? (
          <p className="p" style={{ margin: 0 }}>Nobody on the roster yet.</p>
        ) : (
          <div className="slip">
            <div className="slip-head roster">
              <span>Planter</span>
              <span>Season</span>
              <span>Verified</span>
              <span style={{ textAlign: "right" }}>Gnar</span>
            </div>
            {active.map((m) => (
              <div className="slip-row roster" key={m.id}>
                <span className="note" style={{ color: "inherit" }}>
                  <Link to={`/p/${encodeURIComponent(m.planter.handle)}`}>{m.planter.handle}</Link>
                  {m.planter.crew_verified && <span className="vtick" title="Crew verified"> ✓</span>}
                </span>
                <span>{nf(m.planter.season_trees)}</span>
                <span>
                  {m.planter.verified_pct}%
                  {m.planter.disputed_days > 0 && <span className="disputed"> · {m.planter.disputed_days} disputed</span>}
                </span>
                <b>
                  {nf(m.planter.gnar)}
                  {isStaff && m.planter.user_id !== userId && (
                    <button className="x" disabled={busy} aria-label={`Remove ${m.planter.handle}`}
                      title="Take off the roster"
                      onClick={() => {
                        if (window.confirm(`Take ${m.planter.handle} off the roster? Days you've already checked keep their marks.`))
                          act(() => decideMember(m.id, "declined"), `${m.planter.handle} removed`);
                      }}>
                      ✕
                    </button>
                  )}
                </b>
              </div>
            ))}
          </div>
        )}
      </section>

      {isStaff && approved && (
        <>
          <Requests pending={pending} busy={busy} act={act} />
          <ReviewQueue crew={crew} members={active} userId={userId} say={say} reload={load} />
        </>
      )}
      {isOwner && <Checkers crew={crew} staff={staff} busy={busy} act={act} userId={userId} />}
      {isOwner && <EditCrew crew={crew} busy={busy} act={act} />}
    </>
  );
}

function JoinButton({ m, busy, act, crew }) {
  if (m?.status === "active")
    return (
      <div className="btns">
        <span className="ok" style={{ margin: "auto 8px auto 0" }}>You're on this crew.</span>
        <button className="btn ghost" disabled={busy}
          onClick={() => window.confirm(`Leave ${crew.name}? Days they've already verified stay verified.`) &&
            act(() => leaveCrew(crew.id), "Left the crew")}>
          Leave crew
        </button>
      </div>
    );
  if (m?.status === "pending")
    return (
      <div className="btns">
        <span className="ok" style={{ margin: "auto 8px auto 0" }}>Request sent. Waiting on the crew.</span>
        <button className="btn ghost" disabled={busy} onClick={() => act(() => leaveCrew(crew.id), "Request withdrawn")}>
          Withdraw request
        </button>
      </div>
    );
  return (
    <div className="btns">
      <button className="btn flag" disabled={busy} onClick={() => act(() => requestToJoin(crew.id), "Request sent")}>
        Ask to join this crew
      </button>
    </div>
  );
}

function Requests({ pending, busy, act }) {
  if (!pending.length) return null;
  return (
    <section className="panel">
      <p className="eyebrow">Staff · {pending.length} waiting</p>
      <h2 className="h2">Join requests</h2>
      <p className="p">Accept planters who actually plant for you. Once they're on, you can verify their days.</p>
      {pending.map((m) => (
        <div className="req" key={m.id}>
          <span>
            <Link to={`/p/${encodeURIComponent(m.planter.handle)}`}><b>{m.planter.handle}</b></Link>
            <span className="meta" style={{ display: "block" }}>
              {m.planter.base} · {m.planter.seasons} seasons · {nf(m.planter.career_trees)} career
            </span>
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button className="btn" disabled={busy} onClick={() => act(() => decideMember(m.id, "active"), `${m.planter.handle} is on the crew`)}>
              Accept
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => act(() => decideMember(m.id, "declined"), "Request declined")}>
              Decline
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}

function ReviewQueue({ crew, members, userId, say, reload }) {
  const [days, setDays] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Your own days never show up here: nobody checks their own tally.
  const reviewable = useMemo(() => members.filter((m) => m.planter.user_id !== userId), [members, userId]);
  const byId = useMemo(() => Object.fromEntries(reviewable.map((m) => [m.planter_id, m.planter])), [reviewable]);
  const idsKey = reviewable.map((m) => m.planter_id).join(",");

  const loadQueue = useCallback(async () => {
    try {
      setDays(await fetchReviewQueue(idsKey ? idsKey.split(",") : []));
    } catch (e) {
      setErr(e.message);
    }
  }, [idsKey]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const groups = useMemo(() => {
    const g = {};
    for (const d of days) (g[d.planter_id] ||= []).push(d);
    return Object.entries(g);
  }, [days]);

  async function judge(verdict) {
    setErr("");
    if (!picked.size) return setErr("Tick the days you've checked first.");
    if (verdict === "disputed" && !note.trim()) return setErr("Say what's off. The planter sees this note.");
    setBusy(true);
    try {
      const n = await judgeDays(crew.id, [...picked], verdict, note.trim());
      say(`${n} day${n === 1 ? "" : "s"} ${verdict}`);
      setPicked(new Set());
      setNote("");
      await loadQueue();
      await reload();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <section className="panel">
      <p className="eyebrow">Staff · {days.length} day{days.length === 1 ? "" : "s"} to check</p>
      <h2 className="h2">Check the tally</h2>
      <p className="p">
        Hold each day up against your tally sheets. Verify the ones that match. Dispute the ones that
        don't, with a note saying what the sheet says; the planter and everyone else sees it on their
        profile. If the planter edits a checked day's count, date or ground, the mark comes off and it
        lands back here.
      </p>

      {days.length === 0 ? (
        <p className="ok">All caught up. Nothing waiting.</p>
      ) : (
        <>
          {groups.map(([pid, list]) => {
            const all = list.every((d) => picked.has(d.id));
            return (
              <div key={pid} style={{ marginTop: 18 }}>
                <label className="check-all">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={() =>
                      setPicked((p) => {
                        const n = new Set(p);
                        list.forEach((d) => (all ? n.delete(d.id) : n.add(d.id)));
                        return n;
                      })
                    }
                  />
                  <b>{byId[pid]?.handle}</b> · {list.length} day{list.length === 1 ? "" : "s"}
                </label>
                <div className="slip">
                  {list.map((d) => (
                    <label className="slip-row check" key={d.id}>
                      <span>
                        <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} /> {d.date}
                      </span>
                      <span className="note">{d.block || "—"}{d.notes ? ` · ${d.notes}` : ""}</span>
                      <span><i className="terrain">{TERRAIN[d.terrain]?.label || d.terrain}</i></span>
                      <b>{nf(d.trees)}</b>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="dnote">Note for disputes</label>
            <input id="dnote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={90}
              placeholder="Tally sheet says 2,600" />
          </div>
          {err && <p className="err">{err}</p>}
          <div className="btns">
            <button className="btn" disabled={busy || !picked.size} onClick={() => judge("verified")}>
              Verify {picked.size || ""} day{picked.size === 1 ? "" : "s"}
            </button>
            <button className="btn flag" disabled={busy || !picked.size} onClick={() => judge("disputed")}>
              Dispute
            </button>
          </div>
        </>
      )}
      {days.length === 0 && err && <p className="err">{err}</p>}
    </section>
  );
}

function Checkers({ crew, staff, busy, act, userId }) {
  const [handle, setHandle] = useState("");
  return (
    <section className="panel">
      <p className="eyebrow">Owner</p>
      <h2 className="h2">Who can verify</h2>
      <p className="p">
        Add foremen, crew bosses or checkers by their camp name. They need a Highball profile. Checkers
        can accept planters and verify days, but only you can add or remove checkers.
      </p>
      <div className="slip" style={{ marginBottom: 14 }}>
        {staff.map((s) => (
          <div className="slip-row roster" key={s.user_id}>
            <span>{s.handle || "(no profile yet)"}{s.user_id === userId ? " · you" : ""}</span>
            <span />
            <span><i className="terrain">{s.role}</i></span>
            <b>
              {s.role === "checker" && (
                <button className="x" disabled={busy} aria-label={`Remove ${s.handle}`}
                  onClick={() => act(() => removeChecker(crew.id, s.user_id), "Checker removed")}>✕</button>
              )}
            </b>
          </div>
        ))}
      </div>
      <div className="inline-add">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="chk">Camp name</label>
          <input id="chk" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Foreman Phil" maxLength={24} />
        </div>
        <button className="btn" disabled={busy || handle.trim().length < 2}
          onClick={() => act(async () => { await addChecker(crew.id, handle.trim()); setHandle(""); }, "Checker added")}>
          Add
        </button>
      </div>
    </section>
  );
}

function EditCrew({ crew, busy, act }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: crew.name,
    base: crew.base || "",
    country: crew.country || "",
    website: crew.website || "",
    about: crew.about || "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!open)
    return (
      <div style={{ marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => setOpen(true)}>Edit crew details</button>
      </div>
    );
  const renaming = f.name.trim() !== crew.name;
  return (
    <section className="panel">
      <p className="eyebrow">Owner</p>
      <h2 className="h2">Crew details</h2>
      <div className="grid">
        <div className="field"><label htmlFor="en">Name</label><input id="en" value={f.name} onChange={set("name")} maxLength={50} /></div>
        <div className="field"><label htmlFor="eb">Based in</label><input id="eb" value={f.base} onChange={set("base")} maxLength={40} /></div>
        <div className="field"><label htmlFor="ec">Country</label><input id="ec" value={f.country} onChange={set("country")} maxLength={30} /></div>
        <div className="field"><label htmlFor="ew">Website</label><input id="ew" value={f.website} onChange={set("website")} maxLength={120} /></div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="ea">About</label>
        <textarea id="ea" rows={3} value={f.about} onChange={set("about")} maxLength={280} />
      </div>
      {renaming && crew.status === "approved" && (
        <p className="err">Changing the name sends the crew back for review. Verifying pauses until it's re-approved.</p>
      )}
      <div className="btns">
        <button className="btn" disabled={busy}
          onClick={() => act(async () => { await updateCrew(crew.id, { ...f, name: f.name.trim(), website: f.website.trim() }); setOpen(false); }, "Crew updated")}>
          Save
        </button>
        <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </section>
  );
}
