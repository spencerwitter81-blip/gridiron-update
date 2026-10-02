#!/usr/bin/env python3
"""Pull scores, standings, rankings and headlines from ESPN's public feeds
and write slimmed-down JSON files into site/data/ for the static site.

Runs hourly from .github/workflows/update.yml. Standard library only.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

SITE = "https://site.api.espn.com/apis/site/v2/sports"
STANDINGS = "https://site.api.espn.com/apis/v2/sports"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "data")

TEAMS = {
    "broncos": {"sport": "football/nfl", "id": "7", "label": "Denver Broncos"},
    "boston-college": {"sport": "football/college-football", "id": "103", "label": "Boston College Eagles"},
    "florida": {"sport": "football/college-football", "id": "57", "label": "Florida Gators"},
}
SEC_GROUP, ACC_GROUP = "8", "1"

errors = []


def get(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GridironUpdate/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                errors.append("%s -> %s" % (url, e))
                print("WARN", url, e, file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))


def logo_of(team):
    if not team:
        return None
    if team.get("logo"):
        return team["logo"]
    logos = team.get("logos") or []
    return logos[0]["href"] if logos else None


def score_of(c):
    s = c.get("score")
    if isinstance(s, dict):
        return s.get("displayValue")
    return s


def side(c):
    t = c.get("team", {})
    rank = (c.get("curatedRank") or {}).get("current")
    rec = None
    for r in c.get("records") or c.get("record") or []:
        if r.get("type") == "total" or r.get("name") in ("overall", "All Splits"):
            rec = r.get("summary") or r.get("displayValue")
            break
    return {
        "id": t.get("id"),
        "name": t.get("shortDisplayName") or t.get("displayName"),
        "full": t.get("displayName"),
        "abbr": t.get("abbreviation"),
        "logo": logo_of(t),
        "score": score_of(c),
        "rank": rank if rank and rank < 99 else None,
        "record": rec,
        "winner": c.get("winner"),
    }


def game(ev):
    comp = (ev.get("competitions") or [{}])[0]
    status = comp.get("status") or ev.get("status") or {}
    st = status.get("type", {})
    cs = comp.get("competitors", [])
    home = next((c for c in cs if c.get("homeAway") == "home"), cs[0] if cs else {})
    away = next((c for c in cs if c.get("homeAway") == "away"), cs[1] if len(cs) > 1 else {})
    bc = []
    for b in comp.get("broadcasts") or []:
        bc += b.get("names") or [((b.get("media") or {}).get("shortName"))]
    link = next((l["href"] for l in ev.get("links", []) if "summary" in (l.get("rel") or [])), None)
    if not link and ev.get("links"):
        link = ev["links"][0].get("href")
    odds = (comp.get("odds") or [{}])[0].get("details")
    return {
        "id": ev.get("id"),
        "date": ev.get("date"),
        "name": ev.get("shortName") or ev.get("name"),
        "state": st.get("state"),
        "detail": st.get("shortDetail") or st.get("detail"),
        "home": side(home),
        "away": side(away),
        "tv": ", ".join([x for x in bc if x]),
        "venue": (comp.get("venue") or {}).get("fullName"),
        "odds": odds,
        "neutral": comp.get("neutralSite"),
        "link": link,
        "week": (ev.get("week") or {}).get("text") or (ev.get("week") or {}).get("number"),
    }


def scoreboard(path, **params):
    q = "&".join("%s=%s" % kv for kv in params.items())
    d = get("%s/%s/scoreboard%s" % (SITE, path, ("?" + q) if q else ""))
    week = d.get("week", {}).get("number")
    season = d.get("season", {})
    return {
        "week": week,
        "season": season.get("year"),
        "games": [game(e) for e in d.get("events", [])],
    }


def news(path, limit=12, **params):
    params["limit"] = limit
    q = "&".join("%s=%s" % kv for kv in params.items())
    d = get("%s/%s/news?%s" % (SITE, path, q))
    out = []
    slug = "/%s/" % path.split("/")[-1]
    for a in d.get("articles", []):
        link = ((a.get("links") or {}).get("web") or {}).get("href") or ""
        if "team" in params and slug not in link:
            continue  # team feeds mix in other sports (e.g. basketball)
        img = next((i.get("url") for i in a.get("images", []) if i.get("url")), None)
        out.append({
            "headline": a.get("headline"),
            "desc": a.get("description"),
            "published": a.get("published"),
            "byline": a.get("byline"),
            "image": img,
            "link": link or None,
            "type": a.get("type"),
        })
    return out


def stat(entry, *types):
    for s in entry.get("stats", []):
        if s.get("type") in types:
            return s.get("displayValue")
    return None


def standings_rows(entries):
    rows = []
    for e in entries:
        t = e.get("team", {})
        rows.append({
            "id": t.get("id"),
            "name": t.get("displayName"),
            "short": t.get("shortDisplayName") or t.get("abbreviation"),
            "abbr": t.get("abbreviation"),
            "logo": logo_of(t),
            "overall": stat(e, "total"),
            "conf": stat(e, "vsconf"),
            "div": stat(e, "vsdiv"),
            "home": stat(e, "homerecord", "home"),
            "away": stat(e, "awayrecord", "road"),
            "pf": stat(e, "pointsfor"),
            "pa": stat(e, "pointsagainst"),
            "diff": stat(e, "pointdifferential", "differential"),
            "streak": stat(e, "streak"),
            "pct": stat(e, "winpercent", "leaguewinpercent"),
            "seed": stat(e, "playoffseed"),
        })
    return rows


def conf_rank_key(r):
    def wl(rec):
        try:
            w, l = rec.split("-")[:2]
            w, l = int(w), int(l)
            return (w / (w + l)) if (w + l) else 0.0, w
        except Exception:  # noqa: BLE001
            return 0.0, 0
    cp, cw = wl(r.get("conf") or "0-0")
    op, ow = wl(r.get("overall") or "0-0")
    return (-cp, -cw, -op, -ow)


def nfl_standings():
    d = get(STANDINGS + "/football/nfl/standings?level=3")
    confs = []
    for c in d.get("children", []):
        divs = []
        for dv in c.get("children", []):
            rows = standings_rows(dv.get("standings", {}).get("entries", []))
            rows.sort(key=lambda r: (-float(r["pct"] or 0), -int((r["overall"] or "0").split("-")[0])))
            divs.append({"name": dv.get("name"), "abbr": dv.get("abbreviation"), "rows": rows})
        confs.append({"name": c.get("name"), "abbr": c.get("abbreviation"), "divisions": divs})
    return confs


def cfb_standings(group):
    d = get(STANDINGS + "/football/college-football/standings?group=%s" % group)
    rows = standings_rows(d.get("standings", {}).get("entries", []))
    rows.sort(key=conf_rank_key)
    return {"name": d.get("name"), "rows": rows}


def rankings():
    d = get(SITE + "/football/college-football/rankings")
    out = {}
    for r in d.get("rankings", []):
        if r.get("name") not in ("AP Top 25", "AFCA Coaches Poll"):
            continue
        ranks = []
        for x in r.get("ranks", []):
            t = x.get("team", {})
            ranks.append({
                "rank": x.get("current"),
                "prev": x.get("previous"),
                "trend": x.get("trend"),
                "name": t.get("nickname") or t.get("location"),
                "full": (t.get("location", "") + " " + t.get("name", "")).strip(),
                "id": t.get("id"),
                "logo": logo_of(t),
                "record": x.get("recordSummary"),
                "points": x.get("points"),
                "fpv": x.get("firstPlaceVotes"),
            })
        out[r["name"]] = {"headline": r.get("headline") or r.get("shortHeadline"), "ranks": ranks}
    return out


def team_report(key, cfg):
    sport, tid = cfg["sport"], cfg["id"]
    t = get("%s/%s/teams/%s" % (SITE, sport, tid)).get("team", {})
    rec_items = (t.get("record") or {}).get("items", [])
    record = {}
    for it in rec_items:
        record[it.get("type")] = it.get("summary")
    stats = {}
    if rec_items:
        stats = {s["name"]: s["value"] for s in rec_items[0].get("stats", [])}
    sched = get("%s/%s/teams/%s/schedule" % (SITE, sport, tid))
    games = [game(e) for e in sched.get("events", [])]
    nxt = next((g for g in games if g["state"] != "post"), None)
    last = next((g for g in reversed(games) if g["state"] == "post"), None)
    return {
        "key": key,
        "id": tid,
        "name": t.get("displayName") or cfg["label"],
        "short": t.get("shortDisplayName"),
        "abbr": t.get("abbreviation"),
        "color": t.get("color"),
        "alt": t.get("alternateColor"),
        "logo": logo_of(t),
        "standing": t.get("standingSummary"),
        "rank": t.get("rank") if (t.get("rank") or 99) < 99 else None,
        "record": record,
        "ppg": round(stats.get("avgPointsFor", 0), 1) if stats else None,
        "papg": round(stats.get("avgPointsAgainst", 0), 1) if stats else None,
        "pf": stats.get("pointsFor"),
        "pa": stats.get("pointsAgainst"),
        "streak": stats.get("streak"),
        "season": (sched.get("season") or {}).get("displayName"),
        "schedule": games,
        "next": nxt,
        "last": last,
        "news": news(sport, 25, team=tid)[:12],
        "link": next((l["href"] for l in t.get("links", []) if "clubhouse" in (l.get("rel") or [])), None),
    }


def conference_news(standings, per_team=8, limit=15):
    """Merge each conference member's team feed, newest first, de-duplicated."""
    seen, out = set(), []
    for r in standings["rows"]:
        for a in news("football/college-football", per_team, team=r["id"]):
            key = a.get("link") or a.get("headline")
            if key in seen:
                continue
            seen.add(key)
            a["team"] = r["short"]
            out.append(a)
    out.sort(key=lambda a: a.get("published") or "", reverse=True)
    return out[:limit]


def golf_board(tour):
    d = get("%s/golf/%s/scoreboard" % (SITE, tour))
    evs = d.get("events", [])
    if not evs:
        return None
    ev = evs[0]
    comp = (ev.get("competitions") or [{}])[0]
    st = (comp.get("status") or ev.get("status") or {}).get("type", {})
    players = []
    for c in comp.get("competitors", []):
        a = c.get("athlete", {})
        strokes = [int(ls["value"]) for ls in c.get("linescores", []) if ls.get("value")]
        thru = None
        cur = (c.get("linescores") or [])
        if cur and cur[-1].get("linescores"):
            thru = len(cur[-1]["linescores"])
        players.append({
            "order": c.get("order"),
            "name": a.get("displayName"),
            "flag": (a.get("flag") or {}).get("href"),
            "country": (a.get("flag") or {}).get("alt"),
            "score": c.get("score"),
            "rounds": [int(ls["value"]) for ls in c.get("linescores", []) if ls.get("value") and ls["value"] > 50],
            "thru": thru,
            "total": sum(x for x in strokes if x > 50) or None,
        })
    players.sort(key=lambda p: p["order"] or 999)
    # Positions with ties (T2 etc.)
    pos_by_score = {}
    for i, p in enumerate(players):
        pos_by_score.setdefault(p["score"], []).append(i + 1)
    for p in players:
        same = pos_by_score.get(p["score"], [])
        p["pos"] = ("T%d" % same[0]) if len(same) > 1 else str(same[0]) if same else ""
    return {
        "tour": tour,
        "name": ev.get("name"),
        "date": ev.get("date"),
        "end": ev.get("endDate"),
        "state": st.get("state"),
        "detail": st.get("shortDetail") or st.get("detail"),
        "players": players[:40],
        "field": len(players),
        "link": next((l["href"] for l in ev.get("links", [])), None),
    }


def write(name, obj):
    path = os.path.join(OUT, name + ".json")
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print("wrote", path, os.path.getsize(path), "bytes")


def main():
    os.makedirs(OUT, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ---------- NFL ----------
    nfl = {
        "scoreboard": scoreboard("football/nfl"),
        "standings": nfl_standings(),
        "news": news("football/nfl", 16),
    }
    write("nfl", nfl)

    # ---------- College football ----------
    sec = cfb_standings(SEC_GROUP)
    acc = cfb_standings(ACC_GROUP)
    cfb = {
        "rankings": rankings(),
        "sec": {"standings": sec, "scoreboard": scoreboard("football/college-football", groups=SEC_GROUP),
                "news": conference_news(sec)},
        "acc": {"standings": acc, "scoreboard": scoreboard("football/college-football", groups=ACC_GROUP),
                "news": conference_news(acc)},
        "top25": scoreboard("football/college-football"),
        "news": news("football/college-football", 16),
    }
    write("cfb", cfb)

    # ---------- Featured teams ----------
    for key, cfg in TEAMS.items():
        write(key, team_report(key, cfg))

    # ---------- Golf ----------
    golf = {"tours": [], "news": news("golf/pga", 16)}
    for tour, label in (("pga", "PGA TOUR"), ("lpga", "LPGA"), ("eur", "DP World Tour"),
                        ("liv", "LIV Golf"), ("champions-tour", "PGA TOUR Champions")):
        b = golf_board(tour)
        if b and b["players"]:
            b["label"] = label
            golf["tours"].append(b)
    write("golf", golf)

    # ---------- Lacrosse ----------
    lax = {"leagues": []}
    for path, label in (("lacrosse/pll", "Premier Lacrosse League"),
                        ("lacrosse/mens-college-lacrosse", "NCAA Men's Lacrosse"),
                        ("lacrosse/womens-college-lacrosse", "NCAA Women's Lacrosse"),
                        ("lacrosse/nll", "National Lacrosse League")):
        lax["leagues"].append({
            "key": path.split("/")[1],
            "label": label,
            "scoreboard": scoreboard(path),
            "news": news(path, 10),
        })
    write("lacrosse", lax)

    write("meta", {"updated": now, "errors": errors[:20]})
    print("done; %d errors" % len(errors))


if __name__ == "__main__":
    main()
