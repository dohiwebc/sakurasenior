/**
 * goals ページ以外で、目標通知タップ時に詳細＋進捗グラフを現在のページ上に表示する。
 * 依存: firebase（初期化済み）, notify-core（SakuraGoalBadge）, d3, 任意で html2canvas
 */
(function () {
  let overlayRoot = null;
  let lastGoalId = null;
  let shouldReturnToNoticesOnClose = false;

  function ensureCss() {
    if (document.querySelector('link[href*="goal-notice-overlay.css"]')) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "./goal-notice-overlay.css";
    document.head.appendChild(l);
  }

  function getDb() {
    try {
      return typeof firebase !== "undefined" && firebase.apps?.length ? firebase.database() : null;
    } catch {
      return null;
    }
  }

  function safeNum(v) {
    return Number(v) || 0;
  }

  function fmtPercent(v) {
    return `${(Number(v) || 0).toFixed(1)}%`;
  }

  function goalRangeLabel(goal, tournaments) {
    if (goal.goalType === "short") {
      const t = tournaments.find((x) => x.id === goal.relatedEvent);
      return `大会: ${t?.name || "未設定"}`;
    }
    return `${goal.startDate || "?"} ～ ${goal.endDate || "?"}`;
  }

  function peerOrdinal(state, goal) {
    const peers =
      (goal.targetScope || "player") === "team"
        ? state.goals.filter((g) => (g.targetScope || "player") === "team")
        : state.goals.filter((g) => (g.targetScope || "player") === "player" && g.userId === goal.userId);
    const i = peers.findIndex((g) => g.id === goal.id);
    return i >= 0 ? i + 1 : 1;
  }

  function drawProgressChart(container, goal, progress, state, tooltipEl) {
    const B = window.SakuraGoalBadge;
    if (!B || typeof d3 === "undefined") {
      container.innerHTML = '<p class="help" style="color:#beb28a;font-size:13px;">グラフを表示するには d3.js の読み込みが必要です。</p>';
      return;
    }
    container.innerHTML = "";
    if (!progress.series.length) {
      container.innerHTML = '<p class="help" style="color:#beb28a;font-size:13px;">対象期間の記録がありません。</p>';
      return;
    }
    const width = 980;
    const height = 280;
    const m = { top: 28, right: 20, bottom: 38, left: 48 };
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);
    const x = d3.scaleLinear().domain([0, Math.max(0, progress.series.length - 1)]).range([m.left, width - m.right]);
    const yMax = progress.isRate
      ? 100
      : Math.max(progress.target * 1.2, d3.max(progress.series, (d) => d.value) || 0, 10);
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([height - m.bottom, m.top]);
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
    const targetLine = svg
      .append("line")
      .attr("x1", m.left)
      .attr("x2", width - m.right)
      .attr("y1", y(progress.target))
      .attr("y2", y(progress.target))
      .attr("stroke", "#ffd166")
      .attr("stroke-dasharray", "5,4")
      .attr("stroke-width", 1.8);
    const line = d3
      .line()
      .x((d, i) => x(i))
      .y((d) => y(d.value));
    const trendPath = svg.append("path").datum(progress.series).attr("fill", "none").attr("stroke", "#84c3ff").attr("stroke-width", 2).attr("d", line);
    const circles = svg
      .selectAll("circle")
      .data(progress.series)
      .enter()
      .append("circle")
      .attr("cx", (_, i) => x(i))
      .attr("cy", (d) => y(d.value))
      .attr("r", 3.4)
      .attr("fill", "#84c3ff")
      .on("mousemove", (event, d) => {
        if (!tooltipEl) return;
        tooltipEl.classList.remove("hidden");
        tooltipEl.textContent = `${d.date} 時点: ${d.value.toFixed(1)}${progress.isRate ? "%" : ""}`;
        tooltipEl.style.left = `${event.clientX + 10}px`;
        tooltipEl.style.top = `${event.clientY + 10}px`;
      })
      .on("mouseleave", () => tooltipEl?.classList.add("hidden"));
    circles.attr("opacity", 0);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - m.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(8, Math.max(1, progress.series.length - 1))).tickFormat((v) => progress.series[Math.round(v)]?.date || ""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y));
    const subj = B.getGoalSubjectNameForOverlay(goal, state.players);
    const metric = B.getMetricDefForOverlay(goal.targetItem);
    svg
      .append("text")
      .attr("x", m.left)
      .attr("y", 12)
      .attr("fill", "#f8e7a1")
      .style("font-size", "11px")
      .text(`${subj} / ${metric.label} 目標 ${goal.targetValue}${progress.isRate ? "%" : ""}`);

    const startAnimation = () => {
      const totalLength = trendPath.node()?.getTotalLength?.() || 0;
      if (totalLength > 0) {
        trendPath
          .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .duration(3000)
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);
      }
      circles
        .transition()
        .delay((_, i) => 300 + i * 180)
        .duration(420)
        .attr("opacity", 1);
      targetLine.attr("opacity", 0).transition().delay(300).duration(700).attr("opacity", 1);
    };

    if (typeof IntersectionObserver === "undefined") {
      startAnimation();
      return;
    }
    const observer = new IntersectionObserver(
      (entries, obs) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        startAnimation();
        obs.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(container);
  }

  function buildDetailHtml(goal, pr, state) {
    const B = window.SakuraGoalBadge;
    const ord = peerOrdinal(state, goal);
    const metric = B.getMetricDefForOverlay(goal.targetItem);
    const metricLabel = metric.label;
    const statusClass =
      pr.status === "achieved" ? "achieved" : pr.status === "ongoing_achieving" ? "achieving" : "progressing";
    const achievementClass =
      pr.status === "achieved" ? "achieved" : pr.status === "ongoing_achieving" ? "achieving" : "progressing";
    const achievementText =
      pr.status === "achieved"
        ? `<i class="fa-solid fa-award"></i>目標達成！確定済み`
        : pr.status === "ongoing_achieving"
          ? `<i class="fa-solid fa-circle-check"></i>目標達成中！`
          : `<i class="fa-solid fa-chart-line"></i>目標未達`;
    return `
      <article class="goal-item goal-notice-detail-article">
        <div class="head">
          <div>
            <div style="font-size:15px;font-weight:700;color:#f8f3df;">目標${ord}: ${metricLabel} ${goal.targetValue}${metric.type === "rate" ? "%" : ""}</div>
            <div class="meta">${goalRangeLabel(goal, state.tournaments)}</div>
            <div class="meta">対象: ${B.getGoalSubjectNameForOverlay(goal, state.players)}</div>
            <div class="meta">種別: ${goal.goalType === "short" ? "短期（大会）" : "長期"}</div>
          </div>
          <span class="status ${statusClass}">${pr.statusText}</span>
        </div>
        <div class="meta">現在: ${pr.isRate ? fmtPercent(pr.currentValue) : pr.currentValue.toFixed(1)}</div>
        <div class="achievement-banner ${achievementClass}">${achievementText} <span style="font-weight:500;">${B.buildProgressMessageForOverlay(goal, pr)}</span></div>
      </article>
    `;
  }

  function buildAchievementHtml(goal, pr) {
    const B = window.SakuraGoalBadge;
    if (pr.status === "achieved") {
      return `<div class="graph-achievement achieved"><i class="fa-solid fa-award"></i> 目標達成！ ${B.buildProgressMessageForOverlay(goal, pr)}</div>`;
    }
    if (pr.status === "ongoing_achieving") {
      return `<div class="graph-achievement challenging"><i class="fa-solid fa-circle-check"></i> 目標達成中！ ${B.buildProgressMessageForOverlay(goal, pr)}</div>`;
    }
    return `<div class="graph-achievement progressing"><i class="fa-solid fa-chart-line"></i> 目標未達 ${B.buildProgressMessageForOverlay(goal, pr)}</div>`;
  }

  function sanitizeFileName(v) {
    return String(v || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();
  }

  async function exportGoalGraphOverlay(goal, pr, chartEl, state) {
    if (typeof html2canvas === "undefined") {
      alert("画像出力には html2canvas が必要です。");
      return;
    }
    if (!chartEl?.querySelector?.("svg")) {
      alert("出力できるグラフがありません。");
      return;
    }
    const B = window.SakuraGoalBadge;
    const metric = B.getMetricDefForOverlay(goal.targetItem);
    const periodText =
      goal.goalType === "short"
        ? goalRangeLabel(goal, state.tournaments || [])
        : `期間: ${goal.startDate || "?"} ～ ${goal.endDate || "?"}`;
    const wrap = document.createElement("div");
    wrap.style.background = "#0f0f0f";
    wrap.style.color = "#f8f3df";
    wrap.style.padding = "12px";
    wrap.style.width = "1000px";
    wrap.style.border = "1px solid rgba(255,214,88,0.3)";
    wrap.style.borderRadius = "0";
    const meta = document.createElement("div");
    meta.style.display = "grid";
    meta.style.gap = "4px";
    meta.style.marginBottom = "10px";
    meta.innerHTML = `
      <div style="font-size:18px;font-weight:700;color:#ffd658;">進捗グラフ出力</div>
      <div style="font-size:13px;">対象: ${B.getGoalSubjectNameForOverlay(goal, state.players || [])}</div>
      <div style="font-size:13px;">項目: ${metric.label}</div>
      <div style="font-size:13px;">目標値: ${goal.targetValue}${metric.type === "rate" ? "%" : ""}</div>
      <div style="font-size:13px;">${periodText}</div>
      <div style="font-size:13px;">進捗度: ${pr.statusText}</div>
    `;
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
      const subj = B.getGoalSubjectNameForOverlay(goal, state.players || []);
      const filename = sanitizeFileName(`進捗グラフ_${subj}_${metric.label}_${goal.targetValue}_${pr.statusText}.png`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      wrap.remove();
      console.warn(e);
      alert("画像の生成に失敗しました。");
    }
  }

  function ensureDom() {
    if (overlayRoot) return;
    ensureCss();
    const wrap = document.createElement("div");
    wrap.id = "goalNoticeOverlayModal";
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="goal-overlay-backdrop" id="goalOverlayBackdrop"></div>
      <div class="modal-card goal-notice-detail-card">
        <div class="goal-notice-detail-head">
          <h3 id="goalOverlayTitle">目標の詳細</h3>
          <button type="button" class="goal-notice-detail-x" id="goalOverlayClose" aria-label="閉じる">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div id="goalOverlayBody" class="goal-notice-detail-body">
          <div id="goalOverlaySummary" class="goal-notice-detail-summary"></div>
          <p class="goal-notice-chart-heading">進捗グラフ</p>
          <div class="goal-notice-chart-scroll">
            <div class="graph-card goal-notice-chart-wrap">
              <div id="goal-chart-overlay" class="graph-body"></div>
            </div>
          </div>
          <div id="goalOverlayChartAch"></div>
          <div class="goal-actions">
            <button type="button" id="goalOverlayExportBtn">グラフを出力</button>
            <button type="button" id="goalOverlayOpenGoalsBtn">全ての目標を見る</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    let tip = document.getElementById("goalOverlayTooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "goalOverlayTooltip";
      tip.className = "hidden";
      document.body.appendChild(tip);
    }
    overlayRoot = wrap;

    const close = () => {
      const shouldReturn = shouldReturnToNoticesOnClose;
      shouldReturnToNoticesOnClose = false;
      wrap.hidden = true;
      lastGoalId = null;
      const chart = document.getElementById("goal-chart-overlay");
      if (chart) chart.innerHTML = "";
      document.getElementById("goalOverlaySummary").innerHTML = "";
      document.getElementById("goalOverlayChartAch").innerHTML = "";
      tip.classList.add("hidden");
      const body = document.getElementById("goalOverlayBody");
      if (body) body.scrollTop = 0;
      if (shouldReturn && typeof window.__siteNavOpenNotices === "function") {
        window.setTimeout(() => {
          void window.__siteNavOpenNotices("goals");
        }, 0);
      }
    };

    document.getElementById("goalOverlayClose").addEventListener("click", close);
    document.getElementById("goalOverlayBackdrop").addEventListener("click", close);
    document.getElementById("goalOverlayOpenGoalsBtn").addEventListener("click", () => {
      const id = lastGoalId;
      close();
      if (id) window.location.href = `./goals.html?focusGoal=${encodeURIComponent(id)}`;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || wrap.hidden) return;
      close();
    });
  }

  async function openGoalNoticeOverlay(goalId, options = {}) {
    const B = window.SakuraGoalBadge;
    if (!B?.fetchGoalOverlayState) {
      window.location.href = `./goals.html?focusGoal=${encodeURIComponent(goalId)}`;
      return;
    }
    const db = getDb();
    if (!db) {
      window.location.href = `./goals.html?focusGoal=${encodeURIComponent(goalId)}`;
      return;
    }
    ensureDom();
    shouldReturnToNoticesOnClose = options?.returnToNotices === true;
    try {
      const map = JSON.parse(localStorage.getItem("goal-read-map") || "{}");
      map[goalId] = true;
      localStorage.setItem("goal-read-map", JSON.stringify(map));
    } catch {}
    void window.__siteNavRefreshBell?.();

    const { state } = await B.fetchGoalOverlayState(db);
    if (!state?.goals?.length) {
      alert("目標データを読み込めませんでした。");
      return;
    }
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) {
      alert("該当の目標が見つかりません。");
      return;
    }
    lastGoalId = goalId;
    const pr = B.calcGoalProgressForOverlay(state, goal);
    const ord = peerOrdinal(state, goal);
    document.getElementById("goalOverlayTitle").textContent = `目標${ord} の詳細`;
    document.getElementById("goalOverlaySummary").innerHTML = buildDetailHtml(goal, pr, state);
    document.getElementById("goalOverlayChartAch").innerHTML = buildAchievementHtml(goal, pr);

    const chartEl = document.getElementById("goal-chart-overlay");
    chartEl.innerHTML = "";
    const tooltipEl = document.getElementById("goalOverlayTooltip");

    overlayRoot.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        drawProgressChart(chartEl, goal, pr, state, tooltipEl);
      });
    });

    const exportBtn = document.getElementById("goalOverlayExportBtn");
    exportBtn.onclick = () => void exportGoalGraphOverlay(goal, pr, chartEl, state);
  }

  window.__openGoalNoticeOverlay = function (goalId, options = {}) {
    void openGoalNoticeOverlay(goalId, options);
  };
})();
