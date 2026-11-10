import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveProfile, addDay, removeDay, deleteProfile, fetchDays, fetchMyCrews, fetchCrewNames } from "../lib/api";
import { TERRAIN, nf, gnarPreview, localDate } from "../lib/gnar";
import { Mark } from "./Sheet";
import SignIn from "./SignIn";

const BLANK = { handle: "", base: "", country: "", crew: "", seasons: "", priorTrees: "", tagline: "" };

export default function Camp({ session, mine, reload, say }) {
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const [days, setDays] = useState([]);
  const [day, setDay] = useState({
    date: localDate(),
    trees: "",
    terrain: "block",
    block: "",
    notes: "",
  });
  const [dayErr, setDayErr] = useState("");
  const [crews, setCrews] = useState({ staff: [], members: [] });
  const [crewNames, setCrewNames] = useState({});
  const [confirmDay, setConfirmDay] = useState(null);

  useEffect(() => {
    if (!mine) return;
    setForm({
      handle: mine.handle,
      base: mine.base || "",
      country: mine.country || "",
      crew: mine.crew || "",
      seasons: String(mine.seasons ?? ""),
      priorTrees: String(mine.prior_trees ?? ""),
      tagline: mine.tagline || "",
    });
    fetchDays(mine.id).then(setDays).catch(() => setDays([]));
  }, [mine]);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    fetchMyCrews(userId, mine?.id).then(setCrews).catch(() => {});
  }, [userId, mine?.id]);

  useEffect(() => {
    const ids = [...new Set(days.map((d) => d.verdict_crew).filter(Boolean))];
    fetchCrewNames(ids).then(setCrewNames).catch(() => {});
  }, [days]);

  if (!session) {
    return (
      <SignIn
        session={session}
        heading="Sign in to get on the board"
        blurb="Your numbers are tied to your account, so only you can change them."
      />
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setD = (k) => (e) => setDay({ ...day, [k]: e.target.value });

  async function submitProfile() {
    setErr("");
    const handle = form.handle.trim();
    const base = form.base.trim();
    if (handle.length < 2) return setErr("Add a camp name — that's what the board lists you by.");
    if (handle.length > 24) return setErr("Camp name is capped at 24 characters.");
    if (!base) return setErr("Add a home base so people know where you plant.");
    const seasons = parseInt(form.seasons, 10);
    if (isNaN(seasons) || seasons < 0 || seasons > 60) return setErr("Seasons planted must be a number from 0 to 60.");
    const prior = form.priorTrees === "" ? 0 : parseInt(form.priorTrees, 10);
    if (isNaN(prior) || prior < 0 || prior > 20000000)
      return setErr("Career carry-over must be a number from 0 to 20,000,000.");

    setBusy(true);
    try {
      await saveProfile(
        session.user.id,
        { handle, base, country: form.country.trim(), crew: form.crew.trim(), seasons, priorTrees: prior, tagline: form.tagline.trim() },
        mine?.id
      );
      await reload();
      say(mine ? "Profile updated" : "You're on the board");
      if (!mine) navigate(`/p/${encodeURIComponent(handle)}`);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function submitDay() {
    setDayErr("");
    const trees = parseInt(day.trees, 10);
    if (!day.date) return setDayErr("Pick the date you planted.");
    if (isNaN(trees) || trees <= 0) return setDayErr("Enter how many trees went in the ground.");
    if (trees > 12000) return setDayErr("That's above any recorded day. Enter a real count.");

    setBusy(true);
    try {
      const earned = gnarPreview(mine, trees, day.terrain);
      await addDay(mine.id, {
        date: day.date,
        trees,
        terrain: day.terrain,
        block: day.block.trim(),
        notes: day.notes.trim(),
      });
      const fresh = await reload();
      if (fresh) setDays(await fetchDays(fresh.id));
      setDay({ ...day, trees: "", block: "", notes: "" });
      say(earned > 0 ? `${nf(trees)} trees · +${nf(earned)} Gnar` : `${nf(trees)} trees chalked up`);
    } catch (e) {
      setDayErr(e.message);
    }
    setBusy(false);
  }

  async function dropDay(id) {
    setConfirmDay(null);
    setBusy(true);
    try {
      await removeDay(id);
      const fresh = await reload();
      if (fresh) setDays(await fetchDays(fresh.id));
      say("Day removed");
    } catch (e) {
      setDayErr(e.message);
    }
    setBusy(false);
  }

  async function dropProfile() {
    setBusy(true);
    try {
      await deleteProfile(mine.id);
      await reload();
      setForm(BLANK);
      setDays([]);
      setConfirmDel(false);
      say("Profile pulled from the board");
      navigate("/");
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const preview = mine && day.trees ? gnarPreview(mine, parseInt(day.trees, 10) || 0, day.terrain) : 0;

  return (
    <>
      <section className="panel" style={{ marginTop: 26 }}>
        <p className="eyebrow">{mine ? "Your profile" : "Step one"}</p>
        <h2 className="h2">{mine ? "My camp" : "Sign on"}</h2>
        <p className="p">
          {mine
            ? "Change anything here and the board updates on your next save."
            : "Your camp name, where you plant, and what you've already put in the ground."}
        </p>

        <div className="warn">
          This board is public. Your camp name, location, crew, numbers and day sheet are visible to
          anyone who visits — including from search engines. Use a camp name rather than your legal
          name if you'd rather stay unlisted. Your email address is never shown.
        </div>

        <div className="grid">
          <div className="field">
            <label htmlFor="handle">Camp name</label>
            <input id="handle" value={form.handle} onChange={set("handle")} placeholder="Ditchpig" maxLength={24} />
          </div>
          <div className="field">
            <label htmlFor="base">Home base</label>
            <input id="base" value={form.base} onChange={set("base")} placeholder="Prince George, BC" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <input id="country" value={form.country} onChange={set("country")} placeholder="Canada" maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="crew">Crew or company</label>
            <input id="crew" value={form.crew} onChange={set("crew")} placeholder="Freelance" maxLength={40} />
            <span className="hint">
              Shown until you join a registered crew. <Link to="/crews">Join one</Link> to get your days verified.
            </span>
          </div>
          <div className="field">
            <label htmlFor="seasons">Seasons planted</label>
            <input id="seasons" value={form.seasons} onChange={set("seasons")} inputMode="numeric" placeholder="4" />
          </div>
          <div className="field">
            <label htmlFor="prior">Career trees before joining</label>
            <input id="prior" value={form.priorTrees} onChange={set("priorTrees")} inputMode="numeric" placeholder="180000" />
            <span className="hint">Your best honest total. Days you log here get added on top.</span>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="tagline">One line about how you plant</label>
          <input id="tagline" value={form.tagline} onChange={set("tagline")} placeholder="Cream is for tourists." maxLength={90} />
        </div>

        {err && <p className="err">{err}</p>}

        <div className="btns">
          <button className="btn flag" onClick={submitProfile} disabled={busy}>
            {mine ? "Save changes" : "Put me on the board"}
          </button>
          {mine && (
            <Link className="btn ghost" to={`/p/${encodeURIComponent(mine.handle)}`}>
              View my profile
            </Link>
          )}
        </div>
      </section>

      {mine && <MyCrews crews={crews} />}

      {mine && (
        <section className="panel">
          <p className="eyebrow">Step two · one entry per date</p>
          <h2 className="h2">Chalk up a day</h2>

          <div className="grid">
            <div className="field">
              <label htmlFor="date">Date</label>
              <input id="date" type="date" value={day.date} onChange={setD("date")} min="1990-01-01" max={localDate()} />
            </div>
            <div className="field">
              <label htmlFor="trees">Trees planted</label>
              <input id="trees" value={day.trees} onChange={setD("trees")} inputMode="numeric" placeholder="2800" />
              {preview > 0 && <span className="hint">Worth about +{nf(preview)} Gnar</span>}
            </div>
            <div className="field">
              <label htmlFor="terrain">Ground</label>
              <select id="terrain" value={day.terrain} onChange={setD("terrain")}>
                {Object.entries(TERRAIN).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label} · ×{v.factor.toFixed(2)}
                  </option>
                ))}
              </select>
              <span className="hint">{TERRAIN[day.terrain].blurb}</span>
            </div>
            <div className="field">
              <label htmlFor="block">Block</label>
              <input id="block" value={day.block} onChange={setD("block")} placeholder="Chuchinka 14" maxLength={40} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="notes">Notes</label>
            <input id="notes" value={day.notes} onChange={setD("notes")} placeholder="Rained all day, cache 400m in." maxLength={90} />
          </div>

          {dayErr && <p className="err">{dayErr}</p>}

          <button className="btn" style={{ marginTop: 20 }} onClick={submitDay} disabled={busy}>
            Add day
          </button>

          {days.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <p className="eyebrow">Your day sheet</p>
              <div className="slip">
                <div className="slip-head">
                  <span>Date</span>
                  <span>Block</span>
                  <span>Ground</span>
                  <span style={{ textAlign: "right" }}>Trees</span>
                </div>
                {days.map((d) => (
                  <div className={`slip-row${d.verdict === "disputed" ? " is-disputed" : ""}`} key={d.id}>
                    <span>
                      {d.date}
                      <Mark d={d} crew={crewNames[d.verdict_crew]} />
                    </span>
                    <span className="note">
                      {d.verdict === "disputed" ? <span className="disputed">Disputed: {d.verdict_note}</span> : d.block || "—"}
                    </span>
                    <span><i className="terrain">{TERRAIN[d.terrain]?.label}</i></span>
                    <b>
                      {nf(d.trees)}{" "}
                      {confirmDay === d.id ? (
                        <span className="confirm-x">
                          <button className="x" onClick={() => dropDay(d.id)} disabled={busy}>Remove</button>
                          <button className="x keep" onClick={() => setConfirmDay(null)}>Keep</button>
                        </span>
                      ) : (
                        <button className="x" onClick={() => setConfirmDay(d.id)} aria-label={`Remove ${d.date}`} disabled={busy}>
                          ✕
                        </button>
                      )}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 26, borderTop: "1px solid var(--rule)", paddingTop: 18 }}>
            {confirmDel ? (
              <>
                <p className="p" style={{ margin: "0 0 12px" }}>
                  This deletes your profile and every day you've logged. It can't be undone.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn flag" onClick={dropProfile} disabled={busy}>Delete for good</button>
                  <button className="btn ghost" onClick={() => setConfirmDel(false)}>Keep it</button>
                </div>
              </>
            ) : (
              <button className="btn ghost" onClick={() => setConfirmDel(true)}>
                Pull my profile off the board
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function MyCrews({ crews }) {
  const { staff, members } = crews;
  return (
    <section className="panel">
      <p className="eyebrow">Crew verification</p>
      <h2 className="h2">My crews</h2>
      {members.length === 0 && staff.length === 0 ? (
        <p className="p" style={{ margin: 0 }}>
          You're not on a registered crew yet. <Link to="/crews">Find your crew</Link> and ask to join. Once
          they accept, your foreman or checker can verify your days against the tally sheet.
        </p>
      ) : (
        <div className="slip">
          {members.map((m) => (
            <div className="slip-row roster" key={m.id}>
              <span className="note" style={{ color: "inherit" }}><Link to={`/c/${m.crews.slug}`}>{m.crews.name}</Link></span>
              <span />
              <span><i className="terrain">{m.status === "active" ? "member" : m.status === "pending" ? "requested" : "declined"}</i></span>
              <b />
            </div>
          ))}
          {staff.map((s) => (
            <div className="slip-row roster" key={s.crews.id + s.role}>
              <span className="note" style={{ color: "inherit" }}><Link to={`/c/${s.crews.slug}`}>{s.crews.name}</Link></span>
              <span className="note">{s.crews.status === "approved" ? "" : s.crews.status === "pending" ? "awaiting review" : "not approved"}</span>
              <span><i className="terrain">{s.role}</i></span>
              <b />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
