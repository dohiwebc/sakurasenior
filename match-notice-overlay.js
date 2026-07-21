/**
 * 試合通知タップ時に、目標詳細と同じようなカード型オーバーレイを表示する。
 * 依存: firebase（初期化済み）, notify-core（SakuraGoalBadge）, d3, 任意で html2canvas
 */
(function () {
  let overlayRoot = null;
  let shouldReturnToNoticesOnClose = false;

  function getDb() {
    try {
      return typeof firebase !== "undefined" && firebase.apps?.length ? firebase.database() : null;
    } catch {
      return null;
    }
  }

  function fmtPercent(v) {
    return `${(Number(v) || 0).toFixed(1)}%`;
  }

  function safeNum(v) {
    return Number(v) || 0;
  }

  function getAttackFailure(rec) {
    if (Number.isFinite(rec.attackFailure)) return Math.max(0, safeNum(rec.attackFailure));
    return Math.max(0, safeNum(rec.attack) - safeNum(rec.attackSuccess));
  }

  function calcTeamMetrics(recordsByMatch, matchId) {
    const all = recordsByMatch?.[matchId] || {};
    const entries = Object.values(all).filter((r) => !r?.isBench && !r?.absent);
    const atkSuccess = entries.reduce((s, r) => s + safeNum(r.attackSuccess), 0);
    const atkFail = entries.reduce((s, r) => s + getAttackFailure(r), 0);
    const catchN = entries.reduce((s, r) => s + safeNum(r.catch), 0);
    const outN = entries.reduce((s, r) => s + safeNum(r.out), 0);
    const zeroBreak = entries.reduce((s, r) => s + safeNum(r.zeroBreak), 0);
    const attackRate = atkSuccess + atkFail ? (atkSuccess / (atkSuccess + atkFail)) * 100 : 0;
    const catchRate = catchN + outN ? (catchN / (catchN + outN)) * 100 : 0;
    const benchLeakCount = Object.values(all).filter((r) => {
      if (!r?.isBench) return false;
      return (
        safeNum(r.attackSuccess) > 0 ||
        safeNum(r.attack) > 0 ||
        safeNum(r.catch) > 0 ||
        safeNum(r.out) > 0 ||
        safeNum(r.return) > 0 ||
        safeNum(r.zeroBreak) > 0
      );
    }).length;
    return {
      attackRate,
      catchRate,
      zeroBreak,
      benchLeakCount,
      attackSuccess: atkSuccess,
      attackTotal: atkSuccess + atkFail,
      catchSuccess: catchN,
      catchTotal: catchN + outN,
    };
  }

  function buildTrend(matches, recordsByMatch) {
    const sorted = [...matches].sort((a, b) => {
      const ao = Number(a.displayOrder);
      const bo = Number(b.displayOrder);
      const ah = Number.isFinite(ao);
      const bh = Number.isFinite(bo);
      if (ah && bh && ao !== bo) return ao - bo;
      if (ah && !bh) return -1;
      if (!ah && bh) return 1;
      return String(a.date || "").localeCompare(String(b.date || ""), "ja");
    });
    return sorted.map((m) => {
      const kpi = calcTeamMetrics(recordsByMatch, m.id);
      return {
        id: m.id,
        stage: m.stage || "予選",
        label: m.opponent ? `vs ${m.opponent}` : "対戦相手未設定",
        dateLabel: m.date || "日付未設定",
        attackRate: kpi.attackRate,
        catchRate: kpi.catchRate,
      };
    });
  }

  function drawTrendChart(container, tooltipEl, trend, selectedId, order = "asc", stageFilter = "all") {
    if (typeof d3 === "undefined") {
      container.innerHTML = '<p class="match-meta">グラフを表示するには d3.js の読み込みが必要です。</p>';
      return;
    }
    container.innerHTML = "";
    let points = stageFilter === "all" ? [...trend] : trend.filter((x) => x.stage === stageFilter);
    if (order === "desc") points = points.reverse();
    if (!points.length) {
      container.innerHTML = '<p class="match-meta">表示できる試合推移データがありません。</p>';
      return;
    }
    const width = 960;
    const height = 280;
    const m = { top: 24, right: 22, bottom: 40, left: 52 };
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);
    const x = d3.scaleLinear().domain([0, Math.max(0, points.length - 1)]).range([m.left, width - m.right]);
    const y = d3.scaleLinear().domain([0, 100]).nice().range([height - m.bottom, m.top]);

    svg
      .append("g")
      .selectAll("line")
      .data(y.ticks(5))
      .enter()
      .append("line")
      .attr("x1", m.left)
      .attr("x2", width - m.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "rgba(255,255,255,0.10)");

    const selectedIndex = points.findIndex((p) => p.id === selectedId);
    if (selectedIndex >= 0) {
      svg
        .append("line")
        .attr("x1", x(selectedIndex))
        .attr("x2", x(selectedIndex))
        .attr("y1", m.top)
        .attr("y2", height - m.bottom)
        .attr("stroke", "rgba(154,240,255,0.6)")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,4");
    }

    const mkLine = (key, color) =>
      d3
        .line()
        .x((_, i) => x(i))
        .y((d) => y(d[key]))
        .curve(d3.curveMonotoneX);

    const catchPath = svg
      .append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#84c3ff")
      .attr("stroke-width", 2)
      .attr("d", mkLine("catchRate"));
    const attackPath = svg
      .append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#ffd166")
      .attr("stroke-width", 2)
      .attr("d", mkLine("attackRate"));

    [catchPath, attackPath].forEach((path) => {
      try {
        const node = path.node();
        const totalLength = typeof node?.getTotalLength === "function" ? node.getTotalLength() : 0;
        if (!totalLength) return;
        path
          .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .duration(3000)
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);
      } catch {}
    });

    const catchDots = svg
      .selectAll(".match-dot")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", (_, i) => x(i))
      .attr("cy", (d) => y(d.catchRate))
      .attr("r", 0)
      .attr("fill", (d) => (d.id === selectedId ? "#9af0ff" : "#84c3ff"))
      .attr("stroke", (d) => (d.id === selectedId ? "#e8fdff" : "none"))
      .attr("stroke-width", (d) => (d.id === selectedId ? 2 : 0))
      .on("mousemove", (event, d) => {
        if (!tooltipEl) return;
        tooltipEl.classList.remove("hidden");
        tooltipEl.textContent = `${d.label}（${d.dateLabel}）/ キャッチ率 ${fmtPercent(d.catchRate)} / アタック成功率 ${fmtPercent(d.attackRate)}`;
        tooltipEl.style.left = `${event.clientX + 10}px`;
        tooltipEl.style.top = `${event.clientY + 10}px`;
      })
      .on("mouseleave", () => tooltipEl?.classList.add("hidden"));

    catchDots
      .transition()
      .delay((_, i) => i * 80)
      .duration(420)
      .ease(d3.easeCubicOut)
      .attr("r", (d) => (d.id === selectedId ? 4.8 : 3.2));

    const attackDots = svg
      .selectAll(".match-dot-attack")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", (_, i) => x(i))
      .attr("cy", (d) => y(d.attackRate))
      .attr("r", 0)
      .attr("fill", (d) => (d.id === selectedId ? "#ffe8a6" : "#ffd166"))
      .attr("stroke", (d) => (d.id === selectedId ? "#fff5d8" : "none"))
      .attr("stroke-width", (d) => (d.id === selectedId ? 1.6 : 0))
      .on("mousemove", (event, d) => {
        if (!tooltipEl) return;
        tooltipEl.classList.remove("hidden");
        tooltipEl.textContent = `${d.label}（${d.dateLabel}）/ キャッチ率 ${fmtPercent(d.catchRate)} / アタック成功率 ${fmtPercent(d.attackRate)}`;
        tooltipEl.style.left = `${event.clientX + 10}px`;
        tooltipEl.style.top = `${event.clientY + 10}px`;
      })
      .on("mouseleave", () => tooltipEl?.classList.add("hidden"));

    attackDots
      .transition()
      .delay((_, i) => i * 80 + 120)
      .duration(420)
      .ease(d3.easeCubicOut)
      .attr("r", (d) => (d.id === selectedId ? 4.4 : 3.0));

    svg
      .append("g")
      .attr("transform", `translate(0,${height - m.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(8, Math.max(1, points.length - 1))).tickFormat((v) => points[Math.round(v)]?.label || ""));
    svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y));
    svg.append("text").attr("x", m.left).attr("y", 12).attr("fill", "#84c3ff").style("font-size", "11px").text("青: キャッチ率");
    svg.append("text").attr("x", m.left + 98).attr("y", 12).attr("fill", "#ffd166").style("font-size", "11px").text("黄: アタック成功率");
  }

  function sanitizeFileName(v) {
    return String(v || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();
  }

  async function exportChartAsImage(metaText, chartEl) {
    if (typeof html2canvas === "undefined") {
      alert("画像出力には html2canvas が必要です。");
      return;
    }
    if (!chartEl?.querySelector?.("svg")) {
      alert("出力できるグラフがありません。");
      return;
    }
    const wrap = document.createElement("div");
    wrap.style.background = "#0f0f0f";
    wrap.style.color = "#f8f3df";
    wrap.style.padding = "12px";
    wrap.style.width = "1000px";
    wrap.style.border = "1px solid rgba(255,214,88,0.3)";
    const meta = document.createElement("div");
    meta.style.fontSize = "13px";
    meta.style.marginBottom = "8px";
    meta.textContent = metaText;
    const clone = chartEl.cloneNode(true);
    wrap.appendChild(meta);
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    wrap.style.position = "fixed";
    wrap.style.left = "-99999px";
    try {
      const canvas = await html2canvas(wrap, { backgroundColor: "#0f0f0f", scale: 2 });
      wrap.remove();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const filename = sanitizeFileName(`試合推移グラフ_${metaText}.png`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      wrap.remove();
      alert("画像の生成に失敗しました。");
    }
  }

  function ensureDom() {
    if (overlayRoot) return;
    const wrap = document.createElement("div");
    wrap.id = "matchNoticeOverlayModal";
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="match-overlay-backdrop" id="matchOverlayBackdrop"></div>
      <div class="match-notice-detail-card">
        <div class="match-notice-detail-head">
          <h3 id="matchOverlayTitle">試合詳細</h3>
          <button type="button" class="match-notice-detail-x" id="matchOverlayClose" aria-label="閉じる">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div id="matchOverlayBody" class="match-notice-detail-body">
          <div id="matchOverlaySummary"></div>
          <div class="match-chart-head-row">
            <p class="match-chart-heading">試合推移グラフ</p>
            <div class="match-chart-filters">
              <label class="match-chart-order-label">
                並び順
                <select id="matchOverlayOrderSelect">
                  <option value="asc">時系列順（第一試合→最終試合）</option>
                  <option value="desc">逆順（最終試合→第一試合）</option>
                </select>
              </label>
              <label class="match-chart-order-label">
                区分
                <select id="matchOverlayStageFilterSelect">
                  <option value="all">すべて</option>
                  <option value="予選">予選のみ</option>
                  <option value="トーナメント">トーナメントのみ</option>
                  <option value="その他">その他のみ</option>
                </select>
              </label>
            </div>
          </div>
          <div class="match-chart-scroll">
            <div class="match-chart-wrap">
              <div id="match-chart-overlay"></div>
            </div>
          </div>
          <div class="match-actions">
            <button type="button" id="matchOverlayExportBtn">グラフを出力</button>
            <button type="button" id="matchOverlayOpenAllBtn">全ての試合を見る</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    let tip = document.getElementById("matchOverlayTooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "matchOverlayTooltip";
      tip.className = "hidden";
      document.body.appendChild(tip);
    }
    overlayRoot = wrap;

    const close = () => {
      const shouldReturn = shouldReturnToNoticesOnClose;
      shouldReturnToNoticesOnClose = false;
      wrap.hidden = true;
      document.body.classList.remove("match-overlay-scroll-lock");
      document.getElementById("matchOverlaySummary").innerHTML = "";
      document.getElementById("match-chart-overlay").innerHTML = "";
      tip.classList.add("hidden");
      const body = document.getElementById("matchOverlayBody");
      if (body) body.scrollTop = 0;
      if (shouldReturn && typeof window.__siteNavOpenNotices === "function") {
        window.setTimeout(() => {
          void window.__siteNavOpenNotices("matches");
        }, 0);
      }
    };
    document.getElementById("matchOverlayClose").addEventListener("click", close);
    document.getElementById("matchOverlayBackdrop").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !wrap.hidden) close();
    });
  }

  async function openMatchOverlay(tournamentId, matchId, fp = "", options = {}) {
    const B = window.SakuraGoalBadge;
    if (!B?.fetchGoalOverlayState) {
      window.location.href = `./index.html?tournament=${encodeURIComponent(tournamentId)}&match=${encodeURIComponent(matchId)}&openMatchDetail=1`;
      return;
    }
    const db = getDb();
    if (!db) {
      window.location.href = `./index.html?tournament=${encodeURIComponent(tournamentId)}&match=${encodeURIComponent(matchId)}&openMatchDetail=1`;
      return;
    }
    ensureDom();
    shouldReturnToNoticesOnClose = options?.returnToNotices === true;
    const { state } = await B.fetchGoalOverlayState(db);
    const td = state?.allTournamentData?.[tournamentId];
    const t = state?.tournaments?.find((x) => x.id === tournamentId);
    const match = td?.matches?.find((x) => x.id === matchId);
    if (!td || !match) {
      alert("該当の試合が見つかりません。");
      return;
    }
    const kpi = calcTeamMetrics(td.recordsByMatch, matchId);
    const trend = buildTrend(td.matches || [], td.recordsByMatch || {});
    const idx = trend.findIndex((x) => x.id === matchId);
    const past = trend.slice(0, idx).map((x) => x.catchRate);
    const avg = past.length ? past.reduce((s, v) => s + v, 0) / past.length : kpi.catchRate;
    const diff = kpi.catchRate - avg;

    document.getElementById("matchOverlayTitle").textContent = "試合詳細";
    document.getElementById("matchOverlaySummary").innerHTML = `
      <article class="match-card">
        <div style="font-size:15px;font-weight:700;color:#f8f3df;">${t?.name || "大会未設定"} / ${match.stage || "区分未設定"} vs ${match.opponent || "—"}</div>
        <div class="match-meta">${match.date || "日付未設定"}</div>
        <div class="match-meta">対象: チーム全体</div>
        <div class="match-meta">区分: ${match.stage || "区分未設定"}</div>
        <div class="match-kpi">
          <div><span class="match-kpi-label">アタック成功率</span><span class="match-kpi-value">${fmtPercent(kpi.attackRate)} (${kpi.attackSuccess}/${kpi.attackTotal})</span></div>
          <div><span class="match-kpi-label">キャッチ率</span><span class="match-kpi-value">${fmtPercent(kpi.catchRate)} (${kpi.catchSuccess}/${kpi.catchTotal})</span></div>
          <div><span class="match-kpi-label">ゼロ抜き</span><span class="match-kpi-value">${kpi.zeroBreak}</span></div>
        </div>
        <div class="match-alert">
          要確認: キャッチ率が直近平均より ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% / ベンチ選手の記録漏れ ${kpi.benchLeakCount}件
        </div>
      </article>
    `;

    const chartEl = document.getElementById("match-chart-overlay");
    const tip = document.getElementById("matchOverlayTooltip");
    const orderSelectEl = document.getElementById("matchOverlayOrderSelect");
    const stageFilterSelectEl = document.getElementById("matchOverlayStageFilterSelect");
    if (orderSelectEl) orderSelectEl.value = "asc";
    if (stageFilterSelectEl) stageFilterSelectEl.value = "all";
    const renderChart = () => {
      const order = orderSelectEl?.value || "asc";
      const stageFilter = stageFilterSelectEl?.value || "all";
      drawTrendChart(chartEl, tip, trend, matchId, order, stageFilter);
    };
    renderChart();
    orderSelectEl?.addEventListener("change", renderChart);
    stageFilterSelectEl?.addEventListener("change", renderChart);

    document.getElementById("matchOverlayExportBtn").onclick = () =>
      void exportChartAsImage(`${t?.name || ""}_${match.stage || ""}_vs_${match.opponent || ""}`, chartEl);
    document.getElementById("matchOverlayOpenAllBtn").onclick = () => {
      window.location.href = `./index.html?tournament=${encodeURIComponent(tournamentId)}&match=${encodeURIComponent(matchId)}&openMatchDetail=1`;
    };

    document.body.classList.add("match-overlay-scroll-lock");
    overlayRoot.hidden = false;
  }

  window.__openMatchNoticeOverlay = (tournamentId, matchId, fp, options = {}) => {
    void openMatchOverlay(tournamentId, matchId, fp, options);
  };
})();
