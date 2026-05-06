/**
 * ゴミ箱サイドパネル UI（trash-core.js 必須）
 */
(function (global) {
  const TC = global.TrashCore;
  if (!TC) {
    console.warn("trash-ui.js: TrashCore が未読み込みです");
  }

  let dbRef = null;
  let onRestoredCb = null;
  let rootEl = null;

  function ensureMount() {
    if (document.getElementById("trashPanelRoot")) {
      rootEl = document.getElementById("trashPanelRoot");
      return;
    }
    const wrap = document.createElement("div");
    wrap.id = "trashPanelRoot";
    wrap.innerHTML = `
      <div id="trashPanelOverlay" class="trash-panel-overlay" aria-hidden="true">
        <div id="trashPanelBackdrop" class="trash-panel-backdrop"></div>
        <aside id="trashPanel" class="trash-panel" role="dialog" aria-labelledby="trashPanelTitle">
          <div class="trash-panel-header">
            <div>
              <h2 id="trashPanelTitle" class="trash-panel-title">ゴミ箱</h2>
              <p id="trashPanelCount" class="trash-panel-count">削除済みアイテム: 0件</p>
            </div>
            <button type="button" id="trashPanelCloseBtn" class="trash-panel-close">閉じる</button>
          </div>
          <div id="trashPanelBody" class="trash-panel-body"></div>
          <div class="trash-panel-footer">
            <button type="button" id="trashEmptyAllBtn" class="trash-empty-all">ゴミ箱を空にする</button>
          </div>
        </aside>
      </div>
      <div id="trashDialogOverlay" class="trash-dialog-overlay" aria-hidden="true">
        <div id="trashDialog" class="trash-dialog" role="alertdialog">
          <h3 id="trashDialogTitle"></h3>
          <div id="trashDialogBody" class="trash-dialog-body"></div>
          <div class="trash-dialog-actions">
            <button type="button" id="trashDialogCancel" class="trash-dialog-cancel">キャンセル</button>
            <button type="button" id="trashDialogOk" class="trash-dialog-ok">確定</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    rootEl = wrap;

    document.getElementById("trashPanelBackdrop").addEventListener("click", closePanel);
    document.getElementById("trashPanelCloseBtn").addEventListener("click", closePanel);
    document.getElementById("trashEmptyAllBtn").addEventListener("click", () => {
      void askEmptyTrash();
    });
  }

  function openDialog({ title, bodyHtml, okLabel, okDanger, onConfirm }) {
    ensureMount();
    const ov = document.getElementById("trashDialogOverlay");
    const t = document.getElementById("trashDialogTitle");
    const b = document.getElementById("trashDialogBody");
    const ok = document.getElementById("trashDialogOk");
    const cancel = document.getElementById("trashDialogCancel");
    t.textContent = title;
    b.innerHTML = bodyHtml;
    ok.textContent = okLabel || "確定";
    ok.classList.toggle("danger", Boolean(okDanger));

    const cleanup = () => {
      ok.onclick = null;
      cancel.onclick = null;
      ov.classList.remove("is-open");
      ov.setAttribute("aria-hidden", "true");
    };

    cancel.onclick = () => cleanup();
    ok.onclick = async () => {
      try {
        await onConfirm();
      } finally {
        cleanup();
      }
    };

    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
  }

  function showError(message) {
    ensureMount();
    const ov = document.getElementById("trashDialogOverlay");
    const t = document.getElementById("trashDialogTitle");
    const b = document.getElementById("trashDialogBody");
    const ok = document.getElementById("trashDialogOk");
    const cancel = document.getElementById("trashDialogCancel");
    t.textContent = "エラー";
    b.innerHTML = `<p class="trash-dialog-warn">${escapeHtml(message)}</p>`;
    ok.textContent = "閉じる";
    ok.classList.remove("danger");
    cancel.style.display = "none";
    ok.onclick = () => {
      ov.classList.remove("is-open");
      cancel.style.display = "";
      ok.onclick = null;
    };
    ov.classList.add("is-open");
  }

  function showInfo(title, bodyHtml) {
    ensureMount();
    const ov = document.getElementById("trashDialogOverlay");
    const t = document.getElementById("trashDialogTitle");
    const b = document.getElementById("trashDialogBody");
    const ok = document.getElementById("trashDialogOk");
    const cancel = document.getElementById("trashDialogCancel");
    t.textContent = title;
    b.innerHTML = bodyHtml;
    ok.textContent = "OK";
    ok.classList.remove("danger");
    cancel.style.display = "none";
    ok.onclick = () => {
      ov.classList.remove("is-open");
      cancel.style.display = "";
      ok.onclick = null;
    };
    ov.classList.add("is-open");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function renderPanelBody() {
    const TCx = global.TrashCore;
    if (!TCx || !dbRef) return;
    const body = document.getElementById("trashPanelBody");
    const countEl = document.getElementById("trashPanelCount");
    let items;
    try {
      items = await TCx.listTrashItems(dbRef);
    } catch (e) {
      body.innerHTML = `<p class="trash-empty">読み込みに失敗しました。<br/>${escapeHtml(e?.message || String(e))}</p>`;
      countEl.textContent = "削除済みアイテム: —";
      return;
    }

    countEl.textContent = `削除済みアイテム: ${items.length}件`;

    if (!items.length) {
      body.innerHTML = '<p class="trash-empty">ゴミ箱は空です。</p>';
      return;
    }

    const byType = {
      competition: [],
      match: [],
      student: [],
      goal: [],
      other: [],
    };
    for (const it of items) {
      if (byType[it.itemType]) {
        byType[it.itemType].push(it);
      } else {
        byType.other.push(it);
      }
    }

    const sections = [];
    const order = [
      ["competition", "削除済み大会"],
      ["match", "削除済み試合"],
      ["student", "削除済み選手"],
      ["goal", "削除済み目標"],
      ["other", "その他"],
    ];

    for (const [key, label] of order) {
      const list = byType[key];
      if (!list.length) continue;
      let block = `<div class="trash-section"><h4 class="trash-section-title">${escapeHtml(label)}</h4>`;
      list.forEach((it, idx) => {
        const del = TCx.formatDeletedAt(it.deletedAt);
        const exp = TCx.formatExpiresIn(it.expiresAt);
        const name = escapeHtml(it.itemName || it.itemId);
        block += `
          <div class="trash-item" data-trash-id="${escapeHtml(it.id)}">
            <div class="trash-item-name">${idx + 1}. ${name}</div>
            <div class="trash-item-meta">削除日: ${escapeHtml(del)}<br/>完全削除予定: ${escapeHtml(TCx.formatDeletedAt(it.expiresAt))}（${escapeHtml(exp)}）</div>
            <div class="trash-item-actions">
              <button type="button" class="trash-btn-restore" data-action="restore" data-id="${escapeHtml(it.id)}">復元</button>
              <button type="button" class="trash-btn-purge" data-action="purge" data-id="${escapeHtml(it.id)}">完全削除</button>
            </div>
          </div>`;
      });
      block += "</div>";
      sections.push(block);
    }

    body.innerHTML = sections.join("") || '<p class="trash-empty">表示できるアイテムがありません。</p>';

    body.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (action === "restore") void confirmRestore(id);
        if (action === "purge") void confirmPurge(id);
      });
    });
  }

  async function confirmRestore(trashId) {
    if (!TC || !dbRef) return;
    const item = await TC.getTrashItem(dbRef, trashId);
    if (!item) {
      showError("削除済みアイテムが見つかりません。既に完全削除されている可能性があります。");
      await renderPanelBody();
      return;
    }
    const typeLabel = TC.itemTypeLabel(item.itemType);
    const del = TC.formatDeletedAt(item.deletedAt);
    openDialog({
      title: `${escapeHtml(item.itemName || item.itemId)} を復元しますか？`,
      bodyHtml: `
        <p><strong>種別:</strong> ${escapeHtml(typeLabel)}</p>
        <p><strong>削除日:</strong> ${escapeHtml(del)}</p>
        <p>このアイテムを復元すると、関連するデータがデータベースに戻ります。</p>
      `,
      okLabel: "復元",
      okDanger: false,
      onConfirm: async () => {
        try {
          await TC.restoreTrashItem(dbRef, trashId);
          await renderPanelBody();
          if (typeof onRestoredCb === "function") {
            await onRestoredCb();
          }
          showInfo(
            "復元完了",
            `<p>「${escapeHtml(item.itemName || item.itemId)}」がデータベースに戻りました。画面のデータを更新しました。</p>`,
          );
        } catch (e) {
          showError(`復元に失敗しました: ${e?.message || String(e)}`);
        }
      },
    });
  }

  async function confirmPurge(trashId) {
    if (!TC || !dbRef) return;
    const item = await TC.getTrashItem(dbRef, trashId);
    if (!item) {
      showError("削除済みアイテムが見つかりません。既に完全削除されている可能性があります。");
      await renderPanelBody();
      return;
    }
    openDialog({
      title: `${escapeHtml(item.itemName || item.itemId)} を完全に削除しますか？`,
      bodyHtml: `
        <p class="trash-dialog-warn">⚠️ この操作は取り消せません。ゴミ箱から完全に削除されます。</p>
        <p>種別: ${escapeHtml(TC.itemTypeLabel(item.itemType))}</p>
      `,
      okLabel: "完全削除",
      okDanger: true,
      onConfirm: async () => {
        try {
          await TC.permanentDeleteTrashItem(dbRef, trashId);
          await renderPanelBody();
        } catch (e) {
          showError(`削除に失敗しました: ${e?.message || String(e)}`);
        }
      },
    });
  }

  async function askEmptyTrash() {
    if (!TC || !dbRef) return;
    const items = await TC.listTrashItems(dbRef);
    if (!items.length) {
      showInfo("ゴミ箱は空です", "<p>削除済みアイテムはありません。</p>");
      return;
    }
    openDialog({
      title: "ゴミ箱を空にしますか？",
      bodyHtml: `
        <p class="trash-dialog-warn">⚠️ ゴミ箱内のすべてのアイテム（${items.length}件）が完全に削除されます。この操作は取り消せません。</p>
      `,
      okLabel: "空にする",
      okDanger: true,
      onConfirm: async () => {
        try {
          await TC.emptyTrash(dbRef);
          await renderPanelBody();
        } catch (e) {
          showError(`処理に失敗しました: ${e?.message || String(e)}`);
        }
      },
    });
  }

  function openPanel() {
    ensureMount();
    const ov = document.getElementById("trashPanelOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    void renderPanelBody();
  }

  function closePanel() {
    const ov = document.getElementById("trashPanelOverlay");
    if (ov) {
      ov.classList.remove("is-open");
      ov.setAttribute("aria-hidden", "true");
    }
  }

  function bindToggleButton(btn) {
    if (!btn || btn.dataset.trashBound === "1") return;
    btn.dataset.trashBound = "1";
    btn.addEventListener("click", () => openPanel());
  }

  function init(options) {
    dbRef = options.db;
    onRestoredCb = options.onRestored || null;
    ensureMount();
    const btn = options.toggleButton || document.getElementById("openTrashPanelButton");
    bindToggleButton(btn);
  }

  global.TrashUI = {
    init,
    openPanel,
    closePanel,
    refresh: renderPanelBody,
  };
})(typeof window !== "undefined" ? window : globalThis);
