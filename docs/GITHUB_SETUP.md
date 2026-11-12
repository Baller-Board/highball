# Putting Highball on GitHub

GitHub holds the code. Netlify watches it, so every change you push goes live automatically about a
minute later. You do this once.

**Time:** about 10 minutes. **Cost:** free.

---

## Step 1 — Make a GitHub account

Skip this if you have one.

1. Go to [github.com/signup](https://github.com/signup) and sign up.
2. Pick a username you're happy for people to see. It shows in the repo's address
   (`github.com/yourname/highball`).
3. Verify your email.

## Step 2 — Create an empty repository

1. Go to [github.com/new](https://github.com/new).
2. Fill in:

   | Field | What to enter |
   |---|---|
   | Repository name | `highball` |
   | Description | `The global tree planters' board` (optional) |
   | Visibility | **Private** |
   | Add a README file | **Leave unticked** |
   | Add .gitignore | **None** |
   | Choose a license | **None** |

3. Click **Create repository**.

The repo needs to be **empty**. The project already has its own README and .gitignore. If you tick
any of those boxes, GitHub adds a first commit of its own, and the first push gets refused.

You'll land on a page that says "Quick setup". Keep it open. Your repo's address is at the top,
e.g. `https://github.com/yourname/highball.git`.

## Step 3 — Get the code into it

Pick **one** of these.

### Option A: Claude pushes it for you (easiest)

1. Go to [claude.ai/connect-github](https://claude.ai/connect-github) and connect your GitHub
   account.
2. When GitHub asks which repositories the Claude app can access, choose **Only select
   repositories** and pick `highball`.
3. Tell Claude the repo name (`yourname/highball`). Claude pushes the code.

### Option B: GitHub Desktop (no command line)

1. Install [GitHub Desktop](https://desktop.github.com) and sign in with your GitHub account.
2. Unzip `highball-v2.zip`. You get a `highball` folder, which already contains the full history.
3. In GitHub Desktop: **File → Add local repository** → choose the `highball` folder.
4. **Repository → Repository settings → Remote**. Paste the address from Step 2
   (`https://github.com/yourname/highball.git`) and click **Save**.
5. Click **Push origin** at the top.

### Option C: Command line

You need [git](https://git-scm.com/downloads) installed. Unzip `highball-v2.zip`, open a terminal
in the `highball` folder, then run these with your own address from Step 2:

```bash
git remote add origin https://github.com/yourname/highball.git
git push -u origin main
```

GitHub asks you to sign in the first time. The easiest way is the
[GitHub CLI](https://cli.github.com): run `gh auth login` once, then push. A plain password won't
work. GitHub requires a token or the CLI.

## Step 4 — Check it worked

Refresh your repo page on GitHub. You should see:

- folders `src`, `supabase`, `scripts`, `docs`, `.github`, and `README.md` shown below them
- **4 commits** (the clock icon near the top right)
- after a minute or two, a **green tick** next to the latest commit

The green tick means the automatic checks passed:

- **build:** the site compiles, the same way Netlify will build it
- **rules:** every database migration applies, and all 41 permission checks pass

A **red X** means a check failed. Click it to see which one and why. A yellow dot means it's still
running.

## Step 5 — Recommended settings

All under your repo's **Settings** tab. None are required to go live.

- **Code security → Dependabot alerts: On.** GitHub emails you when a library the app uses has a
  known security hole. Dependabot already opens a monthly pull request with updates (set up in
  `.github/dependabot.yml`).
- **Code security → Secret scanning: On**, if it's offered. It catches keys pasted into the code
  by mistake.
- **Branches → Add branch protection rule** for `main`, with "Require status checks to pass".
  Only worth it once someone else is working on the code with you.

## What never goes in the repo

- `.env.local`, which holds your Supabase keys for running locally. It's already in
  `.gitignore`, so git skips it.
- The Supabase **secret** or **service_role** key. It must never be in the code or in Netlify. The
  app only ever uses the publishable key, which is safe to be public.
- Your database password.

On Netlify, the two keys go in **Site configuration → Environment variables**, not in the code.

## Next

Connect Netlify to the repo. Steps 2–4 of "Getting it live" in the [README](../README.md) cover it.

---

## What's in the repo for GitHub

| File | What it does |
|---|---|
| `.github/workflows/ci.yml` | Runs the build and the database rule checks on every push |
| `.github/dependabot.yml` | Opens a monthly pull request with library updates |
| `.nvmrc` + `engines` in `package.json` | Pin Node 22, so your computer, GitHub and Netlify build the same way |
| `.gitattributes` | Keeps scripts working if someone clones on Windows |
| `.gitignore` | Keeps keys, `node_modules` and build output out of the repo |
