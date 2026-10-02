# Gridiron Update

A throwback, early-2000s sports-portal-style site focused on football, with golf and lacrosse on the side.

**Football:** NFL, SEC, ACC, Denver Broncos, Boston College, and Florida Gators
**Also:** Golf (PGA TOUR, LPGA, DP World Tour, LIV, Champions) and Lacrosse (PLL, NLL, NCAA men's and women's)

## How it updates

`.github/workflows/update.yml` runs **every hour** (and on every push to `main`). It:

1. runs `scripts/fetch_data.py`, which pulls scoreboards, standings, AP/Coaches polls, team schedules and headlines from ESPN's public JSON feeds into `site/data/*.json`
2. publishes the `site/` folder to GitHub Pages

Open pages in the browser also re-check for new data every 10 minutes.

To force an update right away, go to **Actions → Hourly update & deploy → Run workflow**, or run:

```bash
gh workflow run update.yml
```

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Top story, My Teams cards, headlines, NFL/SEC/ACC scoreboards, AP Top 25, golf & lacrosse snapshots |
| `nfl.html` | Weekly scoreboard, all 8 division standings, NFL headlines |
| `college-football.html` | Top 25 scoreboard, AP & Coaches polls, headlines |
| `sec.html` / `acc.html` / `big-ten.html` / `big-12.html` | Conference scoreboard, full standings, ranked teams, conference headlines |
| `broncos.html` / `boston-college.html` / `florida.html` | Record, splits, scoring, last/next game, full schedule, standings, team news |
| `fantasy.html` | Your fantasy roster: ESPN PPR/standard points by week, Week projections, matchups, injury status, season stats, player notes & news |
| `golf.html` | Tabbed tour leaderboards and golf headlines |
| `lacrosse.html` | PLL, NLL, NCAA scores and headlines |

## Run locally

```bash
python3 scripts/fetch_data.py && python3 -m http.server 8000 -d site
```

## Notes

- GitHub pauses scheduled workflows in repos with no activity for 60 days. If updates stop, click **Enable workflow** on the Actions tab (or push any commit).
- GitHub's hourly schedule can run a few minutes late during busy periods.
- Data comes from ESPN's unofficial public endpoints; if a feed changes shape, the site shows whatever loaded and skips the rest.
