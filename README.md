# Job Scout v2 🎯

Four automated systems running on GitHub Actions. All share `applied.json` as the single source of truth.

## What's Running

| Script | Schedule | What it does |
|--------|----------|--------------|
| `search.js` | 8am + 6pm MT | Searches web for new remote Frontend EM roles, emails digest |
| `tracker.js` | 9am MT daily | Emails pipeline status table + drafts follow-ups for 14+ day silence |
| `monitor.js` | 7am + 1pm + 7pm MT | Watches specific company career pages, alerts on new roles |
| `add-application.js` | Manual trigger | Logs a new application to `applied.json`, commits, sends confirmation |

## Setup (first time)

Secrets needed in **GitHub → Settings → Secrets → Actions:**

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | From console.anthropic.com/settings/keys |
| `GMAIL_USER` | tikigogreen@gmail.com |
| `GMAIL_APP_PASSWORD` | From myaccount.google.com/apppasswords |

## Upgrade from v1

```bash
# In your existing job-scout repo, replace all files with v2 content
# then push
git add .
git commit -m "upgrade to v2 — full job search system"
git push
```

---

## How to Log a New Application (Feature #1)

Go to **Actions → ✅ Log Application → Run workflow**

Fill in:
- Company name
- Role title  
- Status (applied / interviewing / offer / rejected / silent)
- URL (optional)

Hit **Run workflow**. It will:
1. Add entry to `applied.json` and commit it
2. Exclude that company from future search results automatically
3. Email you a confirmation

---

## How to Update Application Status

Edit `applied.json` directly in GitHub (pencil icon) and change the `status` field:
- `applied` — submitted, waiting
- `interviewing` — active process
- `offer` — offer received
- `rejected` — closed/rejected
- `silent` — manually flagged as dead

---

## How to Watch New Companies (Feature #4)

Edit `watchlist.json` and add an entry:
```json
{ "company": "NewCo", "url": "https://newco.com/careers" }
```

---

## File Structure

```
job-scout/
  applied.json          ← source of truth for all applications
  watchlist.json        ← companies to monitor for new roles
  monitor-cache.json    ← auto-generated, tracks seen roles (do not edit)
  search.js             ← job search digest
  tracker.js            ← silence detector + follow-up drafts
  monitor.js            ← career page watcher
  add-application.js    ← log new application via workflow_dispatch
  email.js              ← shared email utility
  .github/workflows/
    job-search.yml
    tracker.yml
    monitor.yml
    add-application.yml
```

## Cost Estimate

~$0.10–0.25/day total for all four scripts at current usage.
