/**
 * 吹き出し式チュートリアル（全22ステップ）
 * ・PC: STEPS_PC をそのまま使用（640px超も同様）。
 * ・幅≤768px: getSteps() で MOBILE_STEP_PROFILE を重ねたコピーを使用（selectorMobile 等は従来どおり）。
 * 依存: data-site-page（html）、各ページの #tutorial-* アンカー
 * 初回自動表示: Firebase `siteSettings/tutorialOfferFirstVisit`（false でオフ）。未設定はオン。
 * 手動（?）: `siteSettings/tutorialManualEnabled`（false で ? 非表示・openMenu 不可）。未設定はオン。
 *
 * スクロール範囲（任意）:
 * - scrollFitSelector: 文字列1つ … ハイライト対象に加え、画面に収めたい矩形（親ブロック等）のセレクタ
 * - scrollFitSelectors: 文字列配列 … 上記を複数指定（すべての矩形の和でスクロールする）
 * 未指定のときはハイライト要素（±マージン）だけを基準に自動スクロールする。
 */
(function () {
  const LS_COMPLETED = "sakuraTutorialCompleted";
  const SS_ACTIVE = "sakuraTutorialSessionActive";
  const SS_STEP = "sakuraTutorialStepIndex";

  function pageKey() {
    return document.documentElement.getAttribute("data-site-page") || "index";
  }

  function readStep() {
    try {
      return Math.max(0, parseInt(sessionStorage.getItem(SS_STEP) || "0", 10) || 0);
    } catch {
      return 0;
    }
  }

  function writeStep(i) {
    try {
      sessionStorage.setItem(SS_STEP, String(i));
    } catch (_) {}
  }

  function isSessionActive() {
    try {
      return sessionStorage.getItem(SS_ACTIVE) === "1";
    } catch {
      return false;
    }
  }

  function setSessionActive(on) {
    try {
      if (on) sessionStorage.setItem(SS_ACTIVE, "1");
      else sessionStorage.removeItem(SS_ACTIVE);
    } catch (_) {}
  }

  function isCompleted() {
    try {
      return localStorage.getItem(LS_COMPLETED) === "true";
    } catch {
      return false;
    }
  }

  function markCompleted() {
    try {
      localStorage.setItem(LS_COMPLETED, "true");
    } catch (_) {}
    setSessionActive(false);
    try {
      sessionStorage.removeItem(SS_STEP);
    } catch (_) {}
  }

  /** site-nav.css と同じ 768px 境界 */
  function isMobileNavViewport() {
    return Boolean(window.matchMedia?.("(max-width: 768px)")?.matches);
  }

  /** 現在のステップでハイライトするセレクタ（スマホでは selectorMobile を優先） */
  function getStepTargetSelector(step) {
    if (step.selectorMobile && isMobileNavViewport()) return step.selectorMobile;
    return step.selector;
  }

  /**
   * index.html 用：accordion.js の toggleAccordionAnimated でアコーディオンを開く
   */
  function openIndexAccordionIfClosed(bodyId, iconId) {
    const body = document.getElementById(bodyId);
    const icon = document.getElementById(iconId);
    if (!body || !icon) return;
    if (!body.classList.contains("hidden")) return;
    if (typeof toggleAccordionAnimated !== "function") return;
    toggleAccordionAnimated(body, icon);
    scheduleAccordionLayoutRelayout(body);
  }

  /** アコーディオン開閉アニメ後にレイアウトを合わせる */
  function scheduleAccordionLayoutRelayout(bodyEl) {
    let ran = false;
    const run = () => {
      if (ran) return;
      ran = true;
      syncTutorialLayoutFromDom();
    };
    if (bodyEl && typeof bodyEl.addEventListener === "function") {
      const onEnd = (ev) => {
        if (ev.propertyName !== "max-height") return;
        bodyEl.removeEventListener("transitionend", onEnd);
        run();
      };
      bodyEl.addEventListener("transitionend", onEnd);
    }
    window.setTimeout(run, 380);
  }

  /** @type {{ id: string, page: string, selector: string, selectorMobile?: string, position: string, title: string, content: string, contentMobile?: string, beforeShow?: () => void, refreshDelayMs?: number, waitSelector?: string, scrollFitSelector?: string, scrollFitSelectors?: string[], highlightUnionSelectors?: string[], scrollIntoBlock?: "start", scrollHighlightY?: "center", deferredLayoutResyncMs?: number, tutorialStackCardBelow?: boolean }[]} */
  const STEPS_PC = [
    {
      id: "home-view-mode",
      page: "index",
      selector: "#playerLoginButton",
      position: "bottom",
      title: "【閲覧モードについて】",
      content:
        "成績の閲覧・絞り込み・表やランキング・出力は、ACCESS の「VIEW / 閲覧モード」から行います。\n実際の操作はチュートリアル終了後に行えます。ここではボタンの位置と役割だけを示しています。",
    },
    {
      id: "home-metrics",
      page: "index",
      selector: "#tutorial-home-metrics",
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【集計項目の定義】",
      content:
        "各項目（アタック成功率、キャッチ率など）の定義は、このアコーディオンにまとまっています。\n開くと一覧で確認できます。チュートリアル中は画面の操作はできません。",
      beforeShow() {
        openIndexAccordionIfClosed("metricsAccordionBody", "metricsAccordionIcon");
      },
    },
    {
      id: "home-nav",
      page: "index",
      selector: "#siteNavBar",
      selectorMobile: "#siteNavHamburger",
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【ナビゲーション】",
      content:
        "本サイトは主に次の3ページで構成されています。\n・ホーム：成績の閲覧と出力\n・分析：グラフによる可視化\n・目標：目標と進捗の確認",
      beforeShow() {
        if (isMobileNavViewport() && typeof window.__siteNavSetDrawerOpen === "function") {
          window.__siteNavSetDrawerOpen(true);
        }
      },
    },
    {
      id: "tournament-select",
      page: "index",
      selector: "#tournamentSelect",
      waitSelector: "#tournamentSelect",
      refreshDelayMs: 900,
      tutorialStackCardBelow: true,
      position: "bottom",
      title: "【大会を選択】",
      content:
        "閲覧する大会は、このドロップダウンで選びます。\n※ チュートリアルでは閲覧モードへ切り替えたあと、自動で先頭の大会が選ばれる場合があります。表示が整ってから「次へ」を押してください。",
      beforeShow() {
        const loginCard = document.getElementById("loginCard");
        if (loginCard && !loginCard.classList.contains("hidden")) {
          document.getElementById("playerLoginButton")?.click();
        }
      },
    },
    {
      id: "view-filter-conditions-matches",
      page: "index",
      selector: "#tutorial-viewer-filter-conditions-matches",
      waitSelector: "#viewerSection",
      refreshDelayMs: 850,
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【条件・試合で絞り込み】",
      content:
        "「条件で絞り込み」では試合区分（予選・トーナメント）と対戦相手を選べます。「試合で絞り込み」では表示に含める試合を選びます。\nこの2つを組み合わせて、見たい成績の範囲を決められます。",
      beforeShow() {
        const loginCard = document.getElementById("loginCard");
        if (loginCard && !loginCard.classList.contains("hidden")) {
          document.getElementById("playerLoginButton")?.click();
        }
      },
    },
    {
      id: "view-player-and-sort",
      page: "index",
      selector: "#tutorial-viewer-player-and-sort",
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 200,
      position: "bottom",
      title: "【選手で絞り込み・並び替え】",
      content:
        "「選手で絞り込み」で表示する選手を選びます。すぐ下の「並び替え」で、並べ替えの基準となる項目（アタック成功率、キャッチ数など）と昇順・降順を選べます。",
    },
    {
      id: "view-totals-and-ranking",
      page: "index",
      selector: "#tutorial-viewer-totals-and-ranking",
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 480,
      tutorialStackCardBelow: true,
      position: "bottom",
      title: "【集計サマリー・ランキング】",
      content:
        "「集計サマリー」では主要指標の合計・平均を確認できます。「ランキング」ではアタック成功数・キャッチ数・貢献度などの上位5名を表示します。上部の絞り込み条件がそのまま反映されます。",
      beforeShow() {
        openIndexAccordionIfClosed("viewerTotalsAccordionBody", "viewerTotalsAccordionIcon");
        openIndexAccordionIfClosed("viewerRankingAccordionBody", "viewerRankingAccordionIcon");
      },
    },
    {
      id: "view-table",
      page: "index",
      selector: "#tutorial-viewer-table",
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 200,
      position: "top",
      title: "【成績表】",
      content:
        "現在の絞り込み結果が、このテーブルに一覧表示されます。\n表の見出し（選手名・出場数など）を押すと、その列を基準に並び替えができます。",
    },
    {
      id: "view-export",
      page: "index",
      selector: "#exportViewerCsvButton",
      scrollIntoBlock: "start",
      scrollHighlightY: "center",
      deferredLayoutResyncMs: 200,
      position: "left",
      title: "【出力機能】",
      content:
        "「📥 出力」から、現在の絞り込み結果を PDF・CSV・画像形式で保存できます。\n複数大会をまとめて出力する操作にも対応しています。",
    },
    {
      id: "analytics-filters",
      page: "analytics",
      selector: "#tutorial-analytics-filters",
      position: "bottom",
      title: "【Analytics 集計の絞り込み条件】",
      content:
        "分析ページ上部の「Analytics 集計」で、集計対象大会・試合区分・対戦相手・選手名などから、グラフとランキングの対象範囲を絞り込めます。\n条件を変えると、下のグラフ表示の内容も連動して更新されます。",
    },
    {
      id: "analytics-graph-trends",
      page: "analytics",
      selector: '[data-graph-id="g1"]',
      waitSelector: '[data-graph-id="g1"]',
      refreshDelayMs: 900,
      scrollFitSelectors: ['[data-graph-id="g1"]', '[data-graph-id="g2"]'],
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【個人成績推移・チーム全体推移】",
      content:
        "「個人成績推移」は選手ごとの推移、「チーム全体推移」はチーム合計の推移を折れ線で見られます。\n同じページには「対戦相手別成績」「学年別成績」などの棒グラフも並びます（ドラッグでカードの並び順を入れ替えられます）。",
      beforeShow() {
        openAccordionByTarget("graphsBody");
      },
    },
    {
      id: "analytics-graph-controls",
      page: "analytics",
      selector: '[data-graph-tournament="g1"]',
      waitSelector: '[data-graph-id="g1"]',
      refreshDelayMs: 900,
      scrollFitSelectors: [
        '[data-graph-tournament="g1"]',
        '[data-graph-player="g1"]',
        '.graph-card[data-graph-id="g1"] .metric-picker-label--trend',
        '[data-graph-metric-check-wrap="g1"]',
      ],
      highlightUnionSelectors: [
        '[data-graph-player="g1"]',
        '.graph-card[data-graph-id="g1"] .metric-picker-label--trend',
        '[data-graph-metric-check-wrap="g1"]',
      ],
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【個人・チーム推移の絞り込み（カード内）】",
      content:
        "ここでは「個人成績推移」「チーム全体推移」の各カード内の操作です。\nカード上で、そのグラフ用の大会・選手を選び、個人・チーム推移では表示する項目を複数チェックして重ねて表示できます（最大7項目）。\nページ最上部の Analytics 集計ツールバーでの絞り込みは別のステップで説明しています。",
      beforeShow() {
        openAccordionByTarget("graphsBody");
      },
    },
    {
      id: "analytics-graph-opponent-grade",
      page: "analytics",
      selector: '[data-graph-id="g4"]',
      waitSelector: '[data-graph-id="g4"]',
      refreshDelayMs: 900,
      scrollFitSelectors: ['[data-graph-id="g4"]', '[data-graph-id="g5"]'],
      scrollIntoBlock: "start",
      position: "bottom",
      title: "【対戦相手別・学年別成績】",
      content:
        "「対戦相手別成績」では相手チームごとの比較、「学年別成績」では学年ごとの比較ができます。\n単一大会に切り替えて見るグラフです。",
      beforeShow() {
        openAccordionByTarget("graphsBody");
      },
    },
    {
      id: "analytics-graph-export-g1",
      page: "analytics",
      selector: 'button[data-export-graph="g1"]',
      waitSelector: 'button[data-export-graph="g1"]',
      refreshDelayMs: 900,
      scrollFitSelectors: ['[data-graph-id="g1"]'],
      position: "left",
      title: "【グラフの出力】",
      content:
        "例として「個人成績推移」カードの「出力」ボタンから、そのグラフを PNG・JPG・SVG で保存できます。\n他のグラフカードでも同様に出力できます。",
      beforeShow() {
        openAccordionByTarget("graphsBody");
      },
    },
    {
      id: "goals-view-mode",
      page: "goals",
      selector: "#viewerModeButton",
      position: "bottom",
      title: "【目標ページ・閲覧モード】",
      content:
        "目標の一覧・進捗グラフ・通知の閲覧は、ACCESS の「VIEW / 閲覧モード」から行います。\n次のステップ以降で、チュートリアルがワークスペースを開きます。",
    },
    {
      id: "goals-player",
      page: "goals",
      selector: "#tutorial-goals-player-section",
      waitSelector: "#goalsWorkspace",
      refreshDelayMs: 450,
      position: "bottom",
      title: "【選手を選択】",
      content:
        "対象の選手または「チーム全体」は、このドロップダウンで選びます。\n選ぶと、下の目標一覧・進捗グラフ・通知が使える状態になります。\n※ チュートリアルでは、未選択のときだけ先頭の候補を自動で選びます。",
      beforeShow() {
        const ws = document.getElementById("goalsWorkspace");
        if (ws?.classList.contains("hidden")) {
          document.getElementById("viewerModeButton")?.click();
        }
        pickFirstGoalsPlayerIfEmpty();
      },
    },
    {
      id: "goals-list",
      page: "goals",
      selector: "#tutorial-goals-list-section",
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 420,
      position: "bottom",
      title: "【目標一覧】",
      content:
        "選択した対象に紐づく目標が一覧になります。\n一覧から目標を選ぶと、詳細や進捗を追いやすくなります。必要に応じてチュートリアルがこの枠を開きます。",
      beforeShow() {
        openAccordionByTarget("goalListBody");
      },
    },
    {
      id: "goals-graph-first",
      page: "goals",
      selector: "[data-tutorial-first-goal-graph]",
      waitSelector: "[data-tutorial-first-goal-graph]",
      refreshDelayMs: 900,
      deferredLayoutResyncMs: 280,
      scrollIntoBlock: "start",
      position: "top",
      title: "【進捗をグラフで確認】",
      content:
        "例として、一覧の先頭に表示される目標のグラフを示しています。\n目標値のラインと実績の推移を重ねて、達成状況を確認できます。",
      beforeShow() {
        openAccordionByTarget("graphBody");
      },
    },
    {
      id: "goals-graph-export",
      page: "goals",
      selector: "[data-tutorial-first-goal-graph] [data-goal-export]",
      waitSelector: "[data-tutorial-first-goal-graph] [data-goal-export]",
      refreshDelayMs: 900,
      deferredLayoutResyncMs: 220,
      scrollIntoBlock: "start",
      position: "left",
      title: "【グラフを出力】",
      content:
        "進捗グラフ付近の「グラフを出力」から、表示中のグラフを画像として保存できます。",
      beforeShow() {
        openAccordionByTarget("graphBody");
      },
    },
    {
      id: "goals-notice",
      page: "goals",
      selector: '#tutorial-goals-notice-section .accordion-btn[data-target="noticeBody"]',
      scrollFitSelectors: ["#noticeList .notice:first-of-type"],
      highlightUnionSelectors: ["#noticeList .notice:first-of-type"],
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 420,
      position: "bottom",
      title: "【通知】",
      content:
        "目標の達成中・未達・達成などの通知が一覧で表示されます。「すべて既読にする」で未読をまとめて消せます。\n\n通知の1件を押すと、その目標の詳細が開きます。例：目標のタイトル、大会名、対象（チーム全体など）、種別、ステータス、現在値とメッセージ、進捗グラフ、「グラフを出力」ボタンまで、ひと続きで確認・出力できます。",
      beforeShow() {
        openAccordionByTarget("noticeBody");
      },
    },
    {
      id: "tutorial-reopen",
      page: "goals",
      selector: "#siteNavHelpBtn",
      position: "bottom",
      title: "【チュートリアルを再度開く】",
      content:
        "この案内はいつでも開き直せます。\n画面上部のはてな（?）ボタンからチュートリアル一覧を開けます（通知ベルのすぐ隣です）。",
    },
    {
      id: "tutorial-confidential",
      page: "goals",
      selector: "#tutorial-goals-confidential-banner",
      scrollIntoBlock: "start",
      deferredLayoutResyncMs: 120,
      position: "bottom",
      title: "【重要・CONFIDENTIAL】",
      content:
        "画面上部のこの注意書きと同じ内容です。チーム関係者のみが利用する内部用であり、第三者・他チーム・一般の方への共有・転送・SNS掲載は禁止です。漏えいが起きた場合は速やかに監督・スタッフへ報告してください。",
    },
  ];

  /**
   * 幅 ≤768px のときだけ適用するステップ上書き（PC の STEPS_PC と同じ長さ・同じ id 順）。
   * 主に狭い幅で左・上の吹き出しが画面外に出やすい箇所を下寄せにし、横長のスクロール和を緩める。
   */
  const MOBILE_STEP_PROFILE = {
    "view-table": { position: "bottom" },
    "view-export": { position: "bottom" },
    "analytics-graph-trends": {
      scrollFitSelectors: ['[data-graph-id="g1"]'],
    },
    "analytics-graph-export-g1": { position: "bottom" },
    "goals-graph-first": { position: "bottom" },
    "goals-graph-export": { position: "bottom" },
  };

  let stepsCache = null;
  /** @type {string} */
  let stepsCacheKey = "";

  function invalidateStepsCache() {
    stepsCache = null;
    stepsCacheKey = "";
  }

  /** 現在のビューポート用ステップ一覧（PC は常に STEPS_PC の参照のまま） */
  function getSteps() {
    const key = isMobileNavViewport() ? "mobile" : "pc";
    if (stepsCache && stepsCacheKey === key) return stepsCache;
    stepsCacheKey = key;
    if (key === "pc") {
      stepsCache = STEPS_PC;
      return stepsCache;
    }
    stepsCache = STEPS_PC.map((s) => ({ ...s, ...(MOBILE_STEP_PROFILE[s.id] || {}) }));
    return stepsCache;
  }

  function setTutorialMobileUiClass() {
    const on =
      Boolean(overlayEl && !overlayEl.hasAttribute("hidden")) && isMobileNavViewport();
    document.documentElement.classList.toggle("tutorial-is-mobile", on);
  }

  function openAccordionByTarget(bodyId) {
    const btn = document.querySelector(`.accordion-btn[data-target="${bodyId}"]`);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;
    if (body.classList.contains("hidden")) {
      btn.click();
      scheduleAccordionLayoutRelayout(body);
    }
  }

  /** 目標ページで選手が未選択のとき、一覧などを見られるよう先頭候補を選ぶ（閲覧用の見せ方の補助） */
  function pickFirstGoalsPlayerIfEmpty() {
    const sel = document.getElementById("playerSelect");
    if (!sel || sel.value) return;
    const opts = Array.from(sel.options);
    const firstPlayer = opts.find((o) => {
      const v = o.value;
      return Boolean(v) && v !== "team";
    });
    if (firstPlayer) {
      sel.value = firstPlayer.value;
    } else {
      const team = opts.find((o) => o.value === "team");
      if (!team) return;
      sel.value = "team";
    }
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  let overlayEl = null;
  let highlightEl = null;
  let tooltipEl = null;
  let menuModalEl = null;
  let menuCloseTimer = null;
  let scrollHandler = null;
  /** 閲覧エリア表示待ちの再レイアウト用 */
  let pendingRefreshTimer = null;
  let pendingRefreshStepIndex = null;

  function clearPendingRefresh() {
    if (pendingRefreshTimer) {
      window.clearTimeout(pendingRefreshTimer);
      pendingRefreshTimer = null;
    }
    pendingRefreshStepIndex = null;
  }

  /** チュートリアルでハイライト可能か（祖先の hidden やサイズゼロは不可） */
  function isTutorialTargetVisible(node) {
    if (!node) return false;
    let n = node;
    while (n && n !== document.documentElement) {
      if (n.classList?.contains("hidden")) return false;
      n = n.parentElement;
    }
    const st = window.getComputedStyle(node);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = node.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function ensureDom() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "tutorialOverlay";
    overlayEl.className = "tutorial-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("hidden", "");

    highlightEl = document.createElement("div");
    highlightEl.className = "tutorial-highlight";
    highlightEl.setAttribute("aria-hidden", "true");

    tooltipEl = document.createElement("div");
    tooltipEl.className = "tutorial-tooltip";
    tooltipEl.innerHTML = `
      <div class="tutorial-tooltip-header">
        <h3 class="tutorial-tooltip-title"></h3>
        <button type="button" class="tutorial-close-btn" aria-label="閉じる">×</button>
      </div>
      <div class="tutorial-tooltip-body"></div>
      <div class="tutorial-tooltip-footer">
        <button type="button" class="tutorial-skip-btn">スキップ</button>
        <div class="tutorial-nav-btns">
          <button type="button" class="tutorial-next-btn">次へ →</button>
        </div>
        <div class="tutorial-progress"></div>
      </div>
    `;

    overlayEl.appendChild(highlightEl);
    overlayEl.appendChild(tooltipEl);
    document.body.appendChild(overlayEl);

    tooltipEl.querySelector(".tutorial-close-btn").addEventListener("click", () => skipTutorial());
    tooltipEl.querySelector(".tutorial-skip-btn").addEventListener("click", () => skipTutorial());
    tooltipEl.querySelector(".tutorial-next-btn").addEventListener("click", () => goRelative(1));

    menuModalEl = document.createElement("div");
    menuModalEl.id = "tutorialMenuModal";
    menuModalEl.className = "tutorial-menu-modal";
    menuModalEl.setAttribute("hidden", "");
    menuModalEl.innerHTML = `
      <div class="tutorial-menu-card" role="dialog" aria-modal="true" aria-labelledby="tutorialMenuTitle">
        <h2 id="tutorialMenuTitle">チュートリアル</h2>
        <p>ご案内したいページをお選びください。途中のステップから開始することもできます。</p>
        <div class="tutorial-menu-list">
          <button type="button" class="tutorial-menu-choice" data-tutorial-start="0">
            <span class="tutorial-menu-icon" aria-hidden="true">
              <svg class="tutorial-menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" d="M12 3.5 3.8 9.6V19.5c0 .6.5 1.1 1.1 1.1h4.9v-6.7h4.4v6.7h4.9c.6 0 1.1-.5 1.1-1.1V9.6L12 3.5z" />
                <path fill="currentColor" fill-opacity="0.2" d="M12 5.2 6.2 9.4h11.6L12 5.2z" />
              </svg>
            </span>
            <span class="tutorial-menu-label">ホーム<span class="tutorial-menu-steps">（3ステップ）</span></span>
          </button>
          <button type="button" class="tutorial-menu-choice" data-tutorial-start="3">
            <span class="tutorial-menu-icon" aria-hidden="true">
              <svg class="tutorial-menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <rect x="4.5" y="5" width="15" height="11" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.35" />
                <path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M8 19.5h8" />
                <circle cx="12" cy="10.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.25" />
                <circle cx="12" cy="10.5" r="0.9" fill="currentColor" />
              </svg>
            </span>
            <span class="tutorial-menu-label">閲覧モード<span class="tutorial-menu-steps">（6ステップ）</span></span>
          </button>
          <button type="button" class="tutorial-menu-choice" data-tutorial-start="9">
            <span class="tutorial-menu-icon" aria-hidden="true">
              <svg class="tutorial-menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" d="M5.5 18V11M12 18V7.5M18.5 18V4.5" />
                <path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.55" d="M4.5 9.5 12 6l7.5 2.5" />
              </svg>
            </span>
            <span class="tutorial-menu-label">分析画面<span class="tutorial-menu-steps">（5ステップ）</span></span>
          </button>
          <button type="button" class="tutorial-menu-choice" data-tutorial-start="14">
            <span class="tutorial-menu-icon" aria-hidden="true">
              <svg class="tutorial-menu-icon-svg" viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.2" />
                <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.2" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-opacity="0.45" d="M12 4v2M12 18v2M4 12h2M18 12h2" />
              </svg>
            </span>
            <span class="tutorial-menu-label">目標画面<span class="tutorial-menu-steps">（6ステップ）</span></span>
          </button>
        </div>
        <button type="button" class="tutorial-menu-close">閉じる</button>
      </div>
    `;
    document.body.appendChild(menuModalEl);

    menuModalEl.querySelector(".tutorial-menu-close").addEventListener("click", closeMenu);
    menuModalEl.addEventListener("click", (e) => {
      if (e.target === menuModalEl) closeMenu();
    });
    menuModalEl.querySelectorAll("[data-tutorial-start]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = parseInt(btn.getAttribute("data-tutorial-start") || "0", 10);
        closeMenu({ onClosed: () => startAtStep(n) });
      });
    });
  }

  function closeMenu({ immediate = false, onClosed = null } = {}) {
    if (!menuModalEl) return;
    window.clearTimeout(menuCloseTimer);
    menuCloseTimer = null;
    const finishClose = () => {
      if (!menuModalEl) return;
      menuModalEl.classList.remove("is-open");
      menuModalEl.setAttribute("hidden", "");
      if (typeof onClosed === "function") onClosed();
    };
    if (immediate) {
      finishClose();
      return;
    }
    menuModalEl.classList.remove("is-open");
    const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const waitMs = reduceMotion ? 0 : 280;
    menuCloseTimer = window.setTimeout(() => {
      menuCloseTimer = null;
      finishClose();
    }, waitMs);
  }

  let manualDisabledToastTimer = null;

  /** 手動チュートリアル無効時: ? 押下で表示（site-nav からも呼ぶ） */
  function notifyManualTutorialDisabled() {
    let el = document.getElementById("tutorialManualDisabledToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "tutorialManualDisabledToast";
      el.className = "tutorial-manual-disabled-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = "現在チュートリアルは使用できません。";
    el.removeAttribute("hidden");
    if (manualDisabledToastTimer) window.clearTimeout(manualDisabledToastTimer);
    manualDisabledToastTimer = window.setTimeout(() => {
      el.setAttribute("hidden", "");
      manualDisabledToastTimer = null;
    }, 3600);
  }

  function openMenu() {
    if (window.__SAKURA_TUTORIAL_MANUAL_ENABLED === false) {
      notifyManualTutorialDisabled();
      return;
    }
    ensureDom();
    window.clearTimeout(menuCloseTimer);
    menuCloseTimer = null;
    menuModalEl.removeAttribute("hidden");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        menuModalEl?.classList.add("is-open");
      });
    });
  }

  function skipTutorial() {
    markCompleted();
    closeAll();
  }

  function closeAll() {
    clearPendingRefresh();
    detachListeners();
    unlockTutorialViewport();
    if (typeof window.__siteNavSetDrawerOpen === "function") {
      window.__siteNavSetDrawerOpen(false);
    }
    if (overlayEl) overlayEl.setAttribute("hidden", "");
    /** 章選択モーダルも閉じないと :has(#tutorialMenuModal:not([hidden])) でログイン情報カードが消えたままになる */
    closeMenu({ immediate: true });
    highlightEl?.classList.remove("tutorial-highlight--placeholder");
    document.documentElement.classList.remove("tutorial-is-mobile");
    invalidateStepsCache();
  }

  function detachListeners() {
    if (scrollHandler) {
      window.removeEventListener("resize", scrollHandler);
      document.removeEventListener("fullscreenchange", scrollHandler);
      window.visualViewport?.removeEventListener("resize", scrollHandler);
      window.visualViewport?.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }
  }

  function attachListeners() {
    detachListeners();
    scrollHandler = () => {
      invalidateStepsCache();
      syncTutorialLayoutFromDom();
      setTutorialMobileUiClass();
    };
    window.addEventListener("resize", scrollHandler);
    document.addEventListener("fullscreenchange", scrollHandler);
    /** アドレスバー表示切替・ピンチズーム等（Safari / Chrome 系） */
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scrollHandler);
      window.visualViewport.addEventListener("scroll", scrollHandler, { passive: true });
    }
  }

  function navigateForStep(stepIndex) {
    const step = getSteps()[stepIndex];
    if (!step) return false;
    const key = pageKey();
    if (step.page === key) return false;
    const map = { index: "./index.html", analytics: "./analytics.html", goals: "./goals.html" };
    const href = map[step.page];
    if (!href) return false;
    writeStep(stepIndex);
    setSessionActive(true);
    window.location.href = href;
    return true;
  }

  const HIGHLIGHT_MARGIN = 4;
  const EDGE_PAD = 10;
  const TOOLTIP_GAP = 20;

  /**
   * 吹き出し・収め込み計算用の「見えている」幅。
   * innerWidth だけだと iOS Safari / Chrome モバイルでアドレスバー展開時などズレが出るため visualViewport を優先する。
   */
  function getTutorialViewportWidth() {
    const vv = window.visualViewport;
    if (vv != null && typeof vv.width === "number" && vv.width > 8) return vv.width;
    return window.innerWidth;
  }

  /** 同上（縦） */
  function getTutorialViewportHeight() {
    const vv = window.visualViewport;
    if (vv != null && typeof vv.height === "number" && vv.height > 8) return vv.height;
    return window.innerHeight;
  }

  /** document ルートが横スクロール可能か。効かない window.scrollBy({ left }) によるハイライトずれを防ぐ */
  function canWindowScrollHorizontally() {
    const d = document.documentElement;
    const w = d?.scrollWidth ?? 0;
    const c = d?.clientWidth ?? 0;
    return w > c + 1;
  }

  /** ビューポート端の有効余白（固定ナビ下の本文開始を考慮） */
  function getViewportPads() {
    const root = document.documentElement;
    let top = EDGE_PAD;
    if (document.body?.classList.contains("has-site-nav")) {
      const raw = getComputedStyle(root).getPropertyValue("--site-nav-h").trim();
      const navPx = parseFloat(raw);
      /** 固定ナビの上端が欠けないよう、おおよそナビ2本分の余白を確保 */
      top = Number.isFinite(navPx) ? navPx * 2 + 24 : 124;
    }
    return { top, bottom: EDGE_PAD, left: EDGE_PAD, right: EDGE_PAD };
  }

  let tutorialViewportLocked = false;
  let wheelTouchBlocker = null;

  function lockTutorialViewport() {
    if (tutorialViewportLocked) return;
    tutorialViewportLocked = true;
    document.documentElement.classList.add("tutorial-scroll-locked");
    document.body.classList.add("tutorial-scroll-locked");
    wheelTouchBlocker = (e) => {
      if (!overlayEl || overlayEl.hasAttribute("hidden")) return;
      const t = e.target;
      if (t && typeof t.closest === "function" && t.closest(".tutorial-tooltip")) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", wheelTouchBlocker, { passive: false, capture: true });
    document.addEventListener("touchmove", wheelTouchBlocker, { passive: false, capture: true });
  }

  function unlockTutorialViewport() {
    if (!tutorialViewportLocked) return;
    tutorialViewportLocked = false;
    document.documentElement.classList.remove("tutorial-scroll-locked");
    document.body.classList.remove("tutorial-scroll-locked");
    if (wheelTouchBlocker) {
      document.removeEventListener("wheel", wheelTouchBlocker, { capture: true });
      document.removeEventListener("touchmove", wheelTouchBlocker, { capture: true });
      wheelTouchBlocker = null;
    }
  }

  function highlightBoxFromTargetRect(r, m = HIGHLIGHT_MARGIN) {
    return {
      left: r.left - m,
      top: r.top - m,
      right: r.right + m,
      bottom: r.bottom + m,
    };
  }

  /** 矩形同士が gap 未満で近すぎる（重なり＋余白不足） */
  function rectsTooClose(a, b, gap) {
    const separated =
      a.right + gap <= b.left || a.left - gap >= b.right || a.bottom + gap <= b.top || a.top - gap >= b.bottom;
    return !separated;
  }

  /** ハイライト対象 ± マージン、および step の scrollFit* で指定した要素矩形の和（ビューポート座標） */
  function getScrollFitUnion(el, step) {
    const m = HIGHLIGHT_MARGIN;
    const parts = [];
    const pushNode = (node) => {
      if (!node || typeof node.getBoundingClientRect !== "function") return;
      const r = node.getBoundingClientRect();
      if (r.width < 0.5 && r.height < 0.5) return;
      const box = highlightBoxFromTargetRect(r, m);
      parts.push(box);
    };
    pushNode(el);
    const extra = [];
    if (step?.scrollFitSelector) extra.push(step.scrollFitSelector);
    if (Array.isArray(step?.scrollFitSelectors)) extra.push(...step.scrollFitSelectors);
    for (const sel of extra) {
      const node = typeof sel === "string" ? document.querySelector(sel) : null;
      if (!node || node === el) continue;
      pushNode(node);
    }
    if (!parts.length) return null;
    let top = Infinity;
    let left = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;
    for (const p of parts) {
      top = Math.min(top, p.top);
      left = Math.min(left, p.left);
      bottom = Math.max(bottom, p.bottom);
      right = Math.max(right, p.right);
    }
    return { top, bottom, left, right, h: bottom - top, w: right - left };
  }

  /**
   * 主ターゲットとは別要素を黄色枠に足すステップ（通知など）のみ true。
   * scrollFitSelector だけのときは false（初期 scrollIntoView＋従来の scrollFit 和で足りる）。
   * tall な見出し＋下方向へ伸びる別要素で、主要素だけ scrollIntoView だと下端が欠ける問題向け。
   */
  function usesHighlightUnionScrollFix(step) {
    return Array.isArray(step?.highlightUnionSelectors) && step.highlightUnionSelectors.length > 0;
  }

  /** 黄色枠（要素 ± マージン）と scrollFit 指定範囲の和がビューポート内に収まるよう window をスクロール */
  function scrollUntilHighlightFitsInViewport(el, step) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const pads = getViewportPads();
    const vh = getTutorialViewportHeight();
    const vw = getTutorialViewportWidth();
    const stepObj = step || {};

    function hb() {
      return getScrollFitUnion(el, stepObj);
    }

    const b0 = hb();
    if (!b0) return;

    const innerH = vh - pads.top - pads.bottom;
    const tall = b0.h > innerH + 0.5;

    if (tall) {
      if (!usesHighlightUnionScrollFix(stepObj)) {
        el.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      }
      for (let i = 0; i < 28; i++) {
        const b = hb();
        if (!b) break;
        let dy = 0;
        if (b.top < pads.top) dy = b.top - pads.top;
        else if (b.bottom > vh - pads.bottom) dy = b.bottom - (vh - pads.bottom);
        if (Math.abs(dy) < 0.5) break;
        window.scrollBy({ left: 0, top: dy, behavior: "instant" });
      }
      for (let c = 0; c < 12; c++) {
        const b = hb();
        if (!b) break;
        if (b.top >= pads.top - 0.5) break;
        window.scrollBy({ left: 0, top: b.top - pads.top, behavior: "instant" });
      }
      if (usesHighlightUnionScrollFix(stepObj)) {
        for (let c = 0; c < 14; c++) {
          const b = hb();
          if (!b) break;
          if (b.bottom <= vh - pads.bottom + 1) break;
          window.scrollBy({ left: 0, top: b.bottom - (vh - pads.bottom), behavior: "instant" });
        }
      }
      return;
    }

    for (let iter = 0; iter < 24; iter++) {
      const b = hb();
      if (!b) break;
      let dy = 0;
      let dx = 0;
      if (b.top < pads.top) dy = b.top - pads.top;
      else if (b.bottom > vh - pads.bottom) dy = b.bottom - (vh - pads.bottom);
      if (b.left < pads.left) dx = b.left - pads.left;
      else if (b.right > vw - pads.right) dx = b.right - (vw - pads.right);
      if (dx !== 0 && !canWindowScrollHorizontally()) dx = 0;
      if (dx === 0 && dy === 0) break;
      window.scrollBy({ left: dx, top: dy, behavior: "instant" });
    }

    /** scrollFit の和集合の上端がナビ余白より上に残る場合の追いスクロール（tall 分岐の scrollIntoView との相性補正） */
    for (let c = 0; c < 12; c++) {
      const b = hb();
      if (!b) break;
      if (b.top >= pads.top - 0.5) break;
      window.scrollBy({ left: 0, top: b.top - pads.top, behavior: "instant" });
    }
    /** ハイライト和集合（別要素あり）のときのみ：下端の途切れを直す（tall 単体では上端優先と競合するため付けない） */
    if (usesHighlightUnionScrollFix(stepObj)) {
      for (let c = 0; c < 14; c++) {
        const b = hb();
        if (!b) break;
        if (b.bottom <= vh - pads.bottom + 1) break;
        window.scrollBy({ left: 0, top: b.bottom - (vh - pads.bottom), behavior: "instant" });
      }
    }
  }

  /**
   * 黄色枠用：主ターゲット + highlightUnionSelectors（任意）の矩形の和（マージン前）
   */
  function getHighlightTargetUnionRawRect(el, step) {
    if (!el) return null;
    const extras = Array.isArray(step?.highlightUnionSelectors) ? step.highlightUnionSelectors : [];
    if (!extras.length) return el.getBoundingClientRect();
    const nodes = [el];
    for (const sel of extras) {
      const n = typeof sel === "string" ? document.querySelector(sel) : null;
      if (n && n !== el) nodes.push(n);
    }
    let top = Infinity;
    let left = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;
    let got = false;
    for (const node of nodes) {
      if (!node || typeof node.getBoundingClientRect !== "function") continue;
      if (!isTutorialTargetVisible(node)) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 0.5 && r.height < 0.5) continue;
      got = true;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      bottom = Math.max(bottom, r.bottom);
      right = Math.max(right, r.right);
    }
    if (!got) return null;
    return { top, left, bottom, right, width: right - left, height: bottom - top };
  }

  function updateHighlightFromElement(el, step) {
    if (!el || !highlightEl) return;
    highlightEl.classList.remove("tutorial-highlight--placeholder");
    const m = HIGHLIGHT_MARGIN;
    const r = getHighlightTargetUnionRawRect(el, step) || el.getBoundingClientRect();
    highlightEl.style.top = `${r.top - m}px`;
    highlightEl.style.left = `${r.left - m}px`;
    highlightEl.style.width = `${r.width + m * 2}px`;
    highlightEl.style.height = `${r.height + m * 2}px`;
  }

  /** 黄色枠を上寄せし、吹き出しが下に収まる余白を確保（tutorialStackCardBelow 用） */
  function nudgeScrollForStackCardBelow(el, step) {
    if (!step?.tutorialStackCardBelow || !el) return;
    const pads = getViewportPads();
    const vh = getTutorialViewportHeight();
    const m = HIGHLIGHT_MARGIN;
    const gap = TOOLTIP_GAP;
    const ttEst = Math.min(440, Math.max(200, tooltipEl?.offsetHeight || 260));

    for (let iter = 0; iter < 8; iter++) {
      const raw = getHighlightTargetUnionRawRect(el, step) || el.getBoundingClientRect();
      const hb = highlightBoxFromTargetRect(raw, m);
      const bottomLimit = vh - pads.bottom;
      const needBelow = hb.bottom + gap + ttEst - bottomLimit;
      if (needBelow > 2) {
        window.scrollBy({ left: 0, top: needBelow, behavior: "instant" });
        continue;
      }
      const inner = vh - pads.top - pads.bottom;
      const targetTop = pads.top + Math.min(88, inner * 0.22);
      if (hb.top > targetTop + 10) {
        window.scrollBy({ left: 0, top: hb.top - targetTop, behavior: "instant" });
        continue;
      }
      break;
    }
  }

  /**
   * 吹き出しをハイライトと重ならない位置へ。優先順: 指定位置 → 下 → 上 → 右 → 左
   * @param {object} [step] ステップ（tutorialStackCardBelow で下寄せ・上側ハイライトを強く優先）
   */
  function positionTooltipAvoidOverlap(targetRect, pref, step) {
    const pads = getViewportPads();
    const gap = TOOLTIP_GAP;
    const m = HIGHLIGHT_MARGIN;
    const tt = tooltipEl;
    const vw = getTutorialViewportWidth();
    const vh = getTutorialViewportHeight();

    function tryOne(prefPos) {
      const tw = tt.offsetWidth || 320;
      const th = tt.offsetHeight || 220;
      const hb = highlightBoxFromTargetRect(targetRect, m);
      let left;
      let top;
      switch (prefPos) {
        case "top":
          top = hb.top - gap - th;
          left = (hb.left + hb.right) / 2 - tw / 2;
          break;
        case "left":
          left = hb.left - gap - tw;
          top = (hb.top + hb.bottom) / 2 - th / 2;
          break;
        case "right":
          left = hb.right + gap;
          top = (hb.top + hb.bottom) / 2 - th / 2;
          break;
        case "bottom":
        default:
          top = hb.bottom + gap;
          left = (hb.left + hb.right) / 2 - tw / 2;
          break;
      }
      left = Math.max(pads.left, Math.min(left, vw - tw - pads.right));
      top = Math.max(pads.top, Math.min(top, vh - th - pads.bottom));
      const tr = { left, top, right: left + tw, bottom: top + th };
      return { left, top, tw, th, hb, tr, prefPos };
    }

    function overlapPenalty(hb, tr) {
      if (!rectsTooClose(hb, tr, gap)) return 0;
      const iw = Math.min(tr.right, hb.right) - Math.max(tr.left, hb.left);
      const ih = Math.min(tr.bottom, hb.bottom) - Math.max(tr.top, hb.top);
      return 1e6 + Math.max(0, iw) * Math.max(0, ih);
    }

    const stackBelow = Boolean(step?.tutorialStackCardBelow);
    const order = stackBelow ? ["bottom", "right", "left", "top"] : [pref, "bottom", "top", "right", "left"];
    const seen = new Set();
    let best = null;
    let bestScore = Infinity;
    for (const p of order) {
      if (seen.has(p)) continue;
      seen.add(p);
      const o = tryOne(p);
      const hbCx = (o.hb.left + o.hb.right) / 2;
      const hbCy = (o.hb.top + o.hb.bottom) / 2;
      const tCx = o.left + o.tw / 2;
      const tCy = o.top + o.th / 2;
      const dist = Math.hypot(tCx - hbCx, tCy - hbCy);
      let score = overlapPenalty(o.hb, o.tr) + dist * 0.01;
      if (stackBelow && p === "top") score += 2e5;
      if (stackBelow && (p === "left" || p === "right")) score += 800;
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best) {
      tt.style.left = `${Math.round(best.left)}px`;
      tt.style.top = `${Math.round(best.top)}px`;
      /* ナビ＋スマホ: 三本線と吹き出しが重ならないよう右へ逃がす */
      if (step?.id === "home-nav" && isMobileNavViewport()) {
        const trR = tt.getBoundingClientRect();
        const minL = pads.left + 52;
        if (trR.left < minL) {
          const cur = parseFloat(tt.style.left) || 0;
          const shift = minL - trR.left;
          tt.style.left = `${Math.round(Math.min(cur + shift, vw - (tt.offsetWidth || trR.width) - pads.right))}px`;
        }
        /* 画面下寄りに置く（ハイライトは上部のまま） */
        const thM = tt.offsetHeight || 280;
        const desiredTop = vh - pads.bottom - thM - 20;
        const topClamp = Math.max(pads.top + 56, Math.min(desiredTop, vh - pads.bottom - thM - 10));
        tt.style.top = `${Math.round(topClamp)}px`;
      }
    }
  }

  /** ハイライト収め込み → 吹き出し配置 → まだ重なるときは自動スクロールで微調整 */
  function layoutTutorialFrame(el, step) {
    if (!el) return;
    if (step.scrollIntoBlock === "start" && !usesHighlightUnionScrollFix(step)) {
      el.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
    }
    scrollUntilHighlightFitsInViewport(el, step);
    if (step.tutorialStackCardBelow) {
      nudgeScrollForStackCardBelow(el, step);
    }
    if (step.scrollHighlightY === "center") {
      const pads = getViewportPads();
      const r = el.getBoundingClientRect();
      const boxCenterY = (r.top + r.bottom) / 2;
      const vCenter = pads.top + (getTutorialViewportHeight() - pads.top - pads.bottom) / 2;
      const dy = boxCenterY - vCenter;
      if (Math.abs(dy) > 2) {
        window.scrollBy({ left: 0, top: dy, behavior: "instant" });
      }
    }
    for (let k = 0; k < 6; k++) {
      updateHighlightFromElement(el, step);
      const r = getHighlightTargetUnionRawRect(el, step) || el.getBoundingClientRect();
      positionTooltipAvoidOverlap(r, step.position, step);
      const hb = highlightBoxFromTargetRect(r, HIGHLIGHT_MARGIN);
      const tr = tooltipEl.getBoundingClientRect();
      if (!rectsTooClose(hb, tr, TOOLTIP_GAP)) break;
      let dy = 0;
      let dx = 0;
      if (tr.bottom > hb.bottom && tr.top < hb.bottom + TOOLTIP_GAP) dy = 40;
      else if (tr.top < hb.top && tr.bottom > hb.top - TOOLTIP_GAP) {
        /* カードを下に置くステップでは、上へ逃がすスクロール（dy<0）で吹き出しが上に回りやすいので下方向へ */
        dy = step.tutorialStackCardBelow ? 48 : -40;
      } else if (tr.right > hb.right && tr.left < hb.right + TOOLTIP_GAP) dx = 40;
      else if (tr.left < hb.left && tr.right > hb.left - TOOLTIP_GAP) dx = -40;
      else dy = tr.top > hb.bottom ? 40 : step.tutorialStackCardBelow ? 44 : -40;
      if (dx !== 0 && !canWindowScrollHorizontally()) dx = 0;
      if (dx === 0 && dy === 0) dy = step.tutorialStackCardBelow ? 40 : 36;
      window.scrollBy({ left: dx, top: dy, behavior: "instant" });
    }
    updateHighlightFromElement(el, step);
    positionTooltipAvoidOverlap(getHighlightTargetUnionRawRect(el, step) || el.getBoundingClientRect(), step.position, step);

    /** 吹き出し微調整の scrollBy のあと、和集合上端が再びはみ出したときに戻す */
    const pads2 = getViewportPads();
    for (let c = 0; c < 10; c++) {
      const u = getScrollFitUnion(el, step);
      if (!u) break;
      if (u.top >= pads2.top - 0.5) break;
      window.scrollBy({ left: 0, top: u.top - pads2.top, behavior: "instant" });
    }
    if (usesHighlightUnionScrollFix(step)) {
      const vh2 = getTutorialViewportHeight();
      for (let c = 0; c < 10; c++) {
        const u = getScrollFitUnion(el, step);
        if (!u) break;
        if (u.bottom <= vh2 - pads2.bottom + 1) break;
        window.scrollBy({ left: 0, top: u.bottom - (vh2 - pads2.bottom), behavior: "instant" });
      }
    }
    if (step.tutorialStackCardBelow) {
      nudgeScrollForStackCardBelow(el, step);
    }
    updateHighlightFromElement(el, step);
    positionTooltipAvoidOverlap(getHighlightTargetUnionRawRect(el, step) || el.getBoundingClientRect(), step.position, step);

    /** Safari / Chrome モバイル: スクロール確定後の次フレームで枠・吹き出しだけ再配置（layout 全体の再帰は避ける） */
    requestAnimationFrame(() => {
      if (!overlayEl || overlayEl.hasAttribute("hidden") || !tooltipEl || !highlightEl) return;
      const stepIndex = readStep();
      const stepNow = getSteps()[stepIndex];
      if (!stepNow || stepNow.id !== step.id || pageKey() !== stepNow.page) return;
      let elNow = document.querySelector(getStepTargetSelector(stepNow));
      if (!isTutorialTargetVisible(elNow) && stepNow.waitSelector) {
        const w = document.querySelector(stepNow.waitSelector);
        if (isTutorialTargetVisible(w)) elNow = w;
      }
      if (!isTutorialTargetVisible(elNow)) return;
      updateHighlightFromElement(elNow, stepNow);
      positionTooltipAvoidOverlap(
        getHighlightTargetUnionRawRect(elNow, stepNow) || elNow.getBoundingClientRect(),
        stepNow.position,
        stepNow,
      );
    });
  }

  /**
   * 「次へ」直後にスクロール・ハイライトが追いつかない端末向け。
   * 描画後にもう一度だけ現在ステップの layout を同期する。
   */
  function scheduleLayoutResyncAfterNextStep() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncTutorialLayoutFromDom();
      });
    });
  }

  /** リサイズ・全画面切替時に現在ステップだけ再レイアウト */
  function syncTutorialLayoutFromDom() {
    if (!overlayEl || overlayEl.hasAttribute("hidden") || !tooltipEl) return;
    const stepIndex = readStep();
    const step = getSteps()[stepIndex];
    if (!step || pageKey() !== step.page) return;
    let el = document.querySelector(getStepTargetSelector(step));
    if (!isTutorialTargetVisible(el) && step.waitSelector) {
      const w = document.querySelector(step.waitSelector);
      if (isTutorialTargetVisible(w)) el = w;
    }
    if (!isTutorialTargetVisible(el)) return;
    layoutTutorialFrame(el, step);
  }

  function showStep(stepIndex, opts = {}) {
    ensureDom();
    const step = getSteps()[stepIndex];
    if (!step) {
      markCompleted();
      closeAll();
      return;
    }

    if (!opts.noNavigate && pageKey() !== step.page) {
      clearPendingRefresh();
      navigateForStep(stepIndex);
      return;
    }

    clearPendingRefresh();

    if (!opts.skipBeforeShow) {
      step.beforeShow?.();
    }

    let el = document.querySelector(getStepTargetSelector(step));
    let primaryVisible = isTutorialTargetVisible(el);

    if (!opts.skipBeforeShow && step.refreshDelayMs && step.waitSelector && !primaryVisible) {
      if (!opts.fromViewerRefresh) {
        pendingRefreshStepIndex = stepIndex;
        pendingRefreshTimer = window.setTimeout(() => {
          pendingRefreshTimer = null;
          const current = readStep();
          if (current !== pendingRefreshStepIndex) return;
          showStep(stepIndex, { noNavigate: true, skipBeforeShow: true, fromViewerRefresh: true });
        }, step.refreshDelayMs);
      }
      const waitEl = document.querySelector(step.waitSelector);
      el = isTutorialTargetVisible(waitEl) ? waitEl : el;
      primaryVisible = isTutorialTargetVisible(el);
    } else if (opts.fromViewerRefresh) {
      el = document.querySelector(getStepTargetSelector(step));
      if (!isTutorialTargetVisible(el)) {
        const waitEl = document.querySelector(step.waitSelector || "");
        el = isTutorialTargetVisible(waitEl) ? waitEl : el;
      }
      primaryVisible = isTutorialTargetVisible(el);
    }

    tooltipEl.querySelector(".tutorial-tooltip-title").textContent = step.title;
    let bodyText = step.contentMobile && isMobileNavViewport() ? step.contentMobile : step.content;
    if (!el && step.page === "index" && stepIndex === 3) {
      bodyText +=
        "\n\n※ 大会一覧の読み込みが終わるまで少し待ってから「次へ」をお試しください。表示されない場合は、閲覧モードでログインしたうえで、はてな（?）から該当ステップを再開してください。";
    }
    if (!el && step.page === "index" && stepIndex >= 4 && stepIndex <= 8) {
      bodyText +=
        "\n\n※ 自動で切り替わるまで少し待ってから「次へ」をお試しください。表示されない場合は、一度チュートリアルを終了し、ホームで閲覧モードと大会を選んだあと、はてな（?）から該当のステップを再開してください。";
    }
    if (!el && step.page === "goals" && stepIndex === 14) {
      bodyText +=
        "\n\n※ 閲覧モードボタンが表示されるまで少し待ってから「次へ」をお試しください。表示されない場合は、目標ページを開き直してから、はてな（?）から再開してください。";
    }
    if (!el && step.page === "goals" && stepIndex === 15) {
      bodyText +=
        "\n\n※ 自動で切り替わるまで少し待ってから「次へ」をお試しください。表示されない場合は、一度チュートリアルを終了し、目標ページで閲覧モードを選んだあと、はてな（?）から再開してください。";
    }
    if (!el && step.page === "goals" && stepIndex >= 16) {
      bodyText +=
        "\n\n※ 「次へ」で進めます。改善しないときは、チュートリアル終了後に目標ページを開き直してから、はてな（?）から再開してください。";
    }
    if (!el && step.page === "analytics") {
      bodyText += "\n\n※ 分析ページ（analytics.html）を表示しているかご確認ください。別ページのときは、一度チュートリアルを終了してからナビで移動してください。";
    }
    tooltipEl.querySelector(".tutorial-tooltip-body").textContent = bodyText;

    tooltipEl.querySelector(".tutorial-progress").textContent = `ステップ ${stepIndex + 1} / ${getSteps().length}`;

    const nextBtn = tooltipEl.querySelector(".tutorial-next-btn");
    nextBtn.textContent = stepIndex >= getSteps().length - 1 ? "完了" : "次へ →";

    lockTutorialViewport();
    overlayEl.removeAttribute("hidden");
    setTutorialMobileUiClass();

    if (!el) {
      highlightEl.classList.add("tutorial-highlight--placeholder");
      const cx = getTutorialViewportWidth() / 2 - 80;
      const cy = getTutorialViewportHeight() / 2 - 50;
      highlightEl.style.top = `${cy}px`;
      highlightEl.style.left = `${cx}px`;
      highlightEl.style.width = "160px";
      highlightEl.style.height = "100px";
      const ph = highlightEl.getBoundingClientRect();
      const iw = ph.width - 2 * HIGHLIGHT_MARGIN;
      const ih = ph.height - 2 * HIGHLIGHT_MARGIN;
      const syntheticElRect = {
        left: ph.left + HIGHLIGHT_MARGIN,
        top: ph.top + HIGHLIGHT_MARGIN,
        right: ph.left + HIGHLIGHT_MARGIN + iw,
        bottom: ph.top + HIGHLIGHT_MARGIN + ih,
      };
      positionTooltipAvoidOverlap(syntheticElRect, "bottom", undefined);
    } else {
      if (step.scrollHighlightY === "center") {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      } else {
        const block = step.scrollIntoBlock === "start" ? "start" : "center";
        el.scrollIntoView({ block, inline: "nearest", behavior: "instant" });
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          layoutTutorialFrame(el, step);
          if (step.deferredLayoutResyncMs != null) {
            window.setTimeout(() => {
              syncTutorialLayoutFromDom();
            }, step.deferredLayoutResyncMs);
          }
        });
      });
    }

    writeStep(stepIndex);
    attachListeners();
  }

  function goRelative(delta) {
    const i = readStep();
    const stepsNow = getSteps();
    const leaving = stepsNow[i];
    if (delta > 0 && i >= stepsNow.length - 1) {
      markCompleted();
      closeAll();
      return;
    }
    const next = Math.min(stepsNow.length - 1, Math.max(0, i + delta));
    if (next === i) return;
    if (delta > 0 && leaving?.id === "home-nav" && typeof window.__siteNavSetDrawerOpen === "function") {
      window.__siteNavSetDrawerOpen(false);
    }
    writeStep(next);
    showStep(next);
    if (delta > 0) {
      scheduleLayoutResyncAfterNextStep();
    }
  }

  function startAtStep(index) {
    setSessionActive(true);
    writeStep(index);
    showStep(index);
  }

  function resumeIfNeeded() {
    if (!isSessionActive()) return;
    const i = readStep();
    if (i >= 0 && i < getSteps().length) {
      const step = getSteps()[i];
      if (pageKey() === step.page) {
        setTimeout(() => showStep(i), 400);
      }
    }
  }

  function maybeAutoStart() {
    if (isCompleted()) return;
    if (isSessionActive()) return;
    if (pageKey() !== "index") return;
    void (async () => {
      let offerFirstVisit = true;
      if (typeof firebase !== "undefined" && firebase.apps?.length && firebase.database) {
        try {
          const snap = await firebase.database().ref("siteSettings/tutorialOfferFirstVisit").once("value");
          offerFirstVisit = snap.val() !== false;
        } catch (err) {
          console.warn("[tutorial] 初回表示設定の取得に失敗（既定で表示します）", err);
        }
      }
      if (!offerFirstVisit) return;
      window.setTimeout(() => {
        if (isCompleted()) return;
        if (isSessionActive()) return;
        if (pageKey() !== "index") return;
        if (!document.getElementById("siteNavBar")) return;
        setSessionActive(true);
        writeStep(0);
        showStep(0);
      }, 520);
    })();
  }

  function onKeydown(e) {
    if (overlayEl && !overlayEl.hasAttribute("hidden")) {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTutorial();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goRelative(1);
        return;
      }
    }
  }

  function init() {
    ensureDom();
    document.addEventListener("keydown", onKeydown);
    resumeIfNeeded();
    maybeAutoStart();
  }

  window.SakuraTutorial = {
    init,
    openMenu,
    closeAll,
    /** site-nav の Escape 連携用 */
    close: closeAll,
    skipTutorial,
    startAtStep,
    readStep,
    isSessionActive,
    notifyManualTutorialDisabled,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
