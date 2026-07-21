/**
 * オフラインキュー・自動同期（Firebase Realtime Database）
 * 依存: firebase (compat), TrashCore（削除同期時）
 */
(function (global) {
  const LEGACY_QUEUE_KEY = "offlineQueue";
  const LEGACY_CACHE_KEY = "sakuraRtdbCache";
  const LEGACY_HISTORY_KEY = "sakuraSyncHistory";
  const DEVICE_KEY = "sakuraDeviceId";

  /** Firebase の projectId。設定すると localStorage のキュー・キャッシュをプロジェクト別に分離する */
  let syncProjectId = "";

  function sanitizeProjectId(id) {
    if (id == null || id === "") return "";
    const cleaned = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
    return cleaned.slice(0, 80);
  }

  function getQueueKey() {
    return syncProjectId ? `${LEGACY_QUEUE_KEY}:${syncProjectId}` : LEGACY_QUEUE_KEY;
  }

  function getCacheKey() {
    return syncProjectId ? `${LEGACY_CACHE_KEY}:${syncProjectId}` : LEGACY_CACHE_KEY;
  }

  function getHistoryKey() {
    return syncProjectId ? `${LEGACY_HISTORY_KEY}:${syncProjectId}` : LEGACY_HISTORY_KEY;
  }

  function configureSyncContext(opts) {
    syncProjectId = sanitizeProjectId(opts && opts.projectId);
  }

  const QUEUE_VERSION = 1;
  const MAX_HISTORY = 40;
  const SYNCED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  /** 自動リトライ間隔（ms）: 1回目5秒, 2回目30秒, 3回目2分, 以降10分 */
  const BACKOFF_STEPS = [5000, 30000, 120000, 600000];

  let syncInFlight = false;
  let retryTimerId = null;

  function getDeviceId() {
    try {
      let id = global.localStorage?.getItem(DEVICE_KEY);
      if (!id) {
        id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        global.localStorage?.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch {
      return `dev_${Date.now()}`;
    }
  }

  function loadQueue() {
    try {
      const raw = global.localStorage?.getItem(getQueueKey());
      if (!raw) {
        return {
          version: QUEUE_VERSION,
          lastSyncTime: 0,
          deviceId: getDeviceId(),
          tempMatchMap: {},
          tempGoalMap: {},
          pending: [],
        };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("bad queue");
      parsed.version = QUEUE_VERSION;
      parsed.deviceId = parsed.deviceId || getDeviceId();
      parsed.tempMatchMap = parsed.tempMatchMap && typeof parsed.tempMatchMap === "object" ? parsed.tempMatchMap : {};
      parsed.tempGoalMap = parsed.tempGoalMap && typeof parsed.tempGoalMap === "object" ? parsed.tempGoalMap : {};
      parsed.pending = Array.isArray(parsed.pending) ? parsed.pending : [];
      return parsed;
    } catch {
      return {
        version: QUEUE_VERSION,
        lastSyncTime: 0,
        deviceId: getDeviceId(),
        tempMatchMap: {},
        tempGoalMap: {},
        pending: [],
      };
    }
  }

  function saveQueue(queue) {
    try {
      global.localStorage?.setItem(getQueueKey(), JSON.stringify(queue));
    } catch (e) {
      console.warn("offline queue save failed", e);
    }
  }

  function loadHistory() {
    try {
      const raw = global.localStorage?.getItem(getHistoryKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(entries) {
    try {
      global.localStorage?.setItem(getHistoryKey(), JSON.stringify(entries.slice(0, MAX_HISTORY)));
    } catch (e) {
      console.warn("sync history save failed", e);
    }
  }

  function pushHistory(entry) {
    const h = loadHistory();
    h.unshift({ ts: Date.now(), ...entry });
    saveHistory(h);
  }

  function prefersReducedMotion() {
    return global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function isOnline() {
    return global.navigator?.onLine !== false;
  }

  function makeQueueId() {
    return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function makeTempId(kind) {
    return `tmp_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nextBackoffMs(attempts) {
    const i = Math.min(Math.max(attempts - 1, 0), BACKOFF_STEPS.length - 1);
    return BACKOFF_STEPS[i];
  }

  function cleanupOldSynced(queue) {
    const now = Date.now();
    queue.pending = queue.pending.filter((item) => {
      if (!item.synced) return true;
      const t = item.syncedAt || 0;
      return now - t < SYNCED_RETENTION_MS;
    });
  }

  function enqueue(op, payload, meta = {}) {
    const queue = loadQueue();
    const item = {
      id: makeQueueId(),
      op,
      ts: Date.now(),
      synced: false,
      syncAttempts: 0,
      lastError: null,
      nextRetryAt: 0,
      payload: payload || {},
      meta: meta || {},
    };
    queue.pending.push(item);
    saveQueue(queue);
    dispatch("sakura-offline-queue-changed", { pending: countPending(queue) });
    return item.id;
  }

  function countPending(queue) {
    return queue.pending.filter((x) => !x.synced).length;
  }

  function getPendingCount() {
    return countPending(loadQueue());
  }

  function dispatch(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function resolveMatchId(queue, matchId) {
    if (!matchId) return matchId;
    return queue.tempMatchMap[matchId] || matchId;
  }

  function resolveGoalId(queue, goalId) {
    if (!goalId) return goalId;
    return queue.tempGoalMap[goalId] || goalId;
  }

  function rewritePayloadIds(queue, payload) {
    const p = { ...payload };
    if (p.matchId) p.matchId = resolveMatchId(queue, p.matchId);
    if (p.goalId) p.goalId = resolveGoalId(queue, p.goalId);
    return p;
  }

  async function processMatchCreate(db, firebase, queue, item) {
    const { tournamentId, tempMatchId, matchPayload } = item.payload;
    const ref = db.ref(`matches/${tournamentId}`).push();
    const key = ref.key;
    await ref.set({
      id: key,
      opponent: matchPayload.opponent ?? "",
      stage: matchPayload.stage ?? "予選",
      opponentCategory: matchPayload.opponentCategory ?? "",
      date: matchPayload.date ?? "",
      matchType: matchPayload.matchType ?? "大会",
      startingMemberIds: Array.isArray(matchPayload.startingMemberIds) ? matchPayload.startingMemberIds : [],
      substitutions: Array.isArray(matchPayload.substitutions) ? matchPayload.substitutions : [],
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    if (tempMatchId) {
      queue.tempMatchMap[tempMatchId] = key;
    }
    saveQueue(queue);
    dispatch("sakura-offline-temp-id", { kind: "match", tempId: tempMatchId, realId: key });
  }

  async function processMatchUpdate(db, firebase, queue, item) {
    const p = rewritePayloadIds(queue, item.payload);
    const { tournamentId, matchId, opponent, stage, opponentCategory, startingMemberIds, substitutions } = p;
    const mid = resolveMatchId(queue, matchId);
    const patch = { updatedAt: firebase.database.ServerValue.TIMESTAMP };
    if (typeof opponent === "string") patch.opponent = opponent;
    if (typeof stage === "string") patch.stage = stage;
    if (typeof opponentCategory === "string") patch.opponentCategory = opponentCategory;
    if (Array.isArray(startingMemberIds)) patch.startingMemberIds = startingMemberIds;
    if (substitutions !== undefined) patch.substitutions = substitutions;
    await db.ref(`matches/${tournamentId}/${mid}`).update(patch);
  }

  async function processMatchSave(db, firebase, queue, item) {
    const p = rewritePayloadIds(queue, item.payload);
    const { tournamentId, matchId, matchPatch, records } = p;
    const mid = resolveMatchId(queue, matchId);
    const patch = { ...(matchPatch || {}) };
    delete patch.updatedAt;
    patch.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    const updates = {};
    Object.entries(patch).forEach(([key, value]) => {
      updates[`matches/${tournamentId}/${mid}/${key}`] = value;
    });
    updates[`records/${tournamentId}/${mid}`] = records || {};
    await db.ref().update(updates);
  }

  async function processMatchDelete(db, queue, item) {
    const TC = global.TrashCore;
    if (!TC) throw new Error("TrashCore がありません");
    const p = rewritePayloadIds(queue, item.payload);
    const { tournamentId, matchId, originalData } = p;
    const mid = resolveMatchId(queue, matchId);
    await TC.pushTrashItem(db, {
      itemType: TC.ITEM_TYPES.match,
      itemId: mid,
      itemName: String(p.itemName || "試合"),
      originalData: originalData || {},
    });
    await db.ref(`matches/${tournamentId}/${mid}`).remove();
    await db.ref(`records/${tournamentId}/${mid}`).remove();
  }

  async function processGoalPush(db, firebase, queue, item) {
    const { tempGoalId, goalPayload } = item.payload;
    const ref = db.ref("goals").push();
    const key = ref.key;
    const payload = { ...(goalPayload || {}) };
    payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    if (typeof payload.createdAt !== "number") {
      payload.createdAt = firebase.database.ServerValue.TIMESTAMP;
    }
    await ref.set(payload);
    if (tempGoalId) {
      queue.tempGoalMap[tempGoalId] = key;
    }
    saveQueue(queue);
    dispatch("sakura-offline-temp-id", { kind: "goal", tempId: tempGoalId, realId: key });
  }

  async function processGoalUpdate(db, firebase, queue, item) {
    const p = rewritePayloadIds(queue, item.payload);
    const { goalId, fields } = p;
    const gid = resolveGoalId(queue, goalId);
    const patch = { ...(fields || {}) };
    delete patch.updatedAt;
    patch.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    await db.ref(`goals/${gid}`).update(patch);
  }

  async function processGoalDelete(db, queue, item) {
    const TC = global.TrashCore;
    if (!TC) throw new Error("TrashCore がありません");
    const p = rewritePayloadIds(queue, item.payload);
    const { goalId, originalData, itemName } = p;
    const gid = resolveGoalId(queue, goalId);
    await TC.pushTrashItem(db, {
      itemType: TC.ITEM_TYPES.goal,
      itemId: gid,
      itemName: String(itemName || "目標"),
      originalData: originalData || {},
    });
    await db.ref(`goals/${gid}`).remove();
  }

  async function processGoalStatus(db, firebase, queue, item) {
    const p = rewritePayloadIds(queue, item.payload);
    const { goalId, status } = p;
    const gid = resolveGoalId(queue, goalId);
    await db.ref(`goals/${gid}`).update({
      status,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }

  async function processItem(db, firebase, queue, item) {
    switch (item.op) {
      case "match_create":
        return processMatchCreate(db, firebase, queue, item);
      case "match_update":
        return processMatchUpdate(db, firebase, queue, item);
      case "match_save":
        return processMatchSave(db, firebase, queue, item);
      case "match_delete":
        return processMatchDelete(db, queue, item);
      case "goal_push":
        return processGoalPush(db, firebase, queue, item);
      case "goal_update":
        return processGoalUpdate(db, firebase, queue, item);
      case "goal_delete":
        return processGoalDelete(db, queue, item);
      case "goal_status":
        return processGoalStatus(db, firebase, queue, item);
      default:
        throw new Error(`不明な操作: ${item.op}`);
    }
  }

  async function runSync(db, firebase) {
    if (!db || !firebase) return { ok: false, reason: "no-db" };
    if (!isOnline()) return { ok: false, reason: "offline" };
    if (syncInFlight) return { ok: false, reason: "busy" };

    const queue = loadQueue();
    const todo = queue.pending.filter((x) => !x.synced).sort((a, b) => a.ts - b.ts);
    if (!todo.length) {
      dispatch("sakura-sync-done", { count: 0, summary: [] });
      return { ok: true, count: 0 };
    }

    syncInFlight = true;
    const summary = { matches: 0, goals: 0, deletes: 0 };
    let done = 0;
    const total = todo.length;

    dispatch("sakura-sync-start", { total });

    for (const item of todo) {
      const label =
        item.op.startsWith("match") || item.op === "goal_push" || item.op === "goal_update"
          ? "試合・記録・目標"
          : item.op;
      dispatch("sakura-sync-progress", {
        current: done + 1,
        total,
        label: label,
        op: item.op,
      });

      try {
        await processItem(db, firebase, queue, item);
        item.synced = true;
        item.syncedAt = Date.now();
        item.lastError = null;
        if (item.op === "match_delete") summary.deletes += 1;
        else if (item.op === "goal_delete") summary.deletes += 1;
        else if (item.op.startsWith("match")) summary.matches += 1;
        else if (item.op.startsWith("goal")) summary.goals += 1;

        done += 1;
        saveQueue(queue);
      } catch (err) {
        console.error("sync item failed", item, err);
        item.syncAttempts = (item.syncAttempts || 0) + 1;
        item.lastError = err?.message || String(err);
        item.nextRetryAt = Date.now() + nextBackoffMs(item.syncAttempts);
        saveQueue(queue);
        syncInFlight = false;
        dispatch("sakura-sync-error", {
          error: item.lastError,
          item,
          summary,
          done,
          total,
        });
        pushHistory({
          ok: false,
          message: item.lastError,
          op: item.op,
        });
        scheduleAutoRetry(db, firebase);
        return { ok: false, error: err, partial: summary };
      }
    }

    queue.lastSyncTime = Date.now();
    cleanupOldSynced(queue);
    saveQueue(queue);
    syncInFlight = false;

    pushHistory({
      ok: true,
      summary,
      count: done,
    });

    dispatch("sakura-sync-done", { count: done, summary });
    dispatch("sakura-offline-queue-changed", { pending: countPending(queue) });
    return { ok: true, count: done, summary };
  }

  function scheduleAutoRetry(db, firebase) {
    if (retryTimerId) {
      global.clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    const queue = loadQueue();
    const next = queue.pending
      .filter((x) => !x.synced && x.nextRetryAt > 0)
      .map((x) => x.nextRetryAt)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const delay = Math.max(0, next - Date.now());
    retryTimerId = global.setTimeout(() => {
      retryTimerId = null;
      if (isOnline()) void runSync(db, firebase);
    }, delay + 50);
  }

  function persistAppSnapshot(snapshot) {
    try {
      const prev = loadAppSnapshot() || {};
      const data = {
        version: 1,
        savedAt: Date.now(),
        ...prev,
        ...snapshot,
      };
      global.localStorage?.setItem(getCacheKey(), JSON.stringify(data));
    } catch (e) {
      console.warn("cache save failed", e);
    }
  }

  function loadAppSnapshot() {
    try {
      const raw = global.localStorage?.getItem(getCacheKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getLastSyncTime() {
    return loadQueue().lastSyncTime || 0;
  }

  function getStorageEstimate() {
    if (!global.navigator?.storage?.estimate) {
      return Promise.resolve(null);
    }
    return global.navigator.storage.estimate().then((est) => ({
      usage: est.usage,
      quota: est.quota,
    }));
  }

  /** Service Worker 登録（http/https のみ。file:// では未対応） */
  function registerServiceWorker(scriptUrl) {
    if (!("serviceWorker" in global.navigator)) return Promise.resolve(false);
    const protocol = global.location?.protocol;
    if (protocol === "file:" || protocol === "null:") return Promise.resolve(false);
    return global.navigator.serviceWorker
      .register(scriptUrl)
      .then(() => true)
      .catch((e) => {
        console.warn("SW register failed", e);
        return false;
      });
  }

  const api = {
    configureSyncContext,
    getQueueKey,
    getCacheKey,
    loadQueue,
    saveQueue,
    enqueue,
    getPendingCount,
    isOnline,
    makeTempId,
    runSync,
    scheduleAutoRetry,
    persistAppSnapshot,
    loadAppSnapshot,
    getLastSyncTime,
    loadHistory,
    pushHistory,
    getStorageEstimate,
    registerServiceWorker,
    prefersReducedMotion,
    nextBackoffMs,
  };

  global.SakuraOfflineSync = api;
})(typeof window !== "undefined" ? window : globalThis);
