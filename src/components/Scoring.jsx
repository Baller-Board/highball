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
        <p className="eyebrow">Trust</p>
        <h2 className="h2">Self-reported, crew-verified</h2>
        <p className="p">
          Planters log their own numbers. Every day stays visible on the profile, so a padded number
          sits in plain sight next to the rest of the season, and anyone reading the board knows what a
          real 4,000 day looks like.
        </p>
        <p className="p">
          On top of that, crews can verify. Join your crew on Highball, and your foreman or checker can
          hold your logged days up against the tally sheet and mark each one{" "}
          <span className="vtick">✓ verified</span> or <span className="disputed">⚑ disputed</span>, with
          a note saying why. You can't mark your own days, and changing the count, date or ground on a
          checked day takes the mark off. Every crew is checked by Highball before it can verify anyone.
        </p>
        <p className="p">
          A planter is <b>crew verified</b> when at least 80% of their logged trees carry a verified mark
          and none of their days are disputed. Use the "Crew verified only" switch on the board to rank
          only those planters. Career trees carried in from before joining can't be verified, and
          neither help nor hurt that number. Gnar is worked out the same way for everyone, verified or
          not.
        </p>
      </section>
    </>
  );
}
