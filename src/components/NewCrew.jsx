import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCrew } from "../lib/api";
import { slugify } from "../lib/gnar";
import SignIn from "./SignIn";

export default function NewCrew({ session, say }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", slug: "", base: "", country: "", website: "", about: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <SignIn
        session={session}
        heading="Sign in to register a crew"
        blurb="You'll be the crew's owner: you approve who joins and who can verify days."
      />
    );
  }

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  async function submit() {
    setErr("");
    const name = form.name.trim();
    const slug = slugify(form.slug);
    const website = form.website.trim();
    if (name.length < 2) return setErr("Give the crew its name.");
    if (slug.length < 2) return setErr("The crew link needs at least two letters or numbers.");
    if (website && !/^https?:\/\//.test(website)) return setErr("Website needs to start with https://");
    setBusy(true);
    try {
      await createCrew({
        name,
        slug,
        base: form.base.trim(),
        country: form.country.trim(),
        website,
        about: form.about.trim(),
      });
      say("Crew registered · waiting on review");
      navigate(`/c/${slug}`);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <section className="panel" style={{ marginTop: 26 }}>
      <p className="eyebrow">Owners and checkers</p>
      <h2 className="h2">Register a crew</h2>
      <p className="p">
        For the company, contractor or crew boss who can vouch for planters' numbers. A Highball admin
        checks every crew before it goes live, so use the outfit's real name, and add a website if it
        has one; that's the quickest way to get approved.
      </p>

      <div className="grid">
        <div className="field">
          <label htmlFor="cname">Crew or company name</label>
          <input id="cname" value={form.name} onChange={set("name")} placeholder="Nechako Planting" maxLength={50} />
        </div>
        <div className="field">
          <label htmlFor="cslug">Crew link</label>
          <input
            id="cslug"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug")(e);
            }}
            placeholder="nechako-planting"
            maxLength={40}
          />
          <span className="hint">{window.location.host}/c/{slugify(form.slug) || "…"}</span>
        </div>
        <div className="field">
          <label htmlFor="cbase">Based in</label>
          <input id="cbase" value={form.base} onChange={set("base")} placeholder="Vanderhoof, BC" maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="ccountry">Country</label>
          <input id="ccountry" value={form.country} onChange={set("country")} placeholder="Canada" maxLength={30} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="cweb">Website</label>
        <input id="cweb" value={form.website} onChange={set("website")} placeholder="https://" maxLength={120} />
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="cabout">About the crew</label>
        <textarea id="cabout" rows={3} value={form.about} onChange={set("about")} maxLength={280}
          placeholder="Interior BC contracts, mostly burns and steep ground. Camp from May to August." />
      </div>

      {err && <p className="err">{err}</p>}
      <div className="btns">
        <button className="btn flag" onClick={submit} disabled={busy}>
          {busy ? "Registering…" : "Register crew"}
        </button>
      </div>
    </section>
  );
}
