# Highball

The global tree planters' board. Planters create a profile, log their days, and earn **Gnar** —
a score that weights tree counts against the ground they came off, seasons planted, and
day-to-day consistency.

React + Vite on the front, Supabase (Postgres + auth) on the back. No server to run.

---

## Getting it live

Budget about an hour. Two accounts needed, both free to start: Supabase and Vercel.

### 1. Create the database

1. Sign up at [supabase.com](https://supabase.com) and create a project. Save the database
   password somewhere — you won't need it for this app, but you'll want it later.
2. Open **SQL Editor → New query**.
3. Paste the whole contents of `supabase/migrations/0001_init.sql` and hit **Run**.

That creates the `planters` and `days` tables, the `board` view that computes Gnar, and the
row-level security policies that stop anyone editing a profile that isn't theirs.

### 2. Turn on email sign-in

In the Supabase dashboard:

- **Authentication → Providers → Email** — make sure it's enabled. Magic links work out of the box.
- **Authentication → URL Configuration** — set **Site URL** to your domain once you have one
  (`http://localhost:5173` while you're developing). Add both to **Redirect URLs**.

Supabase's built-in email sender is rate-limited to a handful of messages an hour, which is fine
for testing and not fine for launch. Before you have real users, add an SMTP provider under
**Project Settings → Authentication → SMTP Settings** — Resend and Postmark both have free tiers.

### 3. Run it locally

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The anon key is meant to be public — it ships in the browser bundle. Row-level security is what
protects the data, not key secrecy. Never put the `service_role` key in this file.

```bash
npm run dev
```

Open http://localhost:5173.

### 4. Deploy

```bash
git init && git add -A && git commit -m "Highball"
gh repo create highball --private --source=. --push
```

Then at [vercel.com](https://vercel.com): **Add New → Project**, import the repo. Vercel detects
Vite automatically. Before deploying, add the same two environment variables under
**Environment Variables**. Deploy.

`vercel.json` handles SPA routing so that `/p/ditchpig` loads properly on a hard refresh instead
of 404ing.

### 5. Point a domain at it

Buy one anywhere (Namecheap, Cloudflare, Porkbun — roughly $15/year). In Vercel: **Settings →
Domains → Add**, then follow the DNS instructions. Go back to Supabase and update **Site URL**
and **Redirect URLs** to the real domain, or sign-in links will bounce people to localhost.

---

## How it's put together

```
src/
  lib/supabase.js     client, plus a flag for missing config
  lib/api.js          every database call lives here, with readable error messages
  lib/gnar.js         terrain labels, sort options, patches, Gnar preview
  components/
    Board.jsx         the leaderboard, sortable four ways
    Sheet.jsx         public profile at /p/:handle
    Camp.jsx          profile form, day logging, delete
    SignIn.jsx        magic link
    Scoring.jsx       the Gnar formula, in the open
    Setup.jsx         shown when env vars are missing
supabase/migrations/
  0001_init.sql       schema, Gnar view, RLS policies
```

**Gnar is computed in Postgres**, in the `board` view. Sorting happens in the database, so the
browser never downloads every planter's history to rank them. `src/lib/gnar.js` mirrors the
terrain multipliers for display and for the "+47 Gnar" preview on the day form — if you change a
multiplier, change it in both places.

**Rules the database enforces**, not just the interface:

- one profile per account (`one_profile_per_person`)
- one entry per date per planter (`one_entry_per_day`)
- camp names unique regardless of casing
- 1–12,000 trees per day, no future dates
- you can only write rows that belong to you (RLS)

---

## What to think about before you promote it

**Self-reported numbers.** Nothing here verifies a tally. Once there's status attached to the top
of a board, some numbers get generous. The current design leans on transparency — every logged
day stays visible on the profile, so an invented 5,000 day sits next to a season of 2,200s and
looks like what it is. If that stops being enough, the usual next steps are crew verification (a
company vouches for its planters), a photo of the day sheet above some threshold, or a
flag-and-review queue.

**Season boundaries.** "This season" currently means the calendar year, which suits the northern
hemisphere. Planters in Chile, New Zealand or southern Africa plant across a year boundary. If
they show up in numbers, you'll want a `seasons` table with real start and end dates per region
rather than `extract(year from date)`.

**Rate limiting.** Supabase's free tier handles a few thousand planters comfortably. The board
query is capped at 200 rows; past that, add pagination or a country filter rather than raising
the cap.

**Profile link previews.** Sharing `/p/ditchpig` to Instagram currently shows the generic site
card, because this is a client-rendered SPA. Per-profile preview images need server rendering —
Next.js, or a small Vercel edge function that serves meta tags to crawlers.
