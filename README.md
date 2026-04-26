# Job Scout 🎯

Runs 2x/day via GitHub Actions. Searches for new remote Frontend/UI EM roles, emails a digest to you.

**Cost:** ~$0.05–0.15/day (Anthropic API: $10/1000 web searches + Haiku token costs)

---

## Deploy in 10 Minutes

### Step 1 — Get your Anthropic API Key

1. Go to https://console.anthropic.com/settings/keys
2. Click **Create Key**
3. Copy it — you'll use it in Step 3

---

### Step 2 — Get a Gmail App Password

> Gmail blocks regular passwords for SMTP. You need an App Password.

1. Go to https://myaccount.google.com/security
2. Under "How you sign in to Google" → enable **2-Step Verification** (if not already on)
3. Go to https://myaccount.google.com/apppasswords
4. Name it "Job Scout" → click **Create**
5. Copy the 16-character password shown — you'll use it in Step 3

---

### Step 3 — Create the GitHub repo and add Secrets

1. Go to https://github.com/new
2. Name it `job-scout`, set to **Private**, click **Create repository**
3. Push this code to it:
   ```bash
   cd job-scout
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/YOUR_USERNAME/job-scout.git
   git push -u origin main
   ```
4. In your repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Add `ANTHROPIC_API_KEY` → paste your key from Step 1
   - Add `GMAIL_USER` → your Gmail address (e.g. tikigogreen@gmail.com)
   - Add `GMAIL_APP_PASSWORD` → paste the 16-char password from Step 2

---

### Step 4 — Enable Actions and Test

1. In your repo → click **Actions** tab
2. You should see **Job Scout** workflow listed
3. Click it → click **Run workflow** → **Run workflow** (green button)
4. Watch it run — check your inbox in ~2 minutes

That's it. It now runs automatically at **8am and 6pm Mountain Time** every day.

---

## Updating the Applied Companies List

Edit `search.js` and add companies to the `APPLIED_COMPANIES` array:

```js
const APPLIED_COMPANIES = [
  "Figma",
  "Airbnb",
  "YourNewCompany", // ← add here
  ...
];
```

Commit and push — takes effect on the next run.

---

## Change the Schedule

Edit `.github/workflows/job-search.yml`. Times are in UTC.

| MT Time | UTC Cron |
|---------|----------|
| 8am MT (summer) | `0 14 * * *` |
| 6pm MT (summer) | `0 0 * * *` |
| 8am MT (winter) | `0 15 * * *` |
| 6pm MT (winter) | `0 1 * * *` |

---

## Run Locally (for testing)

```bash
export ANTHROPIC_API_KEY=your_key_here
export GMAIL_USER=tikigogreen@gmail.com
export GMAIL_APP_PASSWORD=your_app_password

node search.js
```
