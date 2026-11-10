import React from "react";
import { TERRAIN } from "../lib/gnar";

export default function Scoring() {
  return (
    <>
      <section className="panel" style={{ marginTop: 26 }}>
        <p className="eyebrow">The metric</p>
        <h2 className="h2">How Gnar works</h2>
        <p className="p">
          Raw tree counts favour whoever drew the best land. Gnar doesn't. You earn Gnar for the ground
          you took it off, the seasons you've put in, and whether you can hold a number day after day —
          so a 3,000 day on a burn earns more than a 3,000 day on cream. Every part of the calculation
          is below, nothing hidden.
        </p>
        <div className="formula">
          Best day ÷ 50<br />
          + √(career trees ÷ 1,000) × 3<br />
          + seasons planted × 6<br />
          + (ground factor − 1) × 60<br />
          + day average ÷ 60
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Ground factor is your logged trees averaged across the terrain multipliers below. Gnar is
          calculated in the database, so every planter's number comes off the same formula.
        </p>
      </section>

      <section className="panel">
        <p className="eyebrow">Terrain multipliers</p>
        <h2 className="h2">The ground you took</h2>
        <div className="slip" style={{ marginTop: 16 }}>
          <div className="slip-head">
            <span>Ground</span>
            <span>What it means</span>
            <span />
            <span style={{ textAlign: "right" }}>Weight</span>
          </div>
          {Object.entries(TERRAIN).map(([k, v]) => (
            <div className="slip-row" key={k}>
              <span><i className="terrain">{v.label}</i></span>
              <span className="note">{v.blurb}</span>
              <span />
              <b>×{v.factor.toFixed(2)}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">The honour system</p>
        <h2 className="h2">Numbers are self-reported</h2>
        <p className="p">
          There's no tally verification here — this runs on the same trust as a camp board. Post what
          your day sheet actually said. Every day you log stays visible on your profile, so a padded
          number sits in plain sight next to the rest of your season, and every planter reading the
          board knows what a real 4,000 day looks like.
        </p>
      </section>
    </>
  );
}
