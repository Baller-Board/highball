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
3. **New project:** paste all of `supabase/setup_all.sql` and hit **Run**. That's everything in
   one go. (It's the three files below, joined.)

   **Or** run the three files in `supabase/migrations/` **in order**: paste each one's contents and
   hit **Run**, then the next.
   - `0001_init.sql`: the `planters` and `days` tables, the `board` view that computes Gnar, and
     the row-level security policies that stop anyone editing a profile that isn't theirs.
   - `0002_hardening.sql`: tighter limits (text lengths, clean camp names, no dates before 1990).
   - `0003_crews.sql`: crews and crew verification.

   Already ran `0001` on a live project? Just run `0002` and `0003`. Nothing existing is lost.

4. Make yourself an admin, so you can approve crews. Sign in to the app once first, then run
   this in the SQL editor with your sign-in email:

   ```sql
   insert into site_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   An **Admin** tab appears in the nav for you.

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

Supabase labels the key either **Publishable key** (starts `sb_publishable_`) or, on older
projects, **anon public**. Either works. The key is meant to be public — it ships in the browser bundle. Row-level security is what
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
    Crews.jsx         list of approved crews
    NewCrew.jsx       register a crew
    Crew.jsx          crew page: roster, join requests, day checking, checkers
    Admin.jsx         approve or reject new crews
    Setup.jsx         shown when env vars are missing
supabase/migrations/
  0001_init.sql       schema, Gnar view, RLS policies
  0002_hardening.sql  tighter limits on what can be written
  0003_crews.sql      crews, membership, verification marks
supabase/tests/
  rules_test.sql      acts as different users and checks every rule holds
```

## Crew verification

1. **Anyone signed in can register a crew.** It stays hidden until a Highball admin approves it on
   the Admin page. That approval is the whole trust model, so only approve outfits you're
   satisfied are real.
2. **Planters ask to join** from the crew's page (`/c/<crew-link>`). The owner or a checker accepts.
3. **Owners and checkers check the tally.** Every unchecked day from their members shows up on the
   crew page. They tick days and mark them **verified**, or **disputed** with a note the public
   can see.
4. **The board shows it.** A planter is *crew verified* (✓) when at least 80% of their logged trees
   are verified and none of their days are disputed. The board has a "Crew verified only" switch.

What the database guarantees, whatever someone does with the API:

- planters can't mark their own days; the verdict columns aren't writable by them at all
- changing the count, date or ground on a checked day wipes its mark
- a crew can only judge days of its own active members, never the checker's own days, and never
  overwrite another crew's mark
- pending or rejected crews can't verify anything; renaming an approved crew sends it back to review
- only the owner can add or remove checkers; only admins can approve crews

Gnar itself is unchanged and the same for everyone. Verification sits next to it, not inside it.

## Testing the database rules

`npm run test:db` loads every migration into a scratch database and runs 41 checks as different
users (anonymous, planter, crew owner, stranger, admin). It needs a local Postgres you can reach
as a superuser (set `PGHOST`, `PGPORT`, `PGUSER` as usual). It uses a small stand-in for
Supabase's auth (`supabase/tests/supabase_stub.sql`); never run that file on your real project.

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

**Self-reported numbers.** Crew verification covers planters whose crew is on Highball. Everyone
else is still on the honour system, and the default board still ranks everyone. If inflation
becomes a problem, options are: make "Crew verified only" the default view, count only verified
trees toward Gnar, or add a flag-and-review queue for freelancers.

**Sign-up spam.** Anyone with an email can make a profile. Before launch, turn on CAPTCHA under
**Authentication → Attack Protection** in Supabase (hCaptcha or Cloudflare Turnstile).

**Deleting a profile keeps the sign-in.** "Pull my profile off the board" removes the profile and
every day, but the email stays in Supabase's auth table. If someone asks for their account to be
fully erased, delete them under **Authentication → Users**.

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
