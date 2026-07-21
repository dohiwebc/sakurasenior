/**
 * オフライン状態・同期進捗の表示
 * 依存: SakuraOfflineSync
 */
(function (global) {
  let rootEl = null;
  let bannerEl = null;
  let overlayEl = null;
  let progressLabelEl = null;
  let progressBarEl = null;
  let dbRef = null;
  let firebaseRef = null;
  let onAfterSync = null;

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString("ja-JP");
    } catch {
      return "—";
    }
  }

  function ensureDom() {
    if (rootEl) return;
    rootEl = document.createElement("div");
    rootEl.id = "sakuraOfflineRoot";
    rootEl.setAttribute("aria-live", "polite");
    const first = document.body?.firstChild;
    if (first) document.body.insertBefore(rootEl, first);
    else document.body.appendChild(rootEl);

    bannerEl = document.createElement("div");
    bannerEl.className = "sakura-offline-banner";
    bannerEl.setAttribute("role", "status");
    bannerEl.innerHTML = `
      <div class="sakura-offline-banner__title"></div>
      <div class="sakura-offline-banner__body"></div>
      <div class="sakura-offline-banner__meta"></div>
      <div class="sakura-offline-banner__actions"></div>
    `;
    rootEl.appendChild(bannerEl);

    overlayEl = document.createElement("div");
    overlayEl.className = "sakura-offline-sync-overlay";
    overlayEl.innerHTML = `
      <div class="sakura-offline-sync-card">
        <h3 class="sakura-offline-sync-title">同期中</h3>
        <p class="sakura-offline-sync-detail"></p>
        <div class="sakura-offline-progress-bar"><span></span></div>
      </div>
    `;
    rootEl.appendChild(overlayEl);
    progressLabelEl = overlayEl.querySelector(".sakura-offline-sync-detail");
    progressBarEl = overlayEl.querySelector(".sakura-offline-progress-bar span");
  }

  function setBannerMode(mode) {
    bannerEl.classList.remove("is-online", "is-syncing", "is-error");
    if (mode) bannerEl.classList.add(mode);
  }

  function renderBanner() {
    ensureDom();
    const S = global.SakuraOfflineSync;
    const online = S ? S.isOnline() : global.navigator.onLine;
    const pending = S ? S.getPendingCount() : 0;
    const titleEl = bannerEl.querySelector(".sakura-offline-banner__title");
    const bodyEl = bannerEl.querySelector(".sakura-offline-banner__body");
    const metaEl = bannerEl.querySelector(".sakura-offline-banner__meta");
    const actionsEl = bannerEl.querySelector(".sakura-offline-banner__actions");

    actionsEl.innerHTML = "";

    if (!online) {
      bannerEl.classList.add("is-visible");
      setBannerMode("");
      titleEl.textContent = "オフライン状態です";
      bodyEl.textContent =
        "インターネット接続がありません。データはローカルに保存され、接続が復帰したら自動同期します。リアルタイム更新は利用できません。";
      metaEl.textContent = pending > 0 ? `未同期のデータ: ${pending} 件` : "未同期のデータはありません";
      if (pending > 0) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "同期状態を表示";
        btn.addEventListener("click", () => alert(buildSyncSummaryText()));
        actionsEl.appendChild(btn);
      }
      return;
    }

    if (pending > 0) {
      bannerEl.classList.add("is-visible");
      setBannerMode("is-online");
      titleEl.textContent = "オンライン（未同期データあり）";
      bodyEl.textContent = `${pending} 件のデータがまだ同期されていません。自動同期するか、下のボタンで今すぐ同期できます。`;
      metaEl.textContent = `最終同期: ${S.getLastSyncTime() ? fmtTime(S.getLastSyncTime()) : "—"}`;
      const syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.textContent = "今すぐ同期";
      syncBtn.addEventListener("click", () => {
        if (dbRef && firebaseRef && S) {
          void S.runSync(dbRef, firebaseRef).then((r) => {
            if (r.ok && typeof onAfterSync === "function") onAfterSync();
          });
        }
      });
      actionsEl.appendChild(syncBtn);
      const histBtn = document.createElement("button");
      histBtn.type = "button";
      histBtn.textContent = "同期履歴";
      histBtn.addEventListener("click", () => alert(buildHistoryText()));
      actionsEl.appendChild(histBtn);
      return;
    }

    bannerEl.classList.remove("is-visible");
  }

  function buildSyncSummaryText() {
    const S = global.SakuraOfflineSync;
    const n = S ? S.getPendingCount() : 0;
    return `未同期キュー: ${n} 件`;
  }

  function buildHistoryText() {
    const S = global.SakuraOfflineSync;
    if (!S) return "履歴がありません";
    const h = S.loadHistory();
    if (!h.length) return "同期履歴はまだありません。";
    return h
      .slice(0, 12)
      .map((x) => {
        const t = fmtTime(x.ts);
        if (x.ok) {
          const s = x.summary || {};
          return `${t} 完了 — 試合系 ${s.matches ?? 0} / 目標 ${s.goals ?? 0} / 削除 ${s.deletes ?? 0}`;
        }
        return `${t} 失敗 — ${x.message || "エラー"}`;
      })
      .join("\n");
  }

  function showOverlay(show) {
    ensureDom();
    overlayEl.classList.toggle("is-visible", Boolean(show));
  }

  function init(options) {
    dbRef = options.db;
    firebaseRef = options.firebase;
    onAfterSync = options.onAfterSync;

    ensureDom();
    renderBanner();

    global.addEventListener("online", () => {
      renderBanner();
      if (dbRef && firebaseRef && global.SakuraOfflineSync) {
        void global.SakuraOfflineSync.runSync(dbRef, firebaseRef).then((r) => {
          if (r.ok && typeof onAfterSync === "function") onAfterSync();
          renderBanner();
        });
      }
    });
    global.addEventListener("offline", () => renderBanner());

    global.addEventListener("sakura-offline-queue-changed", () => renderBanner());

    global.addEventListener("sakura-sync-start", (e) => {
      const total = e.detail?.total ?? 0;
      if (total <= 0) return;
      showOverlay(true);
      overlayEl.querySelector(".sakura-offline-sync-title").textContent = "同期中…";
      progressLabelEl.textContent = `0 / ${total}`;
      progressBarEl.style.width = "0%";
      bannerEl.classList.add("is-visible");
      setBannerMode("is-syncing");
      bannerEl.querySelector(".sakura-offline-banner__title").textContent = "同期中…";
      bannerEl.querySelector(".sakura-offline-banner__body").textContent =
        "Firebase にデータを送信しています。完了までお待ちください。";
    });

    global.addEventListener("sakura-sync-progress", (e) => {
      const { current, total } = e.detail || {};
      if (!total) return;
      const pct = Math.round((current / total) * 100);
      progressLabelEl.textContent = `同期進度: ${current} / ${total}（${labelForOp(e.detail?.op)}）`;
      progressBarEl.style.width = `${pct}%`;
    });

    global.addEventListener("sakura-sync-done", (e) => {
      showOverlay(false);
      const count = e.detail?.count ?? 0;
      if (count > 0) {
        bannerEl.classList.add("is-visible");
        setBannerMode("is-online");
        const s = e.detail?.summary || {};
        bannerEl.querySelector(".sakura-offline-banner__title").textContent = "同期が完了しました";
        bannerEl.querySelector(".sakura-offline-banner__body").textContent =
          `試合・記録: ${s.matches ?? 0} 件、目標: ${s.goals ?? 0} 件、削除: ${s.deletes ?? 0} 件を処理しました。`;
        bannerEl.querySelector(".sakura-offline-banner__meta").textContent = "";
        global.setTimeout(() => renderBanner(), 4500);
      } else {
        renderBanner();
      }
    });

    global.addEventListener("sakura-sync-error", (e) => {
      showOverlay(false);
      bannerEl.classList.add("is-visible");
      setBannerMode("is-error");
      bannerEl.querySelector(".sakura-offline-banner__title").textContent = "同期エラー";
      bannerEl.querySelector(".sakura-offline-banner__body").textContent =
        "一部のデータを同期できませんでした。接続を確認してください。自動で再試行します。";
      const err = e.detail?.error || "";
      bannerEl.querySelector(".sakura-offline-banner__meta").textContent = err ? `詳細: ${err}` : "";
      const actionsEl = bannerEl.querySelector(".sakura-offline-banner__actions");
      actionsEl.innerHTML = "";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "今すぐリトライ";
      retry.addEventListener("click", () => {
        if (dbRef && firebaseRef && global.SakuraOfflineSync) {
          void global.SakuraOfflineSync.runSync(dbRef, firebaseRef).then((r) => {
            if (r.ok && typeof onAfterSync === "function") onAfterSync();
            renderBanner();
          });
        }
      });
      actionsEl.appendChild(retry);
    });
  }

  function labelForOp(op) {
    const map = {
      match_create: "試合作成",
      match_update: "試合更新",
      match_save: "記録保存",
      match_delete: "試合削除",
      goal_push: "目標作成",
      goal_update: "目標更新",
      goal_delete: "目標削除",
      goal_status: "目標ステータス",
    };
    return map[op] || op || "処理";
  }

  global.SakuraOfflineSyncUI = { init, renderBanner: () => renderBanner() };
})(typeof window !== "undefined" ? window : globalThis);
