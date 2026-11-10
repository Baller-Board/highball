// Terrain labels for the interface. The multipliers themselves are
// authoritative in the database (terrain_factor in 0001_init.sql) —
// these mirror them so the picker can show what each one is worth.
export const TERRAIN = {
  cream:  { label: "Cream",           factor: 1.0,  blurb: "Flat, clean, straight-line planting." },
  block:  { label: "Cut block",       factor: 1.25, blurb: "Standard logged ground." },
  slash:  { label: "Slash / schnarb", factor: 1.5,  blurb: "Deep debris, brutal footing." },
  burn:   { label: "Burn",            factor: 1.75, blurb: "Charred ground, ash, no shade." },
  alpine: { label: "Steep / alpine",  factor: 2.0,  blurb: "Mountain faces and rock." },
};

export const SORTS = [
  { key: "gnar",         label: "Gnar index",   unit: "GNAR"  },
  { key: "career_trees", label: "Career trees", unit: "TREES" },
  { key: "season_trees", label: "This season",  unit: "TREES" },
  { key: "best_day",     label: "Best day",     unit: "TREES" },
];

export const SEASON = new Date().getFullYear();

export const nf = (n) => Math.round(Number(n) || 0).toLocaleString();

// Today's date where the planter is, as YYYY-MM-DD. toISOString() gives the
// UTC date, which in the Americas flips to tomorrow every afternoon — exactly
// when planters sit down to log the day.
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Turn a crew name into a URL slug: "Nechako Planting Ltd." -> "nechako-planting-ltd"
export function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

// Preview of what a day is worth, so the form can show it before saving.
export function gnarPreview(row, trees, terrain) {
  if (!row || !trees) return 0;
  const f = TERRAIN[terrain]?.factor || 1;
  const logged = Number(row.logged_trees) + trees;
  const career = Number(row.prior_trees) + logged;
  const best = Math.max(Number(row.best_day), trees);
  const count = Number(row.day_count) + 1;
  const avg = logged / count;
  const ground =
    (Number(row.ground_factor) * Number(row.logged_trees) + trees * f) / (logged || 1);
  const next = Math.round(
    best / 50 + Math.sqrt(career / 1000) * 3 + Number(row.seasons) * 6 + (ground - 1) * 60 + avg / 60
  );
  return Math.max(0, next - Number(row.gnar));
}

export function patches(row) {
  const out = [];
  if (row.crew_verified) out.push(["Crew verified", "gold"]);
  const best = Number(row.best_day);
  const career = Number(row.career_trees);
  const seasons = Number(row.seasons);
  const ground = Number(row.ground_factor);

  if (best >= 5000) out.push(["5K day", "gold"]);
  else if (best >= 4000) out.push(["4K day", "gold"]);
  else if (best >= 3000) out.push(["3K day", ""]);
  else if (best >= 2000) out.push(["2K day", ""]);

  if (career >= 1000000) out.push(["Million tree club", "gold"]);
  else if (career >= 500000) out.push(["Half million", "gold"]);
  else if (career >= 100000) out.push(["100K club", ""]);

  if (seasons >= 10) out.push(["Lifer · 10 seasons", "gold"]);
  else if (seasons >= 5) out.push(["Vet · 5 seasons", ""]);

  if (ground >= 1.7) out.push(["Burn rat", ""]);
  else if (ground >= 1.45) out.push(["Schnarb slayer", ""]);

  if (Number(row.day_count) >= 100) out.push(["100 days logged", ""]);
  return out;
}
