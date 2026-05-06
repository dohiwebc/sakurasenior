/**
 * 目標通知バッジ用：全目標の進捗を集計し未読件数を算出（goals.html の calcGoalProgress と同等ロジック、d3 非依存）
 */
(function () {
  const GOAL_METRICS = [
    { key: "attackSuccess", label: "アタック成功数", type: "count" },
    { key: "catch", label: "キャッチ数", type: "count" },
    { key: "attackRate", label: "アタック成功率", type: "rate" },
    { key: "catchRate", label: "キャッチ率", type: "rate" },
    { key: "attackContribution", label: "アタック貢献度", type: "rate" },
    { key: "catchContribution", label: "キャッチ貢献度", type: "rate" },
    { key: "zeroBreak", label: "ゼロ抜き数", type: "count" },
    { key: "return", label: "内野復帰数", type: "count" },
  ];

  function safeNum(v) {
    return Number(v) || 0;
  }

  function normalizeDate(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    const m2 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return "";
  }

  function toEpochMs(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
    const s = normalizeDate(value);
    if (!s) return 0;
    const t = Date.parse(`${s}T00:00:00+09:00`);
    return Number.isFinite(t) ? t : 0;
  }

  function getAttackFailure(rec) {
    if (Number.isFinite(rec.attackFailure)) return Math.max(0, safeNum(rec.attackFailure));
    return Math.max(0, safeNum(rec.attack) - safeNum(rec.attackSuccess));
  }

  function getMetricDef(key) {
    return GOAL_METRICS.find((m) => m.key === key) || GOAL_METRICS[0];
  }

  function sum(entries, fn) {
    return entries.reduce((s, x) => s + fn(x), 0);
  }

  function calcGoalProgress(state, goal) {
    const playerId = goal.userId;
    const scope = goal.targetScope || "player";
    const metric = goal.targetItem;
    const isRate = getMetricDef(metric).type === "rate";
    const target = safeNum(goal.targetValue);
    const records = [];

    const startNorm = normalizeDate(goal.startDate);
    const endNorm = normalizeDate(goal.endDate);
    const inDateRange = (date) => {
      if (goal.goalType === "short") return true;
      const d = normalizeDate(date);
      if (!d) return !startNorm && !endNorm;
      if (startNorm && d < startNorm) return false;
      if (endNorm && d > endNorm) return false;
      return true;
    };

    const tournamentIds =
      goal.goalType === "short" && goal.relatedEvent ? [goal.relatedEvent] : state.tournaments.map((t) => t.id);

    tournamentIds.forEach((tid) => {
      const td = state.allTournamentData[tid];
      if (!td) return;
      (td.matches || []).forEach((m) => {
        const effectiveDate = normalizeDate(m.date) || normalizeDate(td.tournamentDate);
        if (!inDateRange(effectiveDate)) return;
        const all = td.recordsByMatch[m.id] || {};
        if (scope === "team") {
          const entries = Object.values(all).filter((r) => !r?.isBench);
          if (!entries.length) return;
          records.push({
            date: effectiveDate || "",
            rec: {
              attackSuccess: sum(entries, (r) => safeNum(r.attackSuccess)),
              attackFailure: sum(entries, (r) => getAttackFailure(r)),
              catch: sum(entries, (r) => safeNum(r.catch)),
              out: sum(entries, (r) => safeNum(r.out)),
              return: sum(entries, (r) => safeNum(r.return)),
              zeroBreak: sum(entries, (r) => safeNum(r.zeroBreak)),
            },
            all,
            isTeam: true,
          });
        } else {
          const rec = all[playerId] || {};
          if (rec.isBench) return;
          records.push({ date: effectiveDate || "", rec, all, isTeam: false });
        }
      });
    });
    records.sort((a, b) => (a.date || "").localeCompare(b.date || "", "ja"));

    let accSuccess = 0,
      accFail = 0,
      accCatch = 0,
      accOut = 0,
      accReturn = 0,
      accZero = 0;
    let accAtkContrib = 0,
      accCatchContrib = 0,
      games = 0;
    const series = records.map((it) => {
      const rec = it.rec;
      const all = it.all;
      const success = safeNum(rec.attackSuccess);
      const fail = getAttackFailure(rec);
      const catchN = safeNum(rec.catch);
      const outN = safeNum(rec.out);
      const retN = safeNum(rec.return);
      const zeroN = safeNum(rec.zeroBreak);
      const teamAtk = Object.values(all).reduce((s, x) => s + (x?.isBench ? 0 : safeNum(x?.attackSuccess)), 0);
      const teamCatch = Object.values(all).reduce((s, x) => s + (x?.isBench ? 0 : safeNum(x?.catch)), 0);

      accSuccess += success;
      accFail += fail;
      accCatch += catchN;
      accOut += outN;
      accReturn += retN;
      accZero += zeroN;
      accAtkContrib += it.isTeam ? (success > 0 ? 100 : 0) : teamAtk ? (success / teamAtk) * 100 : 0;
      accCatchContrib += it.isTeam ? (catchN > 0 ? 100 : 0) : teamCatch ? (catchN / teamCatch) * 100 : 0;
      games += 1;

      const map = {
        attackSuccess: accSuccess,
        catch: accCatch,
        zeroBreak: accZero,
        return: accReturn,
        attackRate: accSuccess + accFail ? (accSuccess / (accSuccess + accFail)) * 100 : 0,
        catchRate: accCatch + accOut ? (accCatch / (accCatch + accOut)) * 100 : 0,
        attackContribution: games ? accAtkContrib / games : 0,
        catchContribution: games ? accCatchContrib / games : 0,
      };
      return { date: it.date, value: safeNum(map[metric]) };
    });

    const currentValue = series[series.length - 1]?.value || 0;
    let dynamic = currentValue >= target ? "ongoing_achieving" : "ongoing";
    if (goal.status === "achieved") dynamic = "achieved";
    if (goal.status === "not_achieved") dynamic = "not_achieved";

    const statusTextMap = {
      ongoing_achieving: "目標達成中",
      ongoing: "目標未達",
      achieved: "目標達成！",
      not_achieved: "目標未達",
    };
    return {
      target,
      currentValue,
      isRate,
      series,
      status: dynamic,
      statusText: statusTextMap[dynamic] || "目標未達",
    };
  }

  function countUnreadAllGoals(state, readMap) {
    let unread = 0;
    let total = 0;
    for (const g of state.goals) {
      const pr = calcGoalProgress(state, g);
      if (!["ongoing_achieving", "ongoing", "achieved"].includes(pr.status)) continue;
      total += 1;
      if (!readMap[g.id]) unread += 1;
    }
    return { unread, total };
  }

  function fmtPercent(v) {
    return `${(Number(v) || 0).toFixed(1)}%`;
  }

  function getGoalSubjectName(goal, players) {
    if (goal.targetScope === "team") return "チーム全体";
    const p = players.find((x) => x.id === goal.userId);
    return p?.name || "未登録選手";
  }

  function buildProgressMessage(goal, pr) {
    const diff = pr.target - pr.currentValue;
    if (pr.status === "achieved") return "この目標は達成確定済みです。";
    if (pr.status === "ongoing_achieving") return "目標値を上回っています。維持を目指しましょう。";
    if (pr.isRate) return `目標まであと ${Math.max(0, diff).toFixed(1)}%`;
    return `目標まであと ${Math.max(0, Math.ceil(diff))} 回`;
  }

  const LS_MATCH_FP = "sakura-match-records-fp";
  const LS_MATCH_FP_SEEDED = "sakura-match-fp-seeded";

  function readMatchFpMap() {
    try {
      return JSON.parse(localStorage.getItem(LS_MATCH_FP) || "{}");
    } catch {
      return {};
    }
  }

  function writeMatchFpMap(map) {
    try {
      localStorage.setItem(LS_MATCH_FP, JSON.stringify(map));
    } catch {}
  }

  function isMatchFpSeeded() {
    return localStorage.getItem(LS_MATCH_FP_SEEDED) === "1";
  }

  /** 試合ごとの記録内容の簡易フィンガープリント（更新検知用） */
  function fingerprintForMatch(recordsByMatch, matchId) {
    const all = recordsByMatch[matchId] || {};
    const keys = Object.keys(all).sort();
    let acc = 0;
    for (const k of keys) {
      const r = all[k] || {};
      if (r.isBench) continue;
      acc +=
        safeNum(r.attackSuccess) +
        safeNum(r.catch) +
        safeNum(r.out) +
        safeNum(r.return) +
        safeNum(r.zeroBreak) +
        safeNum(r.attack);
    }
    return `${keys.length}:${acc}`;
  }

  /** 初回のみ現在状態を「既読」相当に取り込み、以降の差分だけ通知 */
  function seedMatchFingerprintsIfNeeded(state) {
    if (isMatchFpSeeded()) return;
    const m = readMatchFpMap();
    for (const t of state.tournaments) {
      const td = state.allTournamentData[t.id];
      if (!td) continue;
      for (const match of td.matches) {
        const key = `${t.id}|${match.id}`;
        m[key] = fingerprintForMatch(td.recordsByMatch, match.id);
      }
    }
    writeMatchFpMap(m);
    try {
      localStorage.setItem(LS_MATCH_FP_SEEDED, "1");
    } catch {}
  }

  function buildMatchNoticeRows(state) {
    seedMatchFingerprintsIfNeeded(state);
    const seen = readMatchFpMap();
    const rows = [];
    for (const t of state.tournaments) {
      const td = state.allTournamentData[t.id];
      if (!td) continue;
      for (const match of td.matches) {
        const key = `${t.id}|${match.id}`;
        const fp = fingerprintForMatch(td.recordsByMatch, match.id);
        const prev = seen[key];
        const unread = prev === undefined || fp !== prev;
        const sub = `${match.stage || "区分未設定"} vs ${match.opponent || "—"}`;
        rows.push({
          kind: "match",
          tournamentId: t.id,
          matchId: match.id,
          key,
          fp,
          unread,
          displayOrder: Number.isFinite(Number(match.displayOrder)) ? Number(match.displayOrder) : null,
          sortTs: toEpochMs(match.date || td.tournamentDate || ""),
          title: `<i class="fa-solid fa-table"></i> 試合データ`,
          body: `${t.name} / ${sub}（日付: ${match.date || "—"}）`,
        });
      }
    }
    rows.sort((a, b) => {
      const ao = Number(a.displayOrder);
      const bo = Number(b.displayOrder);
      const ah = Number.isFinite(ao);
      const bh = Number.isFinite(bo);
      if (ah && bh && ao !== bo) return bo - ao;
      if (ah && !bh) return -1;
      if (!ah && bh) return 1;
      const bt = Number(b.sortTs) || 0;
      const at = Number(a.sortTs) || 0;
      if (bt !== at) return bt - at;
      return (a.body || "").localeCompare(b.body || "", "ja");
    });
    return rows;
  }

  /** goals.html の通知一覧と同じ条件・文言で行を生成（全選手・チームの目標を対象） */
  function buildNoticeRows(state, readMap) {
    const rows = [];
    for (const g of state.goals) {
      const pr = calcGoalProgress(state, g);
      if (!["ongoing_achieving", "ongoing", "achieved"].includes(pr.status)) continue;
      const unread = !readMap[g.id];
      const title =
        pr.status === "achieved"
          ? `<i class="fa-solid fa-award"></i> 目標達成！`
          : pr.status === "ongoing_achieving"
            ? `<i class="fa-solid fa-circle-check"></i> 目標達成中`
            : `<i class="fa-solid fa-chart-line"></i> 目標未達`;
      const cur =
        pr.progressText || (pr.isRate ? fmtPercent(pr.currentValue) : (Number(pr.currentValue) || 0).toFixed(1));
      const body = `${getGoalSubjectName(g, state.players)} / ${getMetricDef(g.targetItem).label} 現在: ${cur} | 目標: ${g.targetValue}${pr.isRate ? "%" : ""} | ${buildProgressMessage(g, pr)}`;
      rows.push({
        goalId: g.id,
        title,
        body,
        unread,
        userId: g.userId || "",
        targetScope: g.targetScope || "player",
        status: pr.status,
        sortTs: toEpochMs(g.updatedAt || g.createdAt || 0),
      });
    }
    rows.sort((a, b) => {
      const bt = Number(b.sortTs) || 0;
      const at = Number(a.sortTs) || 0;
      if (bt !== at) return bt - at;
      return (a.body || "").localeCompare(b.body || "", "ja");
    });
    return rows;
  }

  async function fetchAggregatedState(db) {
    const [pSnap, tSnap, gSnap] = await Promise.all([
      db.ref("players").once("value"),
      db.ref("tournaments").once("value"),
      db.ref("goals").once("value"),
    ]);
    const players = Object.entries(pSnap.val() || {})
      .map(([id, v]) => ({ id, name: v.name || "", active: v.active !== false }))
      .filter((p) => p.active !== false);
    const tournaments = Object.entries(tSnap.val() || {})
      .map(([id, v]) => ({ id, name: v.name || "", date: v.date || "" }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "", "ja"));
    const goals = Object.entries(gSnap.val() || {}).map(([id, v]) => ({ id, ...v }));

    const allTournamentData = {};
    await Promise.all(
      tournaments.map(async (t) => {
        const [mSnap, rSnap] = await Promise.all([
          db.ref(`matches/${t.id}`).once("value"),
          db.ref(`records/${t.id}`).once("value"),
        ]);
        allTournamentData[t.id] = {
          tournamentDate: t.date || "",
          matches: Object.entries(mSnap.val() || {}).map(([id, v]) => ({
            id,
            date: v.date || "",
            stage: v.stage || "予選",
            opponent: v.opponent || "",
            displayOrder: Number.isFinite(Number(v.displayOrder)) ? Number(v.displayOrder) : null,
            tournamentId: t.id,
            tournamentName: t.name,
          })),
          recordsByMatch: rSnap.val() || {},
        };
      })
    );

    const state = { players, tournaments, goals, allTournamentData };
    let readMap = {};
    try {
      readMap = JSON.parse(localStorage.getItem("goal-read-map") || "{}");
    } catch {
      readMap = {};
    }
    return { state, readMap };
  }

  async function loadBadgeState(db) {
    const { state, readMap } = await fetchAggregatedState(db);
    const g = countUnreadAllGoals(state, readMap);
    const matchNotices = buildMatchNoticeRows(state);
    const matchUnread = matchNotices.filter((x) => x.unread).length;
    return {
      unread: g.unread + matchUnread,
      goalUnread: g.unread,
      matchUnread,
      total: g.total,
      error: null,
    };
  }

  window.SakuraGoalBadge = {
    async refresh(db) {
      if (!db) return { unread: 0, total: 0, error: "no-db" };
      try {
        return await loadBadgeState(db);
      } catch (e) {
        console.warn("[SakuraGoalBadge]", e);
        return { unread: 0, total: 0, error: String(e?.message || e) };
      }
    },
    /** 試合の現在フィンガープリントを既読として保存 */
    markMatchFingerprintSeen(tournamentId, matchId, fp) {
      const key = `${tournamentId}|${matchId}`;
      const m = readMatchFpMap();
      m[key] = fp;
      writeMatchFpMap(m);
    },
    /** 通知一覧の試合行をまとめて既読化 */
    markAllMatchFingerprintsSeen(rows) {
      const m = readMatchFpMap();
      (rows || []).forEach((row) => {
        const tid = row?.tournamentId;
        const mid = row?.matchId;
        if (!tid || !mid) return;
        m[`${tid}|${mid}`] = row?.fp || "";
      });
      writeMatchFpMap(m);
    },
    /** ナビの通知パネル用：目標通知・試合データ通知・未読数 */
    /** goals 以外のページで目標通知モーダルを出す用（集約 state + 進捗計算） */
    async fetchGoalOverlayState(db) {
      if (!db) return { state: null, readMap: {} };
      return fetchAggregatedState(db);
    },
    calcGoalProgressForOverlay(state, goal) {
      return calcGoalProgress(state, goal);
    },
    buildProgressMessageForOverlay(goal, pr) {
      return buildProgressMessage(goal, pr);
    },
    getMetricDefForOverlay(key) {
      return getMetricDef(key);
    },
    getGoalSubjectNameForOverlay(goal, players) {
      return getGoalSubjectName(goal, players);
    },
    async getNotices(db) {
      if (!db) {
        return {
          goalNotices: [],
          matchNotices: [],
          players: [],
          goalUnread: 0,
          matchUnread: 0,
          unread: 0,
          error: "no-db",
        };
      }
      try {
        const { state, readMap } = await fetchAggregatedState(db);
        const goalNotices = buildNoticeRows(state, readMap);
        const matchNotices = buildMatchNoticeRows(state);
        const { unread: goalUnread, total: goalTotal } = countUnreadAllGoals(state, readMap);
        const matchUnread = matchNotices.filter((x) => x.unread).length;
        const players = state.players.map((p) => ({ id: p.id, name: p.name || "" }));
        return {
          goalNotices,
          matchNotices,
          players,
          goalUnread,
          matchUnread,
          unread: goalUnread + matchUnread,
          goalTotal,
          error: null,
          /** 後方互換（旧 getNotices 利用箇所向け） */
          notices: goalNotices,
          total: goalTotal,
        };
      } catch (e) {
        console.warn("[SakuraGoalBadge.getNotices]", e);
        return {
          goalNotices: [],
          matchNotices: [],
          players: [],
          goalUnread: 0,
          matchUnread: 0,
          unread: 0,
          error: String(e?.message || e),
        };
      }
    },
  };
})();
