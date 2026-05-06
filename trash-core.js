/**
 * ゴミ箱（Realtime Database /trash）の共通ロジック
 * 各ページの script から参照する。
 */
(function (global) {
  const TRASH_PATH = "trash";
  const PATHS = {
    players: "players",
    tournaments: "tournaments",
    matches: "matches",
    records: "records",
    goals: "goals",
  };

  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  const ITEM_TYPES = {
    competition: "competition",
    match: "match",
    student: "student",
    goal: "goal",
  };

  function getTrashRef(db) {
    return db.ref(TRASH_PATH);
  }

  function nowTs() {
    return Date.now();
  }

  /**
   * 期限切れゴミ箱エントリを削除する（クライアント側のベストエフォート）
   */
  async function purgeExpiredTrash(db) {
    if (!db) return 0;
    const snap = await getTrashRef(db).once("value");
    const data = snap.val() ?? {};
    const t = nowTs();
    const updates = {};
    let n = 0;
    for (const [id, item] of Object.entries(data)) {
      if (item && typeof item.expiresAt === "number" && item.expiresAt <= t) {
        updates[id] = null;
        n += 1;
      }
    }
    if (Object.keys(updates).length) {
      await getTrashRef(db).update(updates);
    }
    return n;
  }

  async function pushTrashItem(db, { itemType, itemId, itemName, originalData, deletedBy = "staff" }) {
    if (!db) throw new Error("Firebase未接続");
    const ref = getTrashRef(db).push();
    const deletedAt = nowTs();
    await ref.set({
      itemType,
      itemId,
      itemName: String(itemName ?? ""),
      originalData: originalData ?? {},
      deletedBy,
      deletedAt,
      expiresAt: deletedAt + RETENTION_MS,
    });
    return ref.key;
  }

  async function listTrashItems(db) {
    if (!db) return [];
    await purgeExpiredTrash(db);
    const snap = await getTrashRef(db).once("value");
    const data = snap.val() ?? {};
    return Object.entries(data)
      .map(([id, item]) => ({ id, ...item }))
      .filter((x) => x.itemType && x.itemId);
  }

  async function getTrashItem(db, trashId) {
    if (!db || !trashId) return null;
    const snap = await getTrashRef(db).child(trashId).once("value");
    const val = snap.val();
    if (val == null) return null;
    return { id: trashId, ...val };
  }

  async function removeTrashEntry(db, trashId) {
    await getTrashRef(db).child(trashId).remove();
  }

  async function snapshotTournamentTree(db, tournamentId) {
    const [tSnap, mSnap, rSnap] = await Promise.all([
      db.ref(`${PATHS.tournaments}/${tournamentId}`).once("value"),
      db.ref(`${PATHS.matches}/${tournamentId}`).once("value"),
      db.ref(`${PATHS.records}/${tournamentId}`).once("value"),
    ]);
    return {
      tournamentId,
      tournament: tSnap.val() ?? null,
      matches: mSnap.val() ?? {},
      records: rSnap.val() ?? {},
    };
  }

  async function snapshotMatchTree(db, tournamentId, matchId) {
    const [mSnap, rSnap] = await Promise.all([
      db.ref(`${PATHS.matches}/${tournamentId}/${matchId}`).once("value"),
      db.ref(`${PATHS.records}/${tournamentId}/${matchId}`).once("value"),
    ]);
    return {
      tournamentId,
      matchId,
      match: mSnap.val() ?? null,
      records: rSnap.val() ?? {},
    };
  }

  async function removePlayerRecordsFromDatabase(db, playerId) {
    const tSnap = await db.ref(PATHS.tournaments).once("value");
    const tournaments = tSnap.val() ?? {};
    for (const tid of Object.keys(tournaments)) {
      const recSnap = await db.ref(`${PATHS.records}/${tid}`).once("value");
      const recTree = recSnap.val() ?? {};
      for (const mid of Object.keys(recTree)) {
        const playersRec = recTree[mid];
        if (playersRec && typeof playersRec === "object" && playersRec[playerId] !== undefined) {
          await db.ref(`${PATHS.records}/${tid}/${mid}/${playerId}`).remove();
        }
      }
    }
  }

  async function collectPlayerRecordsAcrossTournaments(db, playerId) {
    const tSnap = await db.ref(PATHS.tournaments).once("value");
    const tournaments = tSnap.val() ?? {};
    const recordsByTournament = {};
    for (const tid of Object.keys(tournaments)) {
      const recSnap = await db.ref(`${PATHS.records}/${tid}`).once("value");
      const recTree = recSnap.val() ?? {};
      const forPlayer = {};
      for (const [mid, playersRec] of Object.entries(recTree)) {
        if (playersRec && typeof playersRec === "object" && playersRec[playerId] !== undefined) {
          forPlayer[mid] = playersRec[playerId];
        }
      }
      if (Object.keys(forPlayer).length) {
        recordsByTournament[tid] = forPlayer;
      }
    }
    return recordsByTournament;
  }

  async function snapshotPlayerForTrash(db, playerId) {
    const pSnap = await db.ref(`${PATHS.players}/${playerId}`).once("value");
    const player = pSnap.val();
    const recordsByTournament = await collectPlayerRecordsAcrossTournaments(db, playerId);
    return {
      playerId,
      player,
      recordsByTournament,
    };
  }

  async function restoreCompetition(db, originalData) {
    const tid = originalData.tournamentId;
    if (!tid) throw new Error("大会IDがありません");
    const existsSnap = await db.ref(`${PATHS.tournaments}/${tid}`).once("value");
    if (existsSnap.val() != null) {
      throw new Error("同じIDの大会が既に存在します。復元できません。");
    }
    await db.ref(`${PATHS.tournaments}/${tid}`).set(originalData.tournament);
    await db.ref(`${PATHS.matches}/${tid}`).set(originalData.matches ?? {});
    await db.ref(`${PATHS.records}/${tid}`).set(originalData.records ?? {});
  }

  async function restoreMatch(db, originalData) {
    const { tournamentId, matchId } = originalData;
    if (!tournamentId || !matchId) throw new Error("試合の参照が不正です");
    const existsSnap = await db.ref(`${PATHS.matches}/${tournamentId}/${matchId}`).once("value");
    if (existsSnap.val() != null) {
      throw new Error("同じIDの試合が既に存在します。復元できません。");
    }
    await db.ref(`${PATHS.matches}/${tournamentId}/${matchId}`).set(originalData.match);
    await db.ref(`${PATHS.records}/${tournamentId}/${matchId}`).set(originalData.records ?? {});
  }

  async function restoreStudent(db, originalData) {
    const pid = originalData.playerId;
    if (!pid) throw new Error("選手IDがありません");
    const existsSnap = await db.ref(`${PATHS.players}/${pid}`).once("value");
    if (existsSnap.val() != null) {
      throw new Error("同じIDの選手が既に存在します。復元できません。");
    }
    await db.ref(`${PATHS.players}/${pid}`).set(originalData.player);
    const byT = originalData.recordsByTournament ?? {};
    for (const [tid, matchMap] of Object.entries(byT)) {
      for (const [mid, rec] of Object.entries(matchMap)) {
        await db.ref(`${PATHS.records}/${tid}/${mid}/${pid}`).set(rec);
      }
    }
  }

  async function restoreGoal(db, originalData) {
    const gid = originalData.goalId;
    if (!gid) throw new Error("目標IDがありません");
    const existsSnap = await db.ref(`${PATHS.goals}/${gid}`).once("value");
    if (existsSnap.val() != null) {
      throw new Error("同じIDの目標が既に存在します。復元できません。");
    }
    await db.ref(`${PATHS.goals}/${gid}`).set(originalData.goal);
  }

  async function restoreTrashItem(db, trashId) {
    const item = await getTrashItem(db, trashId);
    if (!item || !item.originalData) {
      throw new Error("ゴミ箱データが見つかりません。既に完全削除されている可能性があります。");
    }
    const od = item.originalData;
    switch (item.itemType) {
      case ITEM_TYPES.competition:
        await restoreCompetition(db, od);
        break;
      case ITEM_TYPES.match:
        await restoreMatch(db, od);
        break;
      case ITEM_TYPES.student:
        await restoreStudent(db, od);
        break;
      case ITEM_TYPES.goal:
        await restoreGoal(db, od);
        break;
      default:
        throw new Error("不明なアイテム種別です");
    }
    await removeTrashEntry(db, trashId);
  }

  async function permanentDeleteTrashItem(db, trashId) {
    const item = await getTrashItem(db, trashId);
    if (!item) {
      throw new Error("ゴミ箱データが見つかりません。既に完全削除されている可能性があります。");
    }
    await removeTrashEntry(db, trashId);
  }

  async function emptyTrash(db) {
    const items = await listTrashItems(db);
    await Promise.all(items.map((it) => removeTrashEntry(db, it.id)));
  }

  function itemTypeLabel(itemType) {
    const map = {
      competition: "大会",
      match: "試合",
      student: "選手",
      goal: "目標",
    };
    return map[itemType] ?? itemType;
  }

  global.TrashCore = {
    TRASH_PATH,
    PATHS,
    RETENTION_MS,
    ITEM_TYPES,
    purgeExpiredTrash,
    pushTrashItem,
    listTrashItems,
    getTrashItem,
    removeTrashEntry,
    snapshotTournamentTree,
    snapshotMatchTree,
    snapshotPlayerForTrash,
    removePlayerRecordsFromDatabase,
    restoreTrashItem,
    permanentDeleteTrashItem,
    emptyTrash,
    itemTypeLabel,
    formatDeletedAt(ts) {
      if (!ts) return "—";
      try {
        return new Date(ts).toLocaleString("ja-JP");
      } catch {
        return String(ts);
      }
    },
    formatExpiresIn(expiresAt) {
      if (!expiresAt) return "—";
      const days = Math.max(0, Math.ceil((expiresAt - nowTs()) / (24 * 60 * 60 * 1000)));
      return `あと ${days} 日`;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
