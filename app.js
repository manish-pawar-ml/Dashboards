/* Claude Spend Intelligence — dashboard engine */
(function () {
  "use strict";

  const DATA = window.SPEND_DATA || [];
  const $ = (s) => document.querySelector(s);

  // ---------- palette ----------
  const C = {
    ink: "#eef1f6", dim: "#9aa4b4", faint: "#646e7e", line: "#262c38",
    clay: "#e08a5f", teal: "#54b9b0", gold: "#d9b46a", violet: "#8a8ad4",
    green: "#6cc08a", red: "#d9756b"
  };
  const SERIES = [C.clay, C.teal, C.gold, C.violet, C.green, C.red, "#7ba6d9", "#cf8fbf", "#9bbf6c", "#e0a96f", "#6fc4cf", "#b99adf"];

  // ---------- formatters ----------
  const fMoney = (n) => "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fMoney2 = (n) => "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fInt = (n) => Math.round(n || 0).toLocaleString("en-US");
  const fPct = (n) => (n || 0).toFixed(1) + "%";
  const fCompact = (n) => {
    n = n || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  };
  const shortModel = (m) => (m || "").replace(/^claude-/, "").replace(/-\d{8}$/, "").replace(/-\d{6}$/, "");

  // ---------- state ----------
  const state = { l1: "ALL", l2: "ALL", product: "ALL", model: "ALL" };
  let empSort = { key: "spend", dir: "desc" };
  let l2Sort = { key: "spend", dir: "desc" };
  let empPage = 0;
  const PAGE = 25;
  let empQuery = "";
  const charts = {};

  // ---------- helpers ----------
  const uniq = (arr) => [...new Set(arr)].filter((x) => x != null && x !== "");
  const sortAlpha = (a, b) => String(a).localeCompare(String(b));

  function tokens(r) { return r.pt + r.ct; }

  // current filtered rows (L1 + L2 + product + model)
  function filteredRows() {
    return DATA.filter((r) =>
      (state.l1 === "ALL" || r.l1 === state.l1) &&
      (state.l2 === "ALL" || r.l2 === state.l2) &&
      (state.product === "ALL" || r.p === state.product) &&
      (state.model === "ALL" || r.m === state.model)
    );
  }
  // rows scoped only by L1 (used to populate L2 dropdown)
  function l1Rows() {
    return state.l1 === "ALL" ? DATA : DATA.filter((r) => r.l1 === state.l1);
  }

  // ---------- filter population ----------
  function fillSelect(el, values, allLabel) {
    const cur = el.value;
    el.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "ALL"; optAll.textContent = allLabel;
    el.appendChild(optAll);
    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
    if ([...el.options].some((o) => o.value === cur)) el.value = cur;
  }

  function buildL1Options() {
    // order L1s by total spend descending for executive relevance
    const agg = {};
    DATA.forEach((r) => { agg[r.l1] = (agg[r.l1] || 0) + r.g; });
    const ordered = Object.keys(agg).sort((a, b) => agg[b] - agg[a]);
    fillSelect($("#f-l1"), ordered, "All Organizations");
  }
  function buildL2Options() {
    const l2s = uniq(l1Rows().map((r) => r.l2)).sort(sortAlpha);
    fillSelect($("#f-l2"), l2s, state.l1 === "ALL" ? "All Sub-teams" : "All Sub-teams under " + state.l1);
  }
  function buildProductOptions() {
    fillSelect($("#f-product"), uniq(DATA.map((r) => r.p)).sort(sortAlpha), "All Products");
  }
  function buildModelOptions() {
    const models = uniq(DATA.map((r) => r.m)).sort(sortAlpha);
    const el = $("#f-model");
    const cur = el.value;
    el.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "ALL"; optAll.textContent = "All Models";
    el.appendChild(optAll);
    models.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = shortModel(v);
      el.appendChild(o);
    });
    if ([...el.options].some((o) => o.value === cur)) el.value = cur;
  }

  // ---------- aggregation by key ----------
  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach((r) => {
      const k = keyFn(r);
      let g = map.get(k);
      if (!g) { g = { key: k, spend: 0, tokens: 0, requests: 0, people: new Set() }; map.set(k, g); }
      g.spend += r.g; g.tokens += tokens(r); g.requests += r.rq; g.people.add(r.e);
    });
    return map;
  }

  // ===================================================================
  //  RENDER
  // ===================================================================
  function render() {
    const rows = filteredRows();
    renderScope();
    renderKPIs(rows);
    renderInsights(rows);
    renderL2Chart(rows);
    renderModelChart(rows);
    renderProductChart(rows);
    renderTopUsersChart(rows);
    renderL2Pivot(rows);
    renderEmpTable(rows);
  }

  function renderScope() {
    let txt = state.l1 === "ALL" ? "All Organizations" : state.l1 + "’s Org";
    if (state.l2 !== "ALL") txt += " › " + state.l2;
    $("#scopeValue").textContent = txt;
  }

  function renderKPIs(rows) {
    const spend = rows.reduce((s, r) => s + r.g, 0);
    const tok = rows.reduce((s, r) => s + tokens(r), 0);
    const req = rows.reduce((s, r) => s + r.rq, 0);
    const people = uniq(rows.map((r) => r.e)).length;
    const l2count = uniq(rows.map((r) => r.l2)).length;
    const avg = people ? spend / people : 0;

    const cards = [
      { cls: "headline", accent: C.clay, label: state.l1 === "ALL" ? "Total Gross Spend" : "Org Gross Spend", value: fMoney2(spend), meta: rows.length.toLocaleString() + " usage records" },
      { accent: C.teal, label: "Total Tokens", value: fCompact(tok), meta: "prompt + completion" },
      { accent: C.gold, label: "Total Requests", value: fCompact(req), meta: fInt(req) },
      { accent: C.violet, label: "People", value: fInt(people), meta: "active users in scope" },
      { accent: C.green, label: "Avg Spend / Person", value: fMoney2(avg), meta: "gross per active user" },
      { accent: C.red, label: "L2 Teams", value: fInt(l2count), meta: "sub-teams in scope" }
    ];

    $("#kpis").innerHTML = cards.map((c, i) => `
      <div class="kpi ${c.cls || ""}" style="--accent:${c.accent};animation-delay:${i * 55}ms">
        <div class="k-label">${c.label}</div>
        <div class="k-value">${c.value}</div>
        <div class="k-meta">${c.meta}</div>
      </div>`).join("");
  }

  function renderInsights(rows) {
    const grid = $("#insightGrid");
    if (!rows.length) { grid.innerHTML = `<div class="insight"><div class="i-body">No usage in current scope.</div></div>`; return; }

    const totalSpend = rows.reduce((s, r) => s + r.g, 0);

    // top L2
    const byL2 = [...groupBy(rows, (r) => r.l2).values()].sort((a, b) => b.spend - a.spend);
    const topL2 = byL2[0];

    // top person
    const byPerson = [...groupBy(rows, (r) => r.e).values()].sort((a, b) => b.spend - a.spend);
    const topPerson = byPerson[0];

    // dominant model by tokens
    const byModel = [...groupBy(rows, (r) => r.m).values()].sort((a, b) => b.tokens - a.tokens);
    const topModel = byModel[0];
    const modelTok = byModel.reduce((s, m) => s + m.tokens, 0);

    // spend concentration: top 10% of people
    const n = byPerson.length;
    const topN = Math.max(1, Math.ceil(n * 0.1));
    const topNspend = byPerson.slice(0, topN).reduce((s, p) => s + p.spend, 0);
    const concPct = totalSpend ? (topNspend / totalSpend) * 100 : 0;

    // top product
    const byProduct = [...groupBy(rows, (r) => r.p).values()].sort((a, b) => b.spend - a.spend);
    const topProduct = byProduct[0];

    const cards = [
      {
        accent: C.clay, tag: "Lead Sub-team",
        headline: topL2.key,
        body: `${fMoney2(topL2.spend)} — ${fPct(totalSpend ? topL2.spend / totalSpend * 100 : 0)} of scope across ${topL2.people.size} people.`
      },
      {
        accent: C.teal, tag: "Top Spender",
        headline: topPerson.key,
        body: `${fMoney2(topPerson.spend)} in gross spend · ${fCompact(topPerson.tokens)} tokens · ${fInt(topPerson.requests)} requests.`
      },
      {
        accent: C.gold, tag: "Workhorse Model",
        headline: shortModel(topModel.key),
        body: `${fCompact(topModel.tokens)} tokens — ${fPct(modelTok ? topModel.tokens / modelTok * 100 : 0)} of all tokens in scope.`
      },
      {
        accent: C.violet, tag: "Spend Concentration",
        headline: fPct(concPct) + " of spend",
        body: `Driven by the top ${topN} ${topN === 1 ? "person" : "people"} (top 10% of ${n} users) — useful for governance focus.`
      },
      {
        accent: C.green, tag: "Leading Surface",
        headline: topProduct.key,
        body: `${fMoney2(topProduct.spend)} — the highest-spend product in scope (${fPct(totalSpend ? topProduct.spend / totalSpend * 100 : 0)}).`
      }
    ];

    grid.innerHTML = cards.map((c, i) => `
      <div class="insight" style="--accent:${c.accent};animation-delay:${i * 50}ms">
        <div class="i-tag">${c.tag}</div>
        <div class="i-headline">${esc(c.headline)}</div>
        <div class="i-body">${c.body}</div>
      </div>`).join("");
  }

  // ---------- chart base ----------
  Chart.defaults.color = C.dim;
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.font.size = 12;

  function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  const gridCfg = { color: "rgba(255,255,255,.05)", drawBorder: false };
  const noGrid = { display: false, drawBorder: false };

  function renderL2Chart(rows) {
    destroy("l2");
    const data = [...groupBy(rows, (r) => r.l2).values()].sort((a, b) => b.spend - a.spend).slice(0, 14);
    $("#l2ChartSub").textContent = data.length + " teams · gross USD";
    charts.l2 = new Chart($("#l2Chart"), {
      type: "bar",
      data: {
        labels: data.map((d) => d.key),
        datasets: [{ data: data.map((d) => d.spend), backgroundColor: data.map((_, i) => SERIES[i % SERIES.length]), borderRadius: 5, maxBarThickness: 26 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fMoney2(c.parsed.x) } } },
        scales: { x: { grid: gridCfg, ticks: { callback: (v) => "$" + fCompact(v) } }, y: { grid: noGrid } }
      }
    });
  }

  function renderModelChart(rows) {
    destroy("model");
    const data = [...groupBy(rows, (r) => r.m).values()].sort((a, b) => b.tokens - a.tokens);
    charts.model = new Chart($("#modelChart"), {
      type: "bar",
      data: {
        labels: data.map((d) => shortModel(d.key)),
        datasets: [{ data: data.map((d) => d.tokens), backgroundColor: data.map((_, i) => SERIES[i % SERIES.length]), borderRadius: 5, maxBarThickness: 30 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fInt(c.parsed.x) + " tokens" } } },
        scales: { x: { grid: gridCfg, ticks: { callback: (v) => fCompact(v) } }, y: { grid: noGrid } }
      }
    });
  }

  function renderProductChart(rows) {
    destroy("product");
    const data = [...groupBy(rows, (r) => r.p).values()].sort((a, b) => b.spend - a.spend);
    charts.product = new Chart($("#productChart"), {
      type: "bar",
      data: {
        labels: data.map((d) => d.key),
        datasets: [{ data: data.map((d) => d.spend), backgroundColor: C.teal, borderRadius: 5, maxBarThickness: 46 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fMoney2(c.parsed.y) } } },
        scales: { x: { grid: noGrid, ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } }, y: { grid: gridCfg, ticks: { callback: (v) => "$" + fCompact(v) } } }
      }
    });
  }

  function renderTopUsersChart(rows) {
    destroy("top");
    const data = [...groupBy(rows, (r) => r.e).values()].sort((a, b) => b.spend - a.spend).slice(0, 15);
    charts.top = new Chart($("#topUsersChart"), {
      type: "bar",
      data: {
        labels: data.map((d) => d.key),
        datasets: [{ data: data.map((d) => d.spend), backgroundColor: C.clay, borderRadius: 5, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fMoney2(c.parsed.x) } } },
        scales: { x: { grid: gridCfg, ticks: { callback: (v) => "$" + fCompact(v) } }, y: { grid: noGrid } }
      }
    });
  }

  // ---------- L2 pivot table ----------
  function renderL2Pivot(rows) {
    const totalSpend = rows.reduce((s, r) => s + r.g, 0);
    let data = [...groupBy(rows, (r) => r.l2).values()].map((g) => ({
      name: g.key, people: g.people.size, spend: g.spend, tokens: g.tokens,
      requests: g.requests, pct: totalSpend ? g.spend / totalSpend * 100 : 0,
      avg: g.people.size ? g.spend / g.people.size : 0
    }));
    const dir = l2Sort.dir === "asc" ? 1 : -1;
    data.sort((a, b) => {
      const A = a[l2Sort.key], B = b[l2Sort.key];
      return (typeof A === "string" ? sortAlpha(A, B) : A - B) * dir;
    });

    const maxSpend = Math.max(1, ...data.map((d) => d.spend));
    const tbody = $("#l2Pivot tbody");
    tbody.innerHTML = data.map((d) => `
      <tr>
        <td class="strong bar-cell"><div class="bar" style="width:${(d.spend / maxSpend * 100).toFixed(1)}%"></div><span>${esc(d.name)}</span></td>
        <td class="num">${fInt(d.people)}</td>
        <td class="num clay">${fMoney2(d.spend)}</td>
        <td class="num">${fPct(d.pct)}</td>
        <td class="num">${fCompact(d.tokens)}</td>
        <td class="num">${fInt(d.requests)}</td>
        <td class="num">${fMoney2(d.avg)}</td>
      </tr>`).join("");

    const tPeople = data.reduce((s, d) => s + d.people, 0);
    const tReq = data.reduce((s, d) => s + d.requests, 0);
    const tTok = data.reduce((s, d) => s + d.tokens, 0);
    $("#l2Pivot tfoot").innerHTML = `
      <tr>
        <td>Total · ${data.length} teams</td>
        <td class="num">${fInt(tPeople)}</td>
        <td class="num">${fMoney2(totalSpend)}</td>
        <td class="num">100%</td>
        <td class="num">${fCompact(tTok)}</td>
        <td class="num">${fInt(tReq)}</td>
        <td class="num">—</td>
      </tr>`;
    markSort("#l2Pivot", l2Sort);
  }

  // ---------- employee table ----------
  function buildEmployees(rows) {
    const map = new Map();
    rows.forEach((r) => {
      let e = map.get(r.e);
      if (!e) { e = { name: r.e, title: r.t, dept: r.d, l1: r.l1, l2: r.l2, spend: 0, tokens: 0, requests: 0 }; map.set(r.e, e); }
      e.spend += r.g; e.tokens += tokens(r); e.requests += r.rq;
      // keep a representative l2 (most specific seen)
      if (e.l2 === "— Direct / Unassigned" && r.l2 !== "— Direct / Unassigned") e.l2 = r.l2;
    });
    return [...map.values()];
  }

  function renderEmpTable(rows) {
    let emps = buildEmployees(rows);
    $("#empCountSub").textContent = emps.length.toLocaleString() + " people in current scope";

    if (empQuery) {
      const q = empQuery.toLowerCase();
      emps = emps.filter((e) =>
        e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) ||
        e.dept.toLowerCase().includes(q) || e.l2.toLowerCase().includes(q));
    }

    const dir = empSort.dir === "asc" ? 1 : -1;
    emps.sort((a, b) => {
      const A = a[empSort.key], B = b[empSort.key];
      return (typeof A === "string" ? sortAlpha(A, B) : A - B) * dir;
    });

    const total = emps.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if (empPage >= pages) empPage = pages - 1;
    if (empPage < 0) empPage = 0;
    const slice = emps.slice(empPage * PAGE, empPage * PAGE + PAGE);

    $("#empTable tbody").innerHTML = slice.map((e) => `
      <tr>
        <td class="strong">${esc(e.name)}</td>
        <td class="muted">${esc(e.title)}</td>
        <td class="muted">${esc(e.dept)}</td>
        <td><span class="pill">${esc(e.l2)}</span></td>
        <td class="num clay">${fMoney2(e.spend)}</td>
        <td class="num">${fCompact(e.tokens)}</td>
        <td class="num">${fInt(e.requests)}</td>
      </tr>`).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">No people match this search.</td></tr>`;

    const from = total ? empPage * PAGE + 1 : 0;
    const to = Math.min(total, empPage * PAGE + PAGE);
    $("#empShowing").textContent = `Showing ${from}–${to} of ${total}`;
    $("#pageInfo").textContent = `Page ${empPage + 1} / ${pages}`;
    $("#prevPage").disabled = empPage === 0;
    $("#nextPage").disabled = empPage >= pages - 1;
    markSort("#empTable", empSort);
  }

  // ---------- sort header marks ----------
  function markSort(tableSel, sortState) {
    document.querySelectorAll(`${tableSel} thead th`).forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sort === sortState.key) th.classList.add(sortState.dir === "asc" ? "sorted-asc" : "sorted-desc");
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ===================================================================
  //  EVENTS
  // ===================================================================
  function wire() {
    $("#f-l1").addEventListener("change", (e) => {
      state.l1 = e.target.value; state.l2 = "ALL";
      buildL2Options(); $("#f-l2").value = "ALL";
      empPage = 0; render();
    });
    $("#f-l2").addEventListener("change", (e) => { state.l2 = e.target.value; empPage = 0; render(); });
    $("#f-product").addEventListener("change", (e) => { state.product = e.target.value; empPage = 0; render(); });
    $("#f-model").addEventListener("change", (e) => { state.model = e.target.value; empPage = 0; render(); });

    $("#resetBtn").addEventListener("click", () => {
      state.l1 = state.l2 = state.product = state.model = "ALL";
      empQuery = ""; empPage = 0; $("#empSearch").value = "";
      buildL2Options();
      $("#f-l1").value = "ALL"; $("#f-l2").value = "ALL"; $("#f-product").value = "ALL"; $("#f-model").value = "ALL";
      render();
    });

    let t;
    $("#empSearch").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { empQuery = e.target.value.trim(); empPage = 0; renderEmpTable(filteredRows()); }, 160);
    });
    $("#prevPage").addEventListener("click", () => { empPage--; renderEmpTable(filteredRows()); });
    $("#nextPage").addEventListener("click", () => { empPage++; renderEmpTable(filteredRows()); });

    document.querySelectorAll("#l2Pivot thead th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.sort;
        if (l2Sort.key === k) l2Sort.dir = l2Sort.dir === "asc" ? "desc" : "asc";
        else { l2Sort.key = k; l2Sort.dir = k === "name" ? "asc" : "desc"; }
        renderL2Pivot(filteredRows());
      });
    });
    document.querySelectorAll("#empTable thead th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.sort;
        if (empSort.key === k) empSort.dir = empSort.dir === "asc" ? "desc" : "asc";
        else { empSort.key = k; empSort.dir = k === "name" ? "asc" : "desc"; }
        renderEmpTable(filteredRows());
      });
    });
  }

  // ===================================================================
  //  INIT
  // ===================================================================
  function init() {
    if (!DATA.length) { document.body.insertAdjacentHTML("beforeend", "<p style='padding:40px'>No data loaded.</p>"); return; }
    buildL1Options(); buildL2Options(); buildProductOptions(); buildModelOptions();
    wire();
    render();
    $("#footStamp").textContent = DATA.length.toLocaleString() + " records · " + uniq(DATA.map((r) => r.e)).length.toLocaleString() + " people";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
