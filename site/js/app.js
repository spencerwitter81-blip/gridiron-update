/* Gridiron Update — renders every page from the hourly JSON in /data */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page") || "home";
  var FILES = ["meta", "nfl", "cfb", "broncos", "boston-college", "florida", "fantasy", "golf", "lacrosse"];
  var MY_IDS = { "7": "broncos", "103": "boston-college", "57": "florida" };
  var D = {};

  // One primary menu. Conference pages live under College Football's sub-menu.
  var NAV = [
    ["home", "index.html", "Home"],
    ["nfl", "nfl.html", "NFL"],
    ["cfb", "college-football.html", "College Football"],
    ["broncos", "broncos.html", "Broncos"],
    ["boston-college", "boston-college.html", "Boston College"],
    ["florida", "florida.html", "Gators"],
    ["fantasy", "fantasy.html", "Fantasy"],
    ["golf", "golf.html", "Golf"],
    ["lacrosse", "lacrosse.html", "Lacrosse"]
  ];
  var CFB_SUB = [
    ["cfb", "college-football.html", "Top 25 & Polls"],
    ["sec", "sec.html", "SEC"],
    ["acc", "acc.html", "ACC"],
    ["big10", "big-ten.html", "Big Ten"],
    ["big12", "big-12.html", "Big 12"]
  ];
  var CONF_PAGES = { sec: "sec.html", acc: "acc.html", big10: "big-ten.html", big12: "big-12.html" };
  var CONF_LABEL = { sec: "SEC", acc: "ACC", big10: "Big Ten", big12: "Big 12" };
  var SECTION = PAGE in CONF_PAGES ? "cfb" : PAGE;

  // Remembered tab choices (per viewer, per browser). Pages work fine without storage.
  var TABS = {};
  try { TABS = JSON.parse(localStorage.getItem("gu-tabs") || "{}") || {}; } catch (e) { TABS = {}; }
  function saveTabs() { try { localStorage.setItem("gu-tabs", JSON.stringify(TABS)); } catch (e) { /* storage unavailable */ } }

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function url(u) { return u && /^https?:\/\//.test(u) ? esc(u) : "#"; }
  // Links that leave the site open in a new tab and get a small ↗ (via CSS) so that's never a surprise.
  function ext(u, inner, cls) {
    if (!u) return inner;
    return '<a href="' + url(u) + '" target="_blank" rel="noopener"' + (cls ? ' class="' + cls + '"' : "") + ' title="Opens on ESPN.com in a new tab">' + inner + "</a>";
  }
  function img(src, alt, cls) { return src ? '<img src="' + url(src) + '" alt="' + esc(alt || "") + '"' + (cls ? ' class="' + cls + '"' : "") + ' loading="lazy">' : ""; }
  function fmtDate(iso, withTime) {
    if (!iso) return "";
    var d = new Date(iso);
    var o = { weekday: "short", month: "numeric", day: "numeric" };
    if (withTime !== false) { o.hour = "numeric"; o.minute = "2-digit"; }
    return d.toLocaleString([], o);
  }
  function ago(iso) {
    if (!iso) return "";
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + " hr ago";
    var dd = Math.round(h / 24);
    return dd + (dd === 1 ? " day ago" : " days ago");
  }
  function box(title, inner, o) {
    o = o || {};
    var link = o.link ? '<a href="' + o.link[0] + '">' + esc(o.link[1]) + " &raquo;</a>" : "";
    return '<div class="box"' + (o.id ? ' id="' + o.id + '"' : "") + '><h3 class="' + (o.cls || "") + '"><span>' + title + "</span>" + link + "</h3>" +
      '<div class="in">' + inner + "</div>" + (o.foot ? '<div class="foot">' + o.foot + "</div>" : "") + "</div>";
  }
  function empty(msg) { return '<div class="empty">' + esc(msg) + "</div>"; }
  // A box whose body switches between tabs; the chosen tab is remembered under `key`.
  function tabsBox(key, title, tabs, o) {
    tabs = tabs.filter(Boolean);
    var on = Math.min(+TABS[key] || 0, tabs.length - 1);
    var bar = '<div class="tabs" role="tablist">' + tabs.map(function (t, i) {
      return '<button type="button" role="tab" data-tg="' + key + '" data-ti="' + i + '" aria-selected="' + (i === on) + '" class="' + (i === on ? "on" : "") + '">' + esc(t.label) + "</button>";
    }).join("") + "</div>";
    var panes = tabs.map(function (t, i) {
      return '<div role="tabpanel" data-tp="' + key + '" data-ti="' + i + '"' + (i === on ? "" : " hidden") + ">" + t.html +
        (t.more ? '<div class="morelink"><a href="' + t.more[0] + '">' + esc(t.more[1]) + " &rsaquo;</a></div>" : "") + "</div>";
    }).join("");
    return box(title, bar + panes, o);
  }

  /* ---------------- news ---------------- */
  function heads(arr, n) {
    if (!arr || !arr.length) return empty("No headlines right now.");
    return '<ul class="heads">' + arr.slice(0, n || 10).map(function (a) {
      return "<li>" + (a.team ? '<span class="tag">' + esc(a.team) + "</span>" : "") +
        ext(a.link, esc(a.headline)) + ' <span class="time">' + ago(a.published) + "</span></li>";
    }).join("") + "</ul>";
  }
  function stories(arr, n) {
    if (!arr || !arr.length) return empty("No stories right now.");
    return arr.slice(0, n || 8).map(function (a) {
      return '<div class="story' + (a.image ? "" : " noimg") + '">' + (a.image ? ext(a.link, img(a.image, ""), "noarrow") : "") +
        "<div><h5>" + (a.team ? '<span class="kicker">' + esc(a.team) + "</span> " : "") + ext(a.link, esc(a.headline)) + "</h5>" +
        "<p>" + esc(a.desc || "") + ' <span class="time">' + ago(a.published) + "</span></p></div></div>";
    }).join("");
  }
  function leadStory(a, kicker) {
    if (!a) return "";
    return '<div class="lead">' + (a.image ? ext(a.link, img(a.image, a.headline), "noarrow") : "") +
      '<div><div class="kicker">' + esc(kicker || "Top Story") + "</div><h1>" + ext(a.link, esc(a.headline)) + "</h1>" +
      "<p>" + esc(a.desc || "") + '</p><div class="time">' + esc(a.byline || "") + (a.byline ? " &middot; " : "") + ago(a.published) + "</div></div></div>";
  }

  /* ---------------- scores ---------------- */
  function teamLine(t, g, post) {
    var cls = "tm";
    if (post && t.winner === true) cls += " w";
    else if (post && t.winner === false) cls += " l";
    if (MY_IDS[t.id]) cls += " mine";
    var showScore = g.state !== "pre";
    return '<div class="' + cls + '">' + img(t.logo, "") +
      (t.rank ? '<span class="rk">' + t.rank + "</span>" : "") +
      '<span class="n">' + esc(t.name) + (t.record ? ' <span class="r">(' + esc(t.record) + ")</span>" : "") + "</span>" +
      '<span class="s">' + (showScore ? esc(t.score) : "") + "</span></div>";
  }
  function scoreCard(g) {
    var post = g.state === "post", live = g.state === "in";
    var st = post ? "final" : live ? "live" : "";
    var label = g.state === "pre" ? fmtDate(g.date) : g.detail;
    var cta = post ? "Recap" : live ? "Gamecast" : "Preview";
    var inner = '<div class="st ' + st + '"><span>' + (live ? '<span class="dot"></span>' : "") + esc(label) + "</span>" +
      (g.link ? '<span class="cta">' + cta + "</span>" : "") + "</div>" +
      teamLine(g.away, g, post) + teamLine(g.home, g, post) +
      '<div class="ex"><span>' + esc(g.tv || "") + "</span><span>" + esc(g.state === "pre" ? (g.odds || "") : "") + "</span></div>";
    return g.link ? '<a class="sc noarrow" href="' + url(g.link) + '" target="_blank" rel="noopener" title="' + cta + ' on ESPN.com (new tab)">' + inner + "</a>"
      : '<div class="sc">' + inner + "</div>";
  }
  function scores(sb, max) {
    if (!sb || !sb.games || !sb.games.length) return empty("No games on the board.");
    var games = sb.games.slice().sort(function (a, b) {
      var o = { "in": 0, pre: 1, post: 2 };
      var mine = function (g) { return MY_IDS[g.home.id] || MY_IDS[g.away.id] ? 0 : 1; };
      return mine(a) - mine(b) || (o[a.state] - o[b.state]) || (new Date(a.date) - new Date(b.date));
    });
    return '<div class="scores">' + games.slice(0, max || 99).map(scoreCard).join("") + "</div>";
  }

  /* ---------------- standings ---------------- */
  function standTable(rows, cols, opts) {
    opts = opts || {};
    var C = {
      overall: ["W-L", "overall"], conf: ["Conf", "conf"], div: ["Div", "div"], home: ["Home", "home"],
      away: ["Away", "away"], pf: ["PF", "pf"], pa: ["PA", "pa"], diff: ["Diff", "diff"], streak: ["Strk", "streak"], pct: ["Pct", "pct"]
    };
    var h = "<tr><th>" + esc(opts.title || "Team") + "</th>" + cols.map(function (c) { return '<th class="c">' + C[c][0] + "</th>"; }).join("") + "</tr>";
    var b = (rows || []).map(function (r) {
      return '<tr class="' + (MY_IDS[r.id] ? "mine" : "") + '"><td><span class="tm">' + img(r.logo, "") + esc(opts.short ? (r.short || r.abbr) : r.name) + "</span></td>" +
        cols.map(function (c) { return '<td class="c">' + esc(r[C[c][1]] || "-") + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="tscroll"><table class="t">' + (opts.caption ? "<caption>" + esc(opts.caption) + "</caption>" : "") + h + b + "</table></div>";
  }
  function pollTable(poll, n, compact) {
    if (!poll || !poll.ranks) return empty("Poll unavailable.");
    var rows = poll.ranks.slice(0, n || 25).map(function (r) {
      var mv = "";
      if (r.prev && r.prev !== r.rank) mv = r.prev > r.rank ? '<span class="up">&#9650;' + (r.prev - r.rank) + "</span>" : '<span class="down">&#9660;' + (r.rank - r.prev) + "</span>";
      if (!r.prev) mv = '<span class="up">NEW</span>';
      return '<tr class="' + (MY_IDS[r.id] ? "mine" : "") + '"><td class="c"><b>' + r.rank + "</b></td><td><span class=\"tm\">" + img(r.logo, "") + esc(r.name) + "</span></td>" +
        '<td class="c">' + esc(r.record || "") + "</td>" + (compact ? "" : '<td class="c">' + esc(r.points || "") + (r.fpv ? " (" + r.fpv + ")" : "") + "</td>") +
        '<td class="c">' + mv + "</td></tr>";
    }).join("");
    return '<div class="tscroll"><table class="t"><tr><th class="c">RK</th><th>Team</th><th class="c">Rec</th>' + (compact ? "" : '<th class="c">Pts</th>') + '<th class="c">+/-</th></tr>' + rows + "</table></div>";
  }
  function nflDivisionOf(teamId) {
    var out = null;
    ((D.nfl || {}).standings || []).forEach(function (c) {
      c.divisions.forEach(function (d) { d.rows.forEach(function (r) { if (r.id === teamId) out = d; }); });
    });
    return out;
  }

  /* ---------------- team bits ---------------- */
  function oppOf(team, g) {
    var home = g.home.id === team.id;
    return { opp: home ? g.away : g.home, us: home ? g.home : g.away, at: home ? "vs" : "@" };
  }
  function resultText(team, g) {
    var o = oppOf(team, g);
    if (g.state === "post") {
      var w = o.us.winner === true ? "W" : o.us.winner === false ? "L" : "T";
      return '<span class="' + w + '">' + w + "</span> " + esc(o.us.score) + "-" + esc(o.opp.score);
    }
    if (g.state === "in") return '<span class="L">LIVE</span> ' + esc(o.us.score) + "-" + esc(o.opp.score) + " (" + esc(g.detail) + ")";
    return esc(fmtDate(g.date));
  }
  function teamCard(t) {
    if (!t || !t.name) return "";
    var last = t.last ? oppOf(t, t.last) : null, next = t.next ? oppOf(t, t.next) : null;
    return '<a class="mt" href="' + t.key + '.html" style="--tc:#' + esc(t.color || "333") + ";--alt:#" + esc(t.alt || "000") + '">' +
      '<div class="top">' + img(t.logo, "") + "<div><b>" + esc(t.name) + "</b>" +
      (t.rank ? "No. " + t.rank + " &middot; " : "") + esc((t.record || {}).total || "") + "</div></div>" +
      '<div class="body">' +
      '<div class="row"><span>Standing</span><span>' + esc(t.standing || "-") + "</span></div>" +
      (last ? '<div class="row"><span>Last</span><span>' + resultText(t, t.last) + " " + last.at + " " + esc(last.opp.abbr) + "</span></div>" : "") +
      (next ? '<div class="row"><span>Next</span><span>' + next.at + " " + (next.opp.rank ? "#" + next.opp.rank + " " : "") + esc(next.opp.name) + "</span></div>" +
        '<div class="row"><span>When</span><span>' + esc(t.next.state === "pre" ? fmtDate(t.next.date) : t.next.detail) + (t.next.tv ? " &middot; " + esc(t.next.tv) : "") + "</span></div>" : "") +
      '<div class="go">Schedule, stats &amp; news &rsaquo;</div></div></a>';
  }
  function matchup(team, g, title) {
    if (!g) return box(title, empty("Nothing scheduled."), { cls: "blk" });
    var o = oppOf(team, g);
    var away = g.away, home = g.home;
    var mid = g.state === "pre" ? '<div class="vs">' + (o.at === "vs" ? "VS" : "AT") + "</div>" : '<div class="vs">' + esc(g.detail) + "</div>";
    function sideHtml(t) {
      return "<div>" + img(t.logo, "") + '<div class="nm">' + (t.rank ? "#" + t.rank + " " : "") + esc(t.name) + "</div>" +
        '<div class="time">' + esc(t.record || "") + "</div>" + (g.state !== "pre" ? '<div class="big">' + esc(t.score) + "</div>" : "") + "</div>";
    }
    var info = [g.state === "pre" ? fmtDate(g.date) : "", g.tv, g.venue, g.state === "pre" ? g.odds : ""].filter(Boolean).map(esc).join(" &middot; ");
    return box(title, '<div class="matchup">' + sideHtml(away) + mid + sideHtml(home) + '</div><div class="time" style="text-align:center;margin-top:6px">' + info + "</div>",
      { cls: "blk", foot: g.link ? ext(g.link, g.state === "post" ? "Box score &raquo;" : "Game preview &raquo;") : "" });
  }
  function teamNews(t) {
    var nick = (t.name || "").replace(t.short || "", "").trim();
    var re = new RegExp("\\b(" + [t.short, nick].filter(Boolean).join("|") + ")\\b", "i");
    var mine = [], other = [];
    (t.news || []).forEach(function (a) { (re.test(a.headline + " " + a.desc) ? mine : other).push(a); });
    return box(esc(t.short || t.name) + " Headlines", mine.length ? stories(mine, 12) : empty("No stories mentioning the " + (t.short || t.name) + " in this hour's feed.")) +
      (other.length ? box("Related " + (t.key === "broncos" ? "NFL" : "College Football") + " Stories", heads(other, 8), { cls: "blk" }) : "");
  }
  function scheduleTable(team) {
    var rows = (team.schedule || []).map(function (g) {
      var o = oppOf(team, g);
      var isNext = team.next && g.id === team.next.id;
      return '<tr class="' + (isNext ? "nextrow" : "") + '"><td>' + (isNext ? '<span class="badge">' + (g.state === "in" ? "LIVE" : "NEXT") + "</span> " : "") + esc(fmtDate(g.date, false)) + "</td><td><span class=\"tm\">" + o.at + " " + img(o.opp.logo, "") +
        (o.opp.rank ? "<b>#" + o.opp.rank + "</b> " : "") + esc(o.opp.name) + "</span></td><td>" + (g.link ? ext(g.link, resultText(team, g)) : resultText(team, g)) +
        "</td><td>" + esc(g.state === "post" ? "" : g.tv || "") + "</td></tr>";
    }).join("");
    return '<div class="tscroll"><table class="t"><tr><th>Date</th><th>Opponent</th><th>Result / Time</th><th>TV</th></tr>' + rows + "</table></div>";
  }

  /* ---------------- chrome ---------------- */
  function navLinks(list, current) {
    return list.map(function (n) {
      var on = n[0] === current;
      return '<a href="' + n[1] + '"' + (on ? ' class="on" aria-current="page"' : "") + ">" + esc(n[2]) + "</a>";
    }).join("");
  }
  function chrome(content) {
    var meta = D.meta || {};
    var today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    var ageMin = meta.updated ? (Date.now() - new Date(meta.updated).getTime()) / 60000 : null;
    var stale = ageMin != null && ageMin > 120;
    var fresh = meta.updated ? "Updated " + esc(fmtDate(meta.updated)) + " &middot; " + esc(ago(meta.updated)) : "Loading latest data&hellip;";
    var sub = SECTION === "cfb" ? '<nav class="subnav" aria-label="College football"><b>College Football:</b>' + navLinks(CFB_SUB, PAGE) + "</nav>" : "";
    var warn = stale ? '<div class="stale">Heads up: this data was last refreshed ' + esc(ago(meta.updated)) + ". The hourly update may be running late, so scores and news could be out of date.</div>" : "";
    return '<div class="wrap">' +
      '<a class="skip" href="#content">Skip to content</a>' +
      '<div class="util"><span>' + esc(today) + '</span><span class="fresh' + (stale ? " old" : "") + '">' + fresh + "</span></div>" +
      '<header class="mast"><a class="logo" href="index.html" aria-label="Gridiron Update home"><span class="ball"></span>GRIDIRON UPDATE</a>' +
      '<div class="mast-right">Football &middot; Golf &middot; Lacrosse<br><span class="live">UPDATES HOURLY</span></div></header>' +
      '<nav class="nav" aria-label="Main">' + navLinks(NAV, SECTION) + "</nav>" + sub + warn +
      '<div id="content">' + content + "</div>" +
      '<footer class="footer"><div class="fnav">' + navLinks(NAV, SECTION) + navLinks(CFB_SUB.slice(1), PAGE) + "</div>" +
      "Scores, standings, polls &amp; headlines come from ESPN's public data feeds and refresh about once an hour. Links marked &#8599; open the original story on ESPN.com in a new tab.<br>" +
      "Data as of " + esc(meta.updated ? new Date(meta.updated).toLocaleString() : "&mdash;") + ' &middot; <a href="#top">Back to top</a></footer></div>' + ticker();
  }
  function layout(main, side) {
    return '<div class="cols"><main class="main">' + main + '</main><aside class="side">' + side + "</aside></div>";
  }
  function ticker() {
    var items = [], seen = {};
    function add(lg, sb) {
      ((sb || {}).games || []).forEach(function (g) {
        if (seen[g.id]) return; seen[g.id] = 1;
        var a = g.away, h = g.home, s;
        if (g.state === "pre") s = esc(a.abbr) + " @ " + esc(h.abbr) + '<span class="d">' + esc(fmtDate(g.date)) + "</span>";
        else s = '<span class="' + (a.winner ? "w" : g.state === "post" ? "l" : "w") + '">' + esc(a.abbr) + " " + esc(a.score) + "</span> " +
          '<span class="' + (h.winner ? "w" : g.state === "post" ? "l" : "w") + '">' + esc(h.abbr) + " " + esc(h.score) + "</span>" + '<span class="d">' + esc(g.detail) + "</span>";
        items.push(g.link ? '<a class="it noarrow" href="' + url(g.link) + '" target="_blank" rel="noopener"><span class="lg">' + lg + "</span>" + s + "</a>"
          : '<span class="it"><span class="lg">' + lg + "</span>" + s + "</span>");
      });
    }
    var cfb = D.cfb || {};
    add("NFL", (D.nfl || {}).scoreboard);
    add("SEC", (cfb.sec || {}).scoreboard);
    add("ACC", (cfb.acc || {}).scoreboard);
    add("B1G", (cfb.big10 || {}).scoreboard);
    add("BIG 12", (cfb.big12 || {}).scoreboard);
    ((D.golf || {}).tours || []).slice(0, 2).forEach(function (t) {
      var p = t.players[0];
      if (p) items.push('<span class="it"><span class="lg">' + esc(t.label) + "</span>" + esc(t.name) + ": " + esc(p.name) + " " + esc(p.score) + '<span class="d">' + esc(t.detail || "") + "</span></span>");
    });
    if (!items.length) items.push('<span class="it">Loading the Bottom Line&hellip;</span>');
    var dur = Math.max(40, items.length * 6);
    return '<div class="ticker" aria-label="Scores ticker"><div class="lbl">BOTTOM LINE<small>UPDATED HOURLY</small></div><div style="overflow:hidden;flex:1"><div class="track" style="--dur:' + dur + 's">' + items.join("") + "</div></div></div>";
  }

  /* ---------------- pages ---------------- */
  var pages = {};

  pages.home = function () {
    var teams = ["broncos", "boston-college", "florida"].map(function (k) { return D[k]; }).filter(Boolean);
    var pool = [];
    teams.forEach(function (t) {
      var nick = (t.name || "").replace(t.short || "", "").trim();
      var re = new RegExp("\\b(" + [t.short, nick].filter(Boolean).join("|") + ")\\b", "i");
      (t.news || []).forEach(function (a) { var about = re.test(a.headline + " " + a.desc); pool.push(Object.assign({}, a, { team: about ? (t.short || t.name) : (t.key === "broncos" ? "NFL" : "NCAAF"), about: about })); });
    });
    var newest = function (a, b) { return (b.published || "").localeCompare(a.published || ""); };
    var withImg = pool.filter(function (a) { return a.image; }).sort(newest);
    var lead = withImg.filter(function (a) { return a.about; })[0] || withImg[0];
    var all = [];
    var seen = {};
    [].concat(((D.nfl || {}).news || []).map(function (a) { return Object.assign({ team: "NFL" }, a); }),
      ((D.cfb || {}).news || []).map(function (a) { return Object.assign({ team: "NCAAF" }, a); }), pool)
      .forEach(function (a) { if (!seen[a.link] && a !== lead && (!lead || a.link !== lead.link)) { seen[a.link] = 1; all.push(a); } });
    all.sort(function (a, b) { return (b.published || "").localeCompare(a.published || ""); });
    var cfb = D.cfb || {}, nfl = D.nfl || {};
    var golf = ((D.golf || {}).tours || [])[0];
    var lax = [];
    ((D.lacrosse || {}).leagues || []).forEach(function (l) { (l.news || []).slice(0, 3).forEach(function (a) { lax.push(Object.assign({ team: l.key.replace("mens-college-lacrosse", "NCAA M").replace("womens-college-lacrosse", "NCAA W").toUpperCase() }, a)); }); });

    var confs = ["sec", "acc", "big10", "big12"];
    var sbTabs = [{ label: "NFL", html: scores(nfl.scoreboard, 12), more: ["nfl.html", "All NFL scores & standings"] }].concat(confs.map(function (k) {
      return { label: CONF_LABEL[k], html: scores((cfb[k] || {}).scoreboard, 12), more: [CONF_PAGES[k], CONF_LABEL[k] + " page"] };
    }));
    var stTabs = confs.map(function (k) {
      return { label: CONF_LABEL[k], html: standTable(((cfb[k] || {}).standings || {}).rows, ["conf", "overall"], { short: true }), more: [CONF_PAGES[k], "Full " + CONF_LABEL[k] + " standings"] };
    });
    var ap = (cfb.rankings || {})["AP Top 25"];
    var apHtml = ap ? pollTable({ ranks: ap.ranks.slice(0, 10) }, 10, true) +
      (ap.ranks.length > 10 ? '<details class="inline"><summary>Show 11&ndash;' + ap.ranks.length + "</summary>" + pollTable({ ranks: ap.ranks.slice(10) }, 25, true) + "</details>" : "") : empty("Poll unavailable.");

    var main = box("Your Teams", '<div class="myteams four">' + teams.map(teamCard).join("") + fantasyCard() + "</div>") +
      box("Top Story", leadStory(lead, lead && lead.team)) +
      tabsBox("home-scores", "Scoreboard", sbTabs) +
      box("Gridiron Headlines", heads(all, 14));
    var side = box("AP Top 25", apHtml, { link: ["college-football.html", "Polls"] }) +
      tabsBox("home-standings", "Conference Standings", stTabs) +
      (golf ? box("Golf: " + esc(golf.name), golfTable(golf, 8, true), { cls: "grn", link: ["golf.html", "Leaderboards"] }) : "") +
      box("Lacrosse Wire", heads(lax, 8), { cls: "blu", link: ["lacrosse.html", "More"] });
    return layout(main, side);
  };

  pages.notfound = function () {
    var links = NAV.concat(CFB_SUB.slice(1)).map(function (n) { return '<li><a href="' + n[1] + '">' + esc(n[2]) + "</a></li>"; }).join("");
    return layout(box("Page Not Found", "<p>That page doesn't exist on Gridiron Update. Here's everything that does:</p><ul class=\"heads\">" + links + "</ul>"),
      box("Your Teams", '<div class="myteams" style="grid-template-columns:1fr">' + ["broncos", "boston-college", "florida"].map(function (k) { return teamCard(D[k]); }).join("") + "</div>"));
  };

  pages.nfl = function () {
    var nfl = D.nfl || {}, b = D.broncos;
    var standings = (nfl.standings || []).map(function (c) {
      return box(esc(c.name) + " Standings", c.divisions.map(function (d) {
        return standTable(d.rows, ["overall", "pct", "div", "home", "away", "pf", "pa", "diff", "streak"], { caption: d.name });
      }).join(""), { cls: "blk" });
    }).join("");
    var main = (b ? box("Broncos Spotlight", '<div class="myteams" style="grid-template-columns:1fr">' + teamCard(b) + "</div>", { link: ["broncos.html", "Broncos Central"] }) : "") +
      box("NFL Scoreboard &middot; Week " + esc(nfl.scoreboard && nfl.scoreboard.week || ""), scores(nfl.scoreboard)) + standings;
    var div = b && nflDivisionOf(b.id);
    var side = (div ? box(esc(div.name), standTable(div.rows, ["overall", "div", "streak"], { short: true })) : "") +
      box("NFL Headlines", stories(nfl.news, 14));
    return layout(main, side);
  };

  pages.cfb = function () {
    var cfb = D.cfb || {};
    var r = cfb.rankings || {};
    var main = box("Top 25 Scoreboard &middot; Week " + esc(cfb.top25 && cfb.top25.week || ""), scores(cfb.top25)) +
      box("College Football Headlines", stories(cfb.news, 14));
    var side = box("AP Top 25", pollTable(r["AP Top 25"], 25)) + box("Coaches Poll", pollTable(r["AFCA Coaches Poll"], 25, true), { cls: "blk" });
    return layout(main, side);
  };

  function confPage(key, label, featured) {
    var c = (D.cfb || {})[key] || {};
    var rows = (c.standings || {}).rows || [];
    var ids = {}; rows.forEach(function (r) { ids[r.id] = 1; });
    var ap = (((D.cfb || {}).rankings || {})["AP Top 25"] || {}).ranks || [];
    var ranked = ap.filter(function (r) { return ids[r.id]; });
    var undef = rows.filter(function (r) { return r.overall && /-0$/.test(r.overall); }).length;
    var best = rows[0] && rows[0].conf;
    var leaders = best ? rows.filter(function (r) { return r.conf === best; }).map(function (r) { return r.abbr; }) : [];
    var facts = '<div class="factgrid">' +
      '<div class="fact"><b>' + rows.length + "</b><span>Teams</span></div>" +
      '<div class="fact"><b>' + ranked.length + "</b><span>In AP Top 25</span></div>" +
      '<div class="fact"><b>' + undef + "</b><span>Unbeaten</span></div>" +
      '<div class="fact"><b>' + (leaders.length > 3 ? leaders.length + " teams" : esc(leaders.length ? leaders.join(", ") : "-")) + "</b><span>" + (leaders.length > 1 ? "Tied for best conf. record" : "Best conf. record") + (best ? " (" + esc(best) + ")" : "") + "</span>" +
      (leaders.length > 3 ? '<div class="time">' + esc(leaders.join(", ")) + "</div>" : "") + "</div></div>";
    var main = box(label + " At a Glance", facts) +
      box(label + " Scoreboard", scores(c.scoreboard)) +
      box(label + " Standings", standTable(rows, ["conf", "overall", "home", "away", "pf", "pa", "diff", "streak"]), { cls: "blk" }) +
      box(label + " Headlines", stories(c.news, 15));
    var side = (featured && D[featured] ? box("Featured Team", '<div class="myteams" style="grid-template-columns:1fr">' + teamCard(D[featured]) + "</div>") : "") +
      box("Ranked " + label + " Teams", ranked.length ? pollTable({ ranks: ranked }, 25, true) : empty("No ranked teams.")) +
      box("Around College Football", heads((D.cfb || {}).news, 10), { cls: "blk" });
    return layout(main, side);
  }
  pages.sec = function () { return confPage("sec", "SEC", "florida"); };
  pages.acc = function () { return confPage("acc", "ACC", "boston-college"); };
  pages.big10 = function () { return confPage("big10", "Big Ten"); };
  pages.big12 = function () { return confPage("big12", "Big 12"); };

  function teamPage(key) {
    var t = D[key];
    if (!t || !t.name) return layout(box("Team", empty("Data not available yet.")), "");
    var rec = t.record || {};
    var head = '<div class="teamhead" style="--tc:#' + esc(t.color || "333") + ";--alt:#" + esc(t.alt || "000") + '">' + img(t.logo, t.name) +
      "<div><h1>" + (t.rank ? "#" + t.rank + " " : "") + esc(t.name) + '</h1><div class="meta"><b>' + esc(rec.total || "0-0") + "</b> &middot; " + esc(t.standing || "") +
      (t.season ? " &middot; " + esc(t.season) : "") + "</div></div></div>";
    var homeRec = rec.home || rec.homerecord || "-", awayRec = rec.road || rec.away || rec.awayrecord || "-";
    var facts = '<div class="factgrid">' +
      '<div class="fact"><b>' + esc(rec.total || "-") + "</b><span>Overall</span></div>" +
      '<div class="fact"><b>' + esc(homeRec) + "</b><span>Home</span></div>" +
      '<div class="fact"><b>' + esc(awayRec) + "</b><span>Away</span></div>" +
      '<div class="fact"><b>' + esc(t.ppg != null ? t.ppg : "-") + "</b><span>Pts / Game</span></div>" +
      '<div class="fact"><b>' + esc(t.papg != null ? t.papg : "-") + "</b><span>Opp Pts / Game</span></div>" +
      '<div class="fact"><b>' + esc(t.pf != null ? t.pf + "-" + t.pa : "-") + "</b><span>PF-PA</span></div></div>";
    var conf;
    if (key === "broncos") {
      var d = nflDivisionOf(t.id);
      conf = d ? box(esc(d.name) + " Standings", standTable(d.rows, ["overall", "div", "pf", "pa", "streak"], { short: true })) : "";
    } else {
      var ck = key === "florida" ? "sec" : "acc";
      conf = box(ck.toUpperCase() + " Standings", standTable((((D.cfb || {})[ck] || {}).standings || {}).rows, ["conf", "overall"], { short: true }), { link: [ck + ".html", ck.toUpperCase() + " Central"] });
    }
    var main = box("By the Numbers", facts) +
      '<div class="lead" style="grid-template-columns:1fr 1fr;gap:10px">' + matchup(t, t.last, "Last Game") + matchup(t, t.next, "Next Game") + "</div>" +
      box(esc(t.season || "") + " Schedule &amp; Results", scheduleTable(t), { foot: t.link ? ext(t.link, "Team clubhouse &raquo;") : "" }) +
      teamNews(t);
    var side = conf + (key !== "broncos" ? box("AP Top 25", pollTable((((D.cfb || {}).rankings) || {})["AP Top 25"], 25, true)) : box("NFL Headlines", heads((D.nfl || {}).news, 10)));
    return head + layout(main, side);
  }
  pages.broncos = function () { return teamPage("broncos"); };
  pages["boston-college"] = function () { return teamPage("boston-college"); };
  pages.florida = function () { return teamPage("florida"); };

  function golfTable(t, n, compact) {
    var pre = t.state === "pre";
    var rounds = 0;
    t.players.forEach(function (p) { rounds = Math.max(rounds, p.rounds.length); });
    var rh = ""; for (var i = 1; i <= rounds; i++) rh += '<th class="c">R' + i + "</th>";
    var rows = t.players.slice(0, n || 40).map(function (p) {
      var rc = ""; if (!compact) for (var i = 0; i < rounds; i++) rc += '<td class="c">' + esc(p.rounds[i] || "-") + "</td>";
      var sc = String(p.score || "");
      return '<tr><td class="pos">' + esc(pre ? "" : p.pos) + "</td><td>" + img(p.flag, p.country, "flag") + " " + esc(p.name) + "</td>" +
        '<td class="c ' + (sc.charAt(0) === "-" ? "under" : "") + '">' + esc(pre ? "-" : sc) + "</td>" + rc +
        (compact ? "" : '<td class="c">' + esc(p.total || "-") + "</td>") + "</tr>";
    }).join("");
    return '<div class="time" style="margin-bottom:4px">' + esc(t.detail || "") + " &middot; " + esc(fmtDate(t.date, false)) + " &ndash; " + esc(fmtDate(t.end, false)) + "</div>" +
      '<div class="tscroll"><table class="t"><tr><th>Pos</th><th>Player</th><th class="c">To Par</th>' + (compact ? "" : rh + '<th class="c">Tot</th>') + "</tr>" + rows + "</table></div>";
  }

  pages.golf = function () {
    var g = D.golf || {};
    var tours = g.tours || [];
    var main = tours.length ? tabsBox("golf-tour", "Leaderboards", tours.map(function (t) {
      return { label: t.label, html: '<h2 class="evt">' + esc(t.name) + "</h2>" + golfTable(t, 40) +
        (t.link ? '<div class="morelink">' + ext(t.link, "Full leaderboard on ESPN.com") + "</div>" : "") };
    }), { cls: "grn" }) : box("Leaderboards", empty("No tournaments this week."), { cls: "grn" });
    var side = box("Golf Headlines", stories(g.news, 12), { cls: "grn" });
    return layout(main, side);
  };

  pages.lacrosse = function () {
    var leagues = (D.lacrosse || {}).leagues || [];
    var main = leagues.map(function (l) {
      var sb = l.scoreboard || {};
      var has = sb.games && sb.games.length;
      return box(esc(l.label), (has ? scores(sb) : '<div class="note">No games on the board right now &mdash; check back when the season is underway.</div>') +
        '<div style="margin-top:8px">' + heads(l.news, 6) + "</div>", { cls: "blu" });
    }).join("");
    var all = [];
    leagues.forEach(function (l) { (l.news || []).forEach(function (a) { all.push(Object.assign({ team: l.key === "pll" ? "PLL" : l.key === "nll" ? "NLL" : l.key.indexOf("womens") === 0 ? "NCAA W" : "NCAA M" }, a)); }); });
    all.sort(function (a, b) { return (b.published || "").localeCompare(a.published || ""); });
    var side = box("Lacrosse Top Stories", stories(all, 10), { cls: "blu" });
    return layout(main, side);
  };

  /* ---------------- fantasy ---------------- */
  var SCORE = "ppr";
  try { SCORE = localStorage.getItem("gu-scoring") || "ppr"; } catch (e) { /* storage unavailable */ }
  var SCORE_LABEL = { ppr: "PPR", std: "Standard" };
  function pts(v) { return v == null ? "&ndash;" : (Math.round(v * 10) / 10).toFixed(1); }
  function injBadge(st) {
    if (!st || st === "ACTIVE") return "";
    var txt = statusText(st);
    return ' <span class="inj">' + esc(txt) + "</span>";
  }
  function mobGame(g) {
    if (!g) return "Bye";
    return esc(g.at + " " + g.opp) + " &middot; " + (g.state === "pre" ? esc(fmtDate(g.date)) : esc(g.score) + " " + esc(g.detail));
  }
  function gameCell(g) {
    if (!g) return '<span class="time">Not on this week\'s NFL schedule (bye)</span>';
    var opp = g.at + " " + img(g.oppLogo, "") + " " + esc(g.opp);
    var when = g.state === "pre" ? esc(fmtDate(g.date)) + (g.tv ? " &middot; " + esc(g.tv) : "")
      : (g.state === "in" ? '<span class="L">LIVE</span> ' : "") + esc(g.score) + " &middot; " + esc(g.detail);
    return '<span class="tm">' + opp + '</span><div class="time">' + (g.link ? ext(g.link, when) : when) + "</div>";
  }

  function injuryList(ps) {
    return ps.filter(function (p) { return p.injuryStatus && p.injuryStatus !== "ACTIVE"; });
  }
  function statusText(st) { if (st === "INJURY_RESERVE") return "Injured Reserve"; return st.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function fantasyCard() {
    var f = D.fantasy || {}, ps = f.players || [];
    if (!ps.length) return "";
    var starters = ps.filter(function (p) { return (p.group || "Starters") === "Starters"; });
    var proj = 0, n = 0;
    starters.forEach(function (p) { var v = (p.scoring[SCORE] || {}).projWeek; if (v != null) { proj += v; n++; } });
    var hurt = injuryList(ps);
    return '<a class="mt" href="fantasy.html" style="--tc:#1d4719;--alt:#ffcc00"><div class="top"><span class="ffico">FF</span><div><b>My Fantasy Team</b>Week ' + esc(f.week) + " &middot; " + SCORE_LABEL[SCORE] + "</div></div>" +
      '<div class="body"><div class="row"><span>Starters proj.</span><span><b>' + (n ? pts(proj) : "&ndash;") + "</b></span></div>" +
      '<div class="row"><span>Injury report</span><span>' + (hurt.length ? '<b class="L">' + hurt.length + " flagged</b>" : "All active") + "</span></div>" +
      hurt.slice(0, 2).map(function (p) { return '<div class="row"><span>' + esc(p.group === "Starters" ? p.slot : p.group === "IR" ? "IR" : "BN") + "</span><span>" + esc(p.name) + ": " + esc(statusText(p.injuryStatus)) + "</span></div>"; }).join("") +
      (hurt.length > 2 ? '<div class="row"><span></span><span>+' + (hurt.length - 2) + " more</span></div>" : "") +
      '<div class="go">Lineup, points &amp; news &rsaquo;</div></div></a>';
  }

  pages.fantasy = function () {
    var f = D.fantasy || {};
    var ps = f.players || [];
    if (!ps.length) return layout(box("My Fantasy Team", empty("Fantasy data isn't available right now. It will try again on the next hourly update.")), "");
    var wk = f.week || 0;
    var cols = []; for (var w = 1; w <= wk; w++) cols.push(w);
    var starters = ps.filter(function (p) { return (p.group || "Starters") === "Starters"; });
    var sum = function (fn) { var t = 0, n = 0; starters.forEach(function (p) { var v = fn(p.scoring[SCORE] || {}); if (v != null) { t += v; n++; } }); return n ? t : null; };
    var projTotal = sum(function (s) { return s.projWeek; });
    var seasonTotal = sum(function (s) { return s.total; });
    var lastWk = sum(function (s) { return (s.weeks || {})[wk - 1]; });

    var toggle = '<div class="tabs" role="tablist">' + ["ppr", "std"].map(function (k) {
      return '<button data-score="' + k + '" class="' + (k === SCORE ? "on" : "") + '">' + SCORE_LABEL[k] + " scoring</button>";
    }).join("") + "</div>";
    var facts = '<div class="factgrid">' +
      '<div class="fact"><b>' + pts(projTotal) + "</b><span>Starters' Week " + wk + " projection (sum of ESPN's)</span></div>" +
      '<div class="fact"><b>' + pts(lastWk) + "</b><span>Week " + (wk - 1) + " points by current starters</span></div>" +
      '<div class="fact"><b>' + pts(seasonTotal) + "</b><span>Season points by current starters</span></div>" +
      '<div class="fact"><b>' + ps.length + "</b><span>Players on roster</span></div></div>";

    var head = '<tr><th>Pos</th><th>Player</th><th class="gm">Week ' + wk + ' Game</th><th class="c">Proj</th>' +
      cols.map(function (w) { return '<th class="c wk">W' + w + "</th>"; }).join("") + '<th class="c">Total</th><th class="c avg" title="Season total divided by weeks with a score entry (a 0.0 week may be a missed game)">Avg/Wk</th><th class="c ros">Rostered</th></tr>';
    var lastGroup = null, ncol = 7 + cols.length;
    var rows = ps.map(function (p) {
      var g = p.group || "Starters", sec = "";
      if (g !== lastGroup) { lastGroup = g; sec = '<tr class="grp"><td colspan="' + ncol + '">' + esc(g === "IR" ? "Injured Reserve" : g) + "</td></tr>"; }
      var sc = p.scoring[SCORE] || {}, weeks = sc.weeks || {};
      var played = Object.keys(weeks).filter(function (k) { return +k < wk || (p.game && p.game.state !== "pre"); });
      var avg = played.length && sc.total != null ? sc.total / played.length : null;
      return sec + '<tr class="' + (g === "Starters" ? "" : "res") + '"><td><b>' + esc(g === "Bench" ? "BN" : g === "IR" ? "IR" : p.slot) + "</b></td>" +
        '<td><span class="tm">' + img(p.headshot, "", "hs") + "<span><b>" + esc(p.name) + "</b>" + injBadge(p.injuryStatus) + '<br><span class="time">' + esc(p.position || "") + " &middot; " + esc(p.teamAbbr || "") + "</span>" +
        '<div class="mob time">' + mobGame(p.game) + "</div></span></span></td>" +
        '<td class="gm">' + gameCell(p.game) + "</td>" +
        '<td class="c"><b>' + pts(sc.projWeek) + "</b></td>" +
        cols.map(function (w) { return '<td class="c wk">' + pts(weeks[w]) + "</td>"; }).join("") +
        '<td class="c"><b>' + pts(sc.total) + '</b></td><td class="c avg">' + pts(avg) + '</td><td class="c ros">' + (p.owned != null ? Math.round(p.owned) + "%" : "&ndash;") + "</td></tr>";
    }).join("");
    var table = '<div class="tscroll"><table class="t ff">' + head + rows + "</table></div>";

    var card = function (p) {
      var stats = "";
      if (p.statLabels && p.seasonStats) {
        stats = '<div class="tscroll"><table class="t"><tr>' + p.statLabels.map(function (l) { return '<th class="c">' + esc(l) + "</th>"; }).join("") + "</tr><tr>" +
          p.seasonStats.map(function (v) { return '<td class="c">' + esc(v) + "</td>"; }).join("") + "</tr></table></div>";
      }
      var note = p.note ? '<div class="pnote"><b>' + esc(p.note.headline) + "</b> " + esc(p.note.story || "") + ' <span class="time">RotoWire via ESPN &middot; ' + esc(p.note.published || "") + "</span></div>" : "";
      var nws = p.news && p.news.length ? heads(p.news, 4) : empty("No recent stories mentioning " + (p.name || "this player") + ".");
      return box(esc(p.slot) + " &middot; " + esc(p.name) + (p.team ? " &middot; " + esc(p.team) : ""),
        (stats ? '<div class="kicker">' + f.season + " season stats</div>" + stats : "") + note + '<div style="margin-top:6px">' + nws + "</div>", { cls: "blk" });
    };
    var reserves = ps.filter(function (p) { return starters.indexOf(p) < 0; });
    var cards = starters.map(card).join("") + (reserves.length ? '<details class="more"><summary>Bench &amp; IR player details (' + reserves.length + ")</summary>" + reserves.map(card).join("") + "</details>" : "");

    var hurt = injuryList(ps);
    var byes = starters.filter(function (p) { return !p.game; });
    var alerts = hurt.map(function (p) {
      return "<li><b>" + esc(p.name) + "</b> (" + esc(p.group === "Starters" ? "starting " + p.slot : p.group === "IR" ? "on IR" : "bench " + p.slot) + "): " + esc(statusText(p.injuryStatus)) + "</li>";
    }).concat(byes.map(function (p) { return "<li><b>" + esc(p.name) + "</b> (starting " + esc(p.slot) + "): no game on this week's NFL schedule</li>"; }));
    var alertBox = alerts.length ? '<div class="alert"><b>Lineup alerts (ESPN status):</b><ul>' + alerts.join("") + "</ul></div>" : '<div class="note">No injury designations or byes on your roster per ESPN.</div>';
    var main = box("My Fantasy Team &middot; " + esc(f.season) + " Week " + wk,
      alertBox + toggle + '<div class="note">Points and projections come from ESPN Fantasy\'s default ' + SCORE_LABEL[SCORE] + " scoring. If your league uses different settings, your actual points will differ.</div>" + facts + table) +
      cards;

    var mine = {}; ps.forEach(function (p) { if (p.teamId) mine[p.teamId] = 1; });
    var games = (((D.nfl || {}).scoreboard || {}).games || []).filter(function (g) { return mine[g.home.id] || mine[g.away.id]; });
    var side = box("Games With Your Players", games.length ? '<div class="scores" style="grid-template-columns:1fr">' + games.map(scoreCard).join("") + "</div>" : empty("None on the board."));
    return layout(main, side);
  };

  /* ---------------- boot ---------------- */
  function render() {
    var fn = pages[PAGE] || pages.home;
    var app = document.getElementById("app");
    var y = window.scrollY;
    app.innerHTML = chrome(fn());
    window.scrollTo(0, y);
    app.querySelectorAll("[data-score]").forEach(function (b) {
      b.addEventListener("click", function () {
        SCORE = b.getAttribute("data-score");
        try { localStorage.setItem("gu-scoring", SCORE); } catch (e) { /* storage unavailable */ }
        render();
      });
    });
    app.querySelectorAll("button[data-tg]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-tg"), i = b.getAttribute("data-ti");
        TABS[key] = +i; saveTabs();
        app.querySelectorAll('button[data-tg="' + key + '"]').forEach(function (x) {
          var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on);
        });
        app.querySelectorAll('[data-tp="' + key + '"]').forEach(function (p) { p.hidden = p.getAttribute("data-ti") !== i; });
      });
    });
    // On narrow screens the menus scroll sideways; bring the current page's item into view.
    app.querySelectorAll(".nav, .subnav").forEach(function (n) {
      var on = n.querySelector("a.on");
      if (on && n.scrollWidth > n.clientWidth) n.scrollLeft = on.offsetLeft - (n.clientWidth - on.offsetWidth) / 2;
    });
  }
  var lastStamp = null;
  function load() {
    var bust = Math.floor(Date.now() / 300000);
    return Promise.all(FILES.map(function (f) {
      return fetch("data/" + f + ".json?v=" + bust).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        .then(function (j) { if (j) D[f] = j; });
    })).then(function () {
      var stamp = (D.meta || {}).updated || "none";
      if (stamp !== lastStamp) { lastStamp = stamp; render(); } // don't redraw under the reader unless there's new data
    });
  }
  document.getElementById("app").innerHTML = chrome('<div class="cols"><main class="main">' + box("Loading", "Loading the latest scores&hellip;") + "</main></div>");
  load();
  setInterval(load, 10 * 60 * 1000); // pick up the hourly refresh without a manual reload
})();
