/**
 * 全ページ共通：固定ナビ、モバイルドロワー、通知ベル、チュートリアル（? は Firebase 設定で非表示にできる）
 */
(function () {
  /** `siteSettings.tutorialManualEnabled` の購読は二重に付けない */
  let siteSettingsTutorialManualListenerAttached = false;
  /** Firebase アプリ生成待ちの再試行（無限ループ防止） */
  let siteSettingsTutorialManualWireAttempts = 0;
  const SITE_SETTINGS_TUTORIAL_MANUAL_WIRE_MAX = 75;

  function getSitePage() {
    return document.documentElement.getAttribute("data-site-page") || "index";
  }

  function mountNav() {
    if (document.getElementById("siteNavBar")) return;

    const page = getSitePage();
    const isActive = (key) => (page === key ? "site-nav__link--active" : "");

    /** 「ENGLISH / 日本語」形式（例: EDIT / 編集モード） */
    function navLinkHtml(key, href, ja, enCaps) {
      const ac = isActive(key);
      const aria = `${enCaps}、${ja}`;
      return `<a href="${href}" class="${ac}" data-nav-key="${key}" aria-label="${aria}"><span class="site-nav__link-row"><span class="site-nav__link-en">${enCaps}</span><span class="site-nav__link-slash" aria-hidden="true"> / </span><span class="site-nav__link-ja">${ja}</span></span></a>`;
    }

    const linkHome = navLinkHtml("index", "./index.html", "ホーム", "HOME");
    const linkAnalytics = navLinkHtml("analytics", "./analytics.html", "分析", "ANALYTICS");
    const linkGoals = navLinkHtml("goals", "./goals.html", "目標", "GOALS");
    const editLoginButton =
      page === "index"
        ? `<button type="button" class="site-nav__edit-login" id="siteNavEditLoginBtn" aria-label="編集モードログイン">
            <i class="fa-solid fa-pen-to-square site-nav__edit-login-icon" aria-hidden="true"></i>
          </button>`
        : "";

    const header = document.createElement("header");
    header.id = "siteNavBar";
    header.className = "site-nav";
    header.innerHTML = `
      <div class="site-nav__inner">
        <button type="button" class="site-nav__hamburger" id="siteNavHamburger" aria-expanded="false" aria-controls="siteNavDrawer" aria-label="メニューを開く">
          <i class="fa-solid fa-bars site-nav__hamburger-icon site-nav__hamburger-icon--bars" aria-hidden="true"></i>
          <i class="fa-solid fa-xmark site-nav__hamburger-icon site-nav__hamburger-icon--close" aria-hidden="true"></i>
        </button>
        <a class="site-nav__logo" href="./index.html">
          <span class="site-nav__logo-short">SAKURA GROUP</span>
          <span class="site-nav__logo-long">SAKURA GROUP MATCH LOG</span>
        </a>
        <nav class="site-nav__links site-nav__links--pc" aria-label="メインメニュー">
          ${linkHome}
          ${linkGoals}
          ${linkAnalytics}
        </nav>
        <div class="site-nav__actions">
          <button type="button" class="site-nav__bell" id="navBellBtn" aria-label="通知">
            <i class="fa-regular fa-bell site-nav__bell-icon" aria-hidden="true"></i>
            <span class="site-nav__bell-badge" id="navBellBadgeNum"></span>
          </button>
          ${editLoginButton}
        </div>
      </div>
    `;

    const backdrop = document.createElement("div");
    backdrop.className = "site-nav__backdrop";
    backdrop.id = "siteNavBackdrop";

    const drawer = document.createElement("nav");
    drawer.className = "site-nav__drawer";
    drawer.id = "siteNavDrawer";
    drawer.setAttribute("aria-label", "モバイルメニュー");
    drawer.innerHTML = `
      ${linkHome}
      ${linkGoals}
      ${linkAnalytics}
    `;

    document.body.insertBefore(header, document.body.firstChild);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    const noticeShell = document.createElement("div");
    noticeShell.id = "siteNavNotices";
    noticeShell.className = "site-nav__notices";
    noticeShell.hidden = true;
    /** 通知パネル閉じアニメ完了まで hidden にしないためのタイマー */
    let noticeCloseTimer = null;
    noticeShell.innerHTML = `
      <div class="site-nav__notices-backdrop" id="siteNavNoticesBackdrop"></div>
      <div class="site-nav__notices-panel" role="dialog" aria-modal="true" aria-labelledby="siteNavNoticesTitle">
        <div class="site-nav__notices-head">
          <h2 id="siteNavNoticesTitle">通知</h2>
          <div class="site-nav__notices-head-actions">
            <button type="button" class="site-nav__notices-mark-all" id="siteNavNoticesMarkMatchRead">試合データを既読</button>
            <button type="button" class="site-nav__notices-mark-all" id="siteNavNoticesMarkGoalRead">目標を既読</button>
            <button type="button" class="site-nav__notices-close" id="siteNavNoticesClose" aria-label="閉じる">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="smNtWrap">
          <div class="smNt" id="siteNavNoticesTabsStrip" role="tablist" data-active="matches" aria-label="通知の種類">
            <div class="smNt__ink" aria-hidden="true"></div>
            <button type="button" class="smNt__btn" id="siteNavTabMatches" role="tab" data-notice-tab="matches" aria-selected="true">試合データ</button>
            <button type="button" class="smNt__btn" id="siteNavTabGoals" role="tab" data-notice-tab="goals" aria-selected="false">目標</button>
          </div>
        </div>
        <p id="siteNavNoticesSummary" class="site-nav__notices-summary"></p>
        <div id="siteNavNoticesGoalSubfilters" class="site-nav__notices-subfilters hidden">
          <label class="site-nav__notices-field">選手名
            <select id="siteNavNoticePlayer"></select>
          </label>
          <label class="site-nav__notices-field">表示フィルタ
            <select id="siteNavNoticeGoalFilter">
              <option value="all">すべて</option>
              <option value="achieved">達成・達成中</option>
              <option value="not_achieved">未達のみ</option>
            </select>
          </label>
        </div>
        <div id="siteNavNoticesList" class="site-nav__notices-list"></div>
        <p class="site-nav__notices-foot">
          <a href="./index.html" id="siteNavNoticesHomeLink">HOME / ホーム</a>
          <span class="site-nav__notices-foot-sep"> · </span>
          <a href="./goals.html" id="siteNavNoticesFootLink">GOALS / 目標</a>
        </p>
      </div>
    `;
    document.body.appendChild(noticeShell);
    document.body.classList.add("has-site-nav");

    let lastNoticeRes = null;
    /** 通知リストのスライドは「タブ切替時」のみ（同一タブ内のフィルタ変更では再生しない） */
    let prevNoticeListTabForAnim = null;

    function escAttr(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
    }

    function filterGoalNoticesForPanel(rows, playerValue, statusFilter) {
      let r = rows || [];
      if (playerValue === "__team__") {
        r = r.filter((n) => n.targetScope === "team");
      } else if (playerValue) {
        r = r.filter((n) => (n.targetScope || "player") === "player" && n.userId === playerValue);
      }
      if (statusFilter === "achieved") {
        r = r.filter((n) => n.status === "achieved" || n.status === "ongoing_achieving");
      } else if (statusFilter === "not_achieved") {
        r = r.filter((n) => n.status === "ongoing" || n.status === "not_achieved");
      }
      return r;
    }

    function getActiveNoticeTab() {
      const t = noticeShell.querySelector('[data-notice-tab][aria-selected="true"]');
      return t?.getAttribute("data-notice-tab") || "matches";
    }

    function setNoticeTab(cat) {
      document.getElementById("siteNavNoticesTabsStrip")?.setAttribute("data-active", cat);
      noticeShell.querySelectorAll("[data-notice-tab]").forEach((btn) => {
        const on = btn.getAttribute("data-notice-tab") === cat;
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      const markMatchBtn = document.getElementById("siteNavNoticesMarkMatchRead");
      const markGoalBtn = document.getElementById("siteNavNoticesMarkGoalRead");
      if (markMatchBtn) markMatchBtn.hidden = cat !== "matches";
      if (markGoalBtn) markGoalBtn.hidden = cat !== "goals";
      document.getElementById("siteNavNoticesGoalSubfilters")?.classList.toggle("hidden", cat !== "goals");
      renderNoticeListBody();
    }

    function triggerNoticeListSlide(tab) {
      const list = document.getElementById("siteNavNoticesList");
      if (!list) return;
      list.removeAttribute("data-slide");
      list.classList.remove("site-nav__notices-list--anim");
      window.requestAnimationFrame(() => {
        list.setAttribute("data-slide", tab === "matches" ? "from-left" : "from-right");
        list.classList.add("site-nav__notices-list--anim");
      });
    }

    function renderNoticeListBody() {
      const list = document.getElementById("siteNavNoticesList");
      const summary = document.getElementById("siteNavNoticesSummary");
      if (!list || !summary || !lastNoticeRes) return;

      const tab = getActiveNoticeTab();
      const animateList = prevNoticeListTabForAnim !== tab;
      prevNoticeListTabForAnim = tab;

      const gUnread = lastNoticeRes.goalUnread ?? 0;
      const mUnread = lastNoticeRes.matchUnread ?? 0;

      if (tab === "matches") {
        summary.textContent = `試合データ: 未読 ${mUnread} 件 / 目標の未読 ${gUnread} 件`;
        const rows = lastNoticeRes.matchNotices || [];
        if (!rows.length) {
          list.innerHTML = '<p class="site-nav__notices-placeholder">試合データ通知はありません。</p>';
          if (animateList) triggerNoticeListSlide(tab);
          return;
        }
        list.innerHTML = rows
          .map(
            (n) => `
          <article class="site-nav__notice ${n.unread ? "site-nav__notice--unread" : ""}" tabindex="0" role="button" data-notice-match="1"
            data-tournament-id="${escAttr(n.tournamentId)}" data-match-id="${escAttr(n.matchId)}" data-match-fp="${escAttr(n.fp)}">
            <div class="site-nav__notice-title">${n.title}</div>
            <div class="site-nav__notice-body">${n.body}</div>
          </article>`,
          )
          .join("");
        bindMatchNoticeRows(list);
        if (animateList) triggerNoticeListSlide(tab);
        return;
      }

      const playerSel = document.getElementById("siteNavNoticePlayer");
      const filterSel = document.getElementById("siteNavNoticeGoalFilter");
      const playerValue = playerSel?.value || "";
      const statusFilter = filterSel?.value || "all";
      const filtered = filterGoalNoticesForPanel(lastNoticeRes.goalNotices || [], playerValue, statusFilter);
      const shownUnread = filtered.filter((x) => x.unread).length;
      summary.textContent = `目標: 表示 ${filtered.length} 件（うち未読 ${shownUnread} 件） / 試合データの未読 ${mUnread} 件`;

      if (!filtered.length) {
        list.innerHTML = '<p class="site-nav__notices-placeholder">条件に合う目標の通知はありません。</p>';
        if (animateList) triggerNoticeListSlide(tab);
        return;
      }
      list.innerHTML = filtered
        .map(
          (n) => `
        <article class="site-nav__notice ${n.unread ? "site-nav__notice--unread" : ""}" tabindex="0" role="button" data-notice-goal="${escAttr(n.goalId)}">
          <div class="site-nav__notice-title">${n.title}</div>
          <div class="site-nav__notice-body">${n.body}</div>
        </article>`,
        )
        .join("");
      bindGoalNoticeRows(list);
      if (animateList) triggerNoticeListSlide(tab);
    }

    function bindGoalNoticeRows(listEl) {
      listEl.querySelectorAll("[data-notice-goal]").forEach((row) => {
        const gid = row.getAttribute("data-notice-goal");
        const go = () => {
          if (!gid) return;
          try {
            const map = JSON.parse(localStorage.getItem("goal-read-map") || "{}");
            map[gid] = true;
            localStorage.setItem("goal-read-map", JSON.stringify(map));
          } catch {}
          closeNoticesPanel();
          void window.__siteNavRefreshBell?.();
          const page = document.documentElement.getAttribute("data-site-page") || "";
          if (page === "goals" && typeof window.focusGoalFromNotice === "function") {
            window.focusGoalFromNotice(gid);
            return;
          }
          if (typeof window.__openGoalNoticeOverlay === "function") {
            void window.__openGoalNoticeOverlay(gid, { returnToNotices: true });
            return;
          }
          window.location.href = `./goals.html?focusGoal=${encodeURIComponent(gid)}`;
        };
        row.addEventListener("click", go);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            go();
          }
        });
      });
    }

    function bindMatchNoticeRows(listEl) {
      listEl.querySelectorAll("[data-notice-match]").forEach((row) => {
        const tid = row.getAttribute("data-tournament-id");
        const mid = row.getAttribute("data-match-id");
        const fp = row.getAttribute("data-match-fp") || "";
        const go = () => {
          if (!tid || !mid) return;
          if (typeof window.SakuraGoalBadge?.markMatchFingerprintSeen === "function") {
            window.SakuraGoalBadge.markMatchFingerprintSeen(tid, mid, fp);
          }
          closeNoticesPanel();
          void window.__siteNavRefreshBell?.();
          if (typeof window.__openMatchNoticeOverlay === "function") {
            void window.__openMatchNoticeOverlay(tid, mid, fp, { returnToNotices: true });
            return;
          }
          const page = document.documentElement.getAttribute("data-site-page") || "";
          if (page === "index" && typeof window.focusMatchFromNotice === "function") {
            void window.focusMatchFromNotice(tid, mid, { openDetail: true });
            return;
          }
          window.location.href = `./index.html?tournament=${encodeURIComponent(tid)}&match=${encodeURIComponent(mid)}&openMatchDetail=1`;
        };
        row.addEventListener("click", go);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            go();
          }
        });
      });
    }

    function fillGoalNoticeFilters(res) {
      const sel = document.getElementById("siteNavNoticePlayer");
      if (!sel) return;
      sel.innerHTML = "";
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = "全員";
      sel.append(o0);
      const o1 = document.createElement("option");
      o1.value = "__team__";
      o1.textContent = "チーム全体の目標";
      sel.append(o1);
      (res.players || []).forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name || "";
        sel.append(o);
      });
    }

    function markAllGoalNoticesAsRead() {
      if (!lastNoticeRes) return;
      try {
        const goalReadMap = JSON.parse(localStorage.getItem("goal-read-map") || "{}");
        (lastNoticeRes.goalNotices || []).forEach((n) => {
          if (n?.goalId) goalReadMap[n.goalId] = true;
          n.unread = false;
        });
        localStorage.setItem("goal-read-map", JSON.stringify(goalReadMap));
      } catch {}
      lastNoticeRes.goalUnread = 0;
      lastNoticeRes.unread = (lastNoticeRes.matchUnread ?? 0) + (lastNoticeRes.goalUnread ?? 0);
      renderNoticeListBody();
      void window.__siteNavRefreshBell?.();
    }

    function markAllMatchNoticesAsRead() {
      if (!lastNoticeRes) return;
      if (typeof window.SakuraGoalBadge?.markAllMatchFingerprintsSeen === "function") {
        window.SakuraGoalBadge.markAllMatchFingerprintsSeen(lastNoticeRes.matchNotices || []);
      } else if (typeof window.SakuraGoalBadge?.markMatchFingerprintSeen === "function") {
        (lastNoticeRes.matchNotices || []).forEach((n) => {
          if (n?.tournamentId && n?.matchId) {
            window.SakuraGoalBadge.markMatchFingerprintSeen(n.tournamentId, n.matchId, n.fp || "");
          }
        });
      }
      (lastNoticeRes.matchNotices || []).forEach((n) => {
        n.unread = false;
      });
      lastNoticeRes.matchUnread = 0;
      lastNoticeRes.unread = (lastNoticeRes.matchUnread ?? 0) + (lastNoticeRes.goalUnread ?? 0);
      renderNoticeListBody();
      void window.__siteNavRefreshBell?.();
    }

    const hamburger = document.getElementById("siteNavHamburger");
    const setDrawerOpen = (open) => {
      drawer.classList.toggle("is-open", open);
      backdrop.classList.toggle("is-open", open);
      hamburger?.classList.toggle("is-open", open);
      hamburger?.setAttribute("aria-expanded", open ? "true" : "false");
      hamburger?.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    };

    hamburger?.addEventListener("click", () => {
      const next = !drawer.classList.contains("is-open");
      if (next) closeNoticesPanel();
      setDrawerOpen(next);
    });

    backdrop.addEventListener("click", () => setDrawerOpen(false));

    /** リンク以外（余白・すりガラス部分）をタップしたら閉じる（backdrop の上にドロワーがあるため） */
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      setDrawerOpen(false);
    });

    drawer.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setDrawerOpen(false));
    });

    function closeNoticesPanel() {
      window.clearTimeout(noticeCloseTimer);
      noticeCloseTimer = null;
      if (noticeShell.hidden) return;
      /* 開くアニメの rAF 前に閉じられた場合は即非表示 */
      if (!noticeShell.classList.contains("site-nav__notices--open")) {
        noticeShell.hidden = true;
        return;
      }
      noticeShell.classList.remove("site-nav__notices--open");
      const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      const waitMs = reduceMotion ? 0 : 320;
      noticeCloseTimer = window.setTimeout(() => {
        noticeCloseTimer = null;
        noticeShell.hidden = true;
      }, waitMs);
    }

    async function openNoticesPanel(initialTab = "matches") {
      setDrawerOpen(false);
      window.SakuraTutorial?.closeAll?.();
      document.getElementById("tutorialMenuModal")?.setAttribute("hidden", "");
      window.clearTimeout(noticeCloseTimer);
      noticeCloseTimer = null;
      const list = document.getElementById("siteNavNoticesList");
      const summary = document.getElementById("siteNavNoticesSummary");
      if (!list || !summary) return;

      noticeShell.hidden = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          noticeShell.classList.add("site-nav__notices--open");
        });
      });
      list.innerHTML = '<p class="site-nav__notices-placeholder">読み込み中…</p>';
      summary.textContent = "";
      const fb = typeof firebase !== "undefined" ? firebase : null;
      if (!fb || !fb.apps?.length) {
        lastNoticeRes = null;
        list.innerHTML = '<p class="site-nav__notices-placeholder">接続できませんでした。</p>';
        return;
      }
      if (typeof fb.auth === "function" && !fb.auth().currentUser) {
        lastNoticeRes = null;
        list.innerHTML = '<p class="site-nav__notices-placeholder">ログイン後に通知を表示します。</p>';
        return;
      }
      if (typeof window.SakuraGoalBadge?.getNotices !== "function") {
        lastNoticeRes = null;
        list.innerHTML = '<p class="site-nav__notices-placeholder">通知を読み込めませんでした。</p>';
        return;
      }
      const db = fb.database();
      const res = await window.SakuraGoalBadge.getNotices(db);
      if (res.error && res.error !== "no-db") {
        lastNoticeRes = null;
        list.innerHTML = '<p class="site-nav__notices-placeholder">取得に失敗しました。</p>';
        return;
      }
      lastNoticeRes = res;
      fillGoalNoticeFilters(res);
      const pf = document.getElementById("siteNavNoticeGoalFilter");
      if (pf) pf.value = "all";
      const pp = document.getElementById("siteNavNoticePlayer");
      if (pp) pp.value = "";
      setNoticeTab(initialTab === "goals" ? "goals" : "matches");
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        window.SakuraTutorial?.closeAll?.();
        document.getElementById("tutorialMenuModal")?.setAttribute("hidden", "");
        closeNoticesPanel();
      }
    });

    document.getElementById("navBellBtn")?.addEventListener("click", () => {
      openNoticesPanel();
    });

    document.getElementById("siteNavNoticesBackdrop")?.addEventListener("click", closeNoticesPanel);
    document.getElementById("siteNavNoticesClose")?.addEventListener("click", closeNoticesPanel);
    document.getElementById("siteNavNoticesFootLink")?.addEventListener("click", () => {
      closeNoticesPanel();
    });
    document.getElementById("siteNavNoticesHomeLink")?.addEventListener("click", () => {
      closeNoticesPanel();
    });
    document.getElementById("siteNavNoticesMarkGoalRead")?.addEventListener("click", markAllGoalNoticesAsRead);
    document.getElementById("siteNavNoticesMarkMatchRead")?.addEventListener("click", markAllMatchNoticesAsRead);

    noticeShell.querySelectorAll("[data-notice-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setNoticeTab(btn.getAttribute("data-notice-tab") || "matches"));
    });
    document.getElementById("siteNavNoticePlayer")?.addEventListener("change", renderNoticeListBody);
    document.getElementById("siteNavNoticeGoalFilter")?.addEventListener("change", renderNoticeListBody);

    function openTutorial() {
      closeNoticesPanel();
      setDrawerOpen(false);
      if (window.__SAKURA_TUTORIAL_MANUAL_ENABLED === false) {
        if (typeof window.SakuraTutorial?.notifyManualTutorialDisabled === "function") {
          window.SakuraTutorial.notifyManualTutorialDisabled();
        } else {
          window.alert("現在チュートリアルは使用できません。");
        }
        return;
      }
      if (typeof window.SakuraTutorial?.openMenu === "function") {
        window.SakuraTutorial.openMenu();
      }
    }

    document.getElementById("siteNavHelpBtn")?.addEventListener("click", openTutorial);
    document.getElementById("siteNavEditLoginBtn")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("sakura:open-edit-login"));
    });

    /** Firebase siteSettings: 手動チュートリアル（?）の表示を全ページで同期 */
    wireSiteSettingsTutorialManualNav();

    /** チュートリアル等からドロワーを開閉（プログラム用） */
    window.__siteNavSetDrawerOpen = (open) => {
      if (open) closeNoticesPanel();
      setDrawerOpen(!!open);
    };
    window.__siteNavOpenNotices = (tab = "matches") => openNoticesPanel(tab);
  }

  function setBellCount(unread) {
    const n = document.getElementById("navBellBadgeNum");
    const btn = document.getElementById("navBellBtn");
    if (!n || !btn) return;
    const c = Math.max(0, Number(unread) || 0);
    if (c > 0) {
      n.textContent = String(c);
      btn.classList.add("site-nav__bell--unread");
      btn.setAttribute("aria-label", `通知（未読 ${c} 件）`);
    } else {
      n.textContent = "";
      btn.classList.remove("site-nav__bell--unread");
      btn.setAttribute("aria-label", "通知");
    }
  }

  async function refreshBellFromFirebase() {
    if (typeof window.SakuraGoalBadge?.refresh !== "function") return;
    const fb = typeof firebase !== "undefined" ? firebase : null;
    if (!fb || !fb.apps?.length) return;
    if (typeof fb.auth === "function" && !fb.auth().currentUser) return;
    const db = fb.database();
    const { unread, error } = await window.SakuraGoalBadge.refresh(db);
    setBellCount(unread);
    try {
      localStorage.setItem("sakura-goal-unread-cache", String(unread));
    } catch {}
    if (error && error !== "no-db") {
      console.warn("[site-nav] badge:", error);
    }
  }

  /** @param {boolean} enabled tutorialManualEnabled がオンのとき true（未設定はオン扱い） */
  function applyTutorialHelpButtonVisibility(enabled) {
    window.__SAKURA_TUTORIAL_MANUAL_ENABLED = enabled;
    const btn = document.getElementById("siteNavHelpBtn");
    if (!btn) return;
    if (enabled) {
      btn.hidden = false;
      btn.classList.remove("site-nav__help--tutorial-off");
      btn.removeAttribute("title");
      btn.setAttribute("aria-label", "チュートリアル");
    } else {
      btn.hidden = false;
      btn.classList.add("site-nav__help--tutorial-off");
      btn.setAttribute("aria-label", "チュートリアル（現在は利用できません）");
      btn.setAttribute("title", "現在チュートリアルは使用できません。");
    }
  }

  /** フォアグラウンド復帰などで RTDB と再同期（購読が付く前の端末差を吸収） */
  function refreshSiteSettingsTutorialManualFromFirebase() {
    const fb = typeof firebase !== "undefined" ? firebase : null;
    if (!fb?.apps?.length || typeof fb.database !== "function") return;
    try {
      fb
        .database()
        .ref("siteSettings")
        .once(
          "value",
          (snap) => {
            const raw = snap.val();
            const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
            applyTutorialHelpButtonVisibility(o.tutorialManualEnabled !== false);
          },
          (err) => {
            console.warn("[site-nav] siteSettings 再取得拒否", err);
            applyTutorialHelpButtonVisibility(true);
          },
        );
    } catch (err) {
      console.warn("[site-nav] siteSettings 再取得に失敗", err);
    }
  }

  /** RTDB `siteSettings` の tutorialManualEnabled（index の編集モードと共通） */
  function wireSiteSettingsTutorialManualNav() {
    if (siteSettingsTutorialManualListenerAttached) return;
    const fb = typeof firebase !== "undefined" ? firebase : null;
    if (!fb || typeof fb.database !== "function") {
      applyTutorialHelpButtonVisibility(true);
      return;
    }
    if (!fb.apps?.length) {
      siteSettingsTutorialManualWireAttempts += 1;
      if (siteSettingsTutorialManualWireAttempts > SITE_SETTINGS_TUTORIAL_MANUAL_WIRE_MAX) {
        console.warn(
          "[site-nav] Firebase アプリ未初期化のため siteSettings を購読できません（手動チュートリアルは既定オン）"
        );
        applyTutorialHelpButtonVisibility(true);
        return;
      }
      window.setTimeout(wireSiteSettingsTutorialManualNav, 80);
      return;
    }
    siteSettingsTutorialManualWireAttempts = 0;
    try {
      if (typeof fb.auth === "function" && !fb.auth().currentUser) {
        applyTutorialHelpButtonVisibility(true);
        return;
      }
      const ref = fb.database().ref("siteSettings");
      const applyFromSnap = (snap) => {
        const raw = snap.val();
        const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
        applyTutorialHelpButtonVisibility(o.tutorialManualEnabled !== false);
      };
      siteSettingsTutorialManualListenerAttached = true;
      ref.once("value", applyFromSnap, (err) => {
        console.warn("[site-nav] siteSettings 取得拒否", err);
        applyTutorialHelpButtonVisibility(true);
      });
      ref.on("value", applyFromSnap, (err) => {
        console.warn("[site-nav] siteSettings 購読拒否", err);
      });
    } catch (err) {
      siteSettingsTutorialManualListenerAttached = false;
      console.warn("[site-nav] siteSettings 購読に失敗", err);
      applyTutorialHelpButtonVisibility(true);
    }
  }

  function applyCachedBell() {
    try {
      const v = localStorage.getItem("sakura-goal-unread-cache");
      if (v != null && v !== "") setBellCount(parseInt(v, 10) || 0);
    } catch {}
  }

  function init() {
    mountNav();
    applyCachedBell();
    refreshBellFromFirebase();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void refreshBellFromFirebase();
        refreshSiteSettingsTutorialManualFromFirebase();
      }
    });
    window.addEventListener("pageshow", () => {
      void refreshBellFromFirebase();
      refreshSiteSettingsTutorialManualFromFirebase();
    });
    window.addEventListener("storage", (e) => {
      if (
        e.key === "goal-read-map" ||
        e.key === "sakura-goal-unread-cache" ||
        e.key === "sakura-match-records-fp" ||
        e.key === "sakura-match-fp-seeded"
      ) {
        void refreshBellFromFirebase();
      }
    });
    window.addEventListener("sakura-goal-unread-updated", () => {
      void refreshBellFromFirebase();
    });

    window.__siteNavSetBellCount = setBellCount;
    window.__siteNavRefreshBell = refreshBellFromFirebase;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
