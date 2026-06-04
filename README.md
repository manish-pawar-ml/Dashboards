# Claude Spend Intelligence — Leadership Dashboard

An interactive, dark-mode dashboard for reviewing Claude usage and gross spend across the
organization. Built as a fully static site (HTML/CSS/JS + Chart.js via CDN) so it can be
hosted directly on **GitHub Pages** with no build step.

## What it shows

Select an **L1 Leader** to scope the entire dashboard to that org. Within scope you get:

1. **Total gross spend** across the selected org (headline KPI).
2. **L2 Leader pivot** — spend, people, % of scope, tokens, requests, and avg per person for each sub-team, with a *Spend by L2 Leader* chart.
3. **Tokens by model** — total tokens (prompt + completion) grouped by model.
4. **People in scope** — searchable, sortable, paginated list of every employee under the leader.

Plus: six KPI cards, an auto-generated **Signals & Insights** strip (lead team, top spender,
workhorse model, spend concentration, leading surface), and *Spend by Product* / *Top Spenders*
charts. Additional dynamic filters: **L2 sub-team**, **product**, and **model**. No pie charts — bar/column views only.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Dark executive theme |
| `app.js` | Filters, KPIs, charts, tables, insights |
| `data.js` | The dataset embedded as a JS variable (no fetch needed) |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Deploy on GitHub Pages (Enterprise)

1. In your repo, click **Add file → Upload files** and drag in all five files above
   (keep them at the repo root, or in a `/docs` folder).
2. Commit to your default branch.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source = Deploy from a branch**, pick your branch
   and either `/ (root)` or `/docs` to match where you uploaded the files. Save.
5. Wait ~1 minute, then open the published URL shown on that page.

> On GitHub Enterprise the URL looks like `https://pages.<your-enterprise-host>/<org>/<repo>/`.
> Pages may be restricted to internal/private visibility depending on org policy — which is
> appropriate for this data.

## Refreshing the data

The data lives in `data.js` as `window.SPEND_DATA`. To update it later, regenerate that file
from a new export (same column names) and re-upload it — nothing else needs to change.

## Notes

- Works offline too: because the data is embedded (not fetched), you can open `index.html`
  directly in a browser without a server.
- Chart.js loads from `cdn.jsdelivr.net`. If your environment blocks external CDNs, download
  `chart.umd.min.js` and reference it locally instead.
- Rows without a resolved L1/L2 leader are bucketed as **Unassigned** / **— Direct / Unassigned**
  so nothing is silently dropped.
