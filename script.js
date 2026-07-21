const firebaseConfig = {
  apiKey: "AIzaSyA5Kvd5-xvGGMFDLjuUMtmSRYXMk69g1DI",
  authDomain: "sakurasenior-d6710.firebaseapp.com",
  databaseURL:
    "https://sakurasenior-d6710-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sakurasenior-d6710",
  storageBucket: "sakurasenior-d6710.firebasestorage.app",
  messagingSenderId: "411200767986",
  appId: "1:411200767986:web:56138e1598dc5351e24d6b",
  measurementId: "G-BHT0M75LV6",
};

if (typeof SakuraOfflineSync !== "undefined" && firebaseConfig.projectId) {
  SakuraOfflineSync.configureSyncContext({ projectId: firebaseConfig.projectId });
}

/** DBに選手がいないときの初期投入用。別チーム運用では空のまま（Firebase のみが正） */
const FALLBACK_PLAYERS = [];

/**
 * 閲覧モードで「選手名」ソート時の優先順。先頭ほど先に並ぶ。
 * 空なら五十音順（localeCompare）のみ。チーム固有の並びが必要なら Firebase の name と同じ文字列を並べる。
 */
const VIEWER_ROSTER_NAME_ORDER = [];

let players = [...FALLBACK_PLAYERS];
let currentTournaments = [];
let currentMatches = [];

const stats = [
  { key: "attackSuccess", label: "アタック成功数" },
  { key: "attackFailure", label: "アタック失敗数" },
  { key: "zeroBreak", label: "ゼロ抜き数" },
  { key: "catch", label: "キャッチ数" },
  { key: "out", label: "アウト数" },
  { key: "return", label: "復帰数" },
];

/** スターティングメンバー人数（試合記録フロー） */
const LINEUP_STARTER_COUNT = 8;

/** 自動保存までの待ち時間（ミリ秒） */
const AUTO_SAVE_DELAY_MS = 60_000;

const GRADE_SYMBOLS = {
  "1": "①",
  "2": "②",
  "3": "③",
};

const ROLE_LABELS = {
  captain: "★",
  viceCaptain: "☆",
};

const CIRCLED_NUMBERS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

const state = {
  selectedPlayerId: players[0]?.id ?? "",
  records: {},
  role: null,
  selectedTournamentId: "",
  selectedMatchId: "",
  viewerSelectedMatchIds: [],
  viewerSelectedPlayerId: "all",
  viewerTournamentTypeFilter: "all",
  viewerStageFilter: "all",
  viewerOpponentFilter: "all",
  viewerOpponentCategoryFilter: "all",
  viewerDetailMatchId: "",
  viewerTournamentRecords: {},
  viewerLastRenderedRows: [],
  viewerLastSelectedMatchIds: [],
  viewerSortKey: "name",
  viewerSortOrder: "asc",
  viewerDetailSortKey: "name",
  viewerDetailSortOrder: "asc",
  currentStep: 1,
  showActiveOnly: false,
  showGuestPlayers: true,
  newTournamentParticipantIds: [],
  editTournamentParticipantIds: [],
  autoSaveTimerId: null,
  autoSaveCountdownId: null,
  autoSaveDueAt: null,
  currentMatchSaveHistory: [],
  currentMatchLastUpdatedAt: null,
  exportSelectedTournamentIds: [],
  /** 試合ドキュメントに保存する途中交代ログ */
  matchSubstitutions: [],
  /** スタメン選択UI: 'pick' | 'confirm' */
  lineupUiPhase: "pick",
  /** スタメン選択中の一時選択（選手ID） */
  lineupDraftIds: [],
  /** 参加状況UI: playerId -> "present" | "absent" */
  attendanceDraft: {},
};

const PASSWORDS = {
  staff: "sakurastaff",
};

const DB_PATHS = {
  players: "players",
  tournaments: "tournaments",
  matches: "matches",
  records: "records",
};

const TOURNAMENT_SELECT_ALL = "__all_tournaments__";
const EXPORT_SELECT_ALL_MATCHES = "__export_all_matches__";
const GUEST_PLAYER_SLOTS = [
  { id: "__guest__", name: "助っ人" },
  { id: "__guest2__", name: "助っ人2" },
  { id: "__guest3__", name: "助っ人3" },
  { id: "__guest4__", name: "助っ人4" },
];
const GUEST_PLAYER_IDS = new Set(GUEST_PLAYER_SLOTS.map((slot) => slot.id));

/** サイト全体のチュートリアル関連（RTDB）。子キー: tutorialOfferFirstVisit, tutorialManualEnabled */
const SITE_SETTINGS_REF = "siteSettings";

const loginCardEl = document.getElementById("loginCard");
const appAreaEl = document.getElementById("appArea");
const playerLoginButtonEl = document.getElementById("playerLoginButton");
const staffModeButtonEl = document.getElementById("staffModeButton");
const staffPasswordAreaEl = document.getElementById("staffPasswordArea");
const loginPasswordEl = document.getElementById("loginPassword");
const staffLoginButtonEl = document.getElementById("staffLoginButton");
const loginErrorEl = document.getElementById("loginError");
const editLoginModalEl = document.getElementById("editLoginModal");
const editLoginBackdropEl = document.getElementById("editLoginBackdrop");
const editLoginCloseButtonEl = document.getElementById("editLoginCloseButton");
const editLoginPasswordEl = document.getElementById("editLoginPassword");
const editLoginSubmitButtonEl = document.getElementById("editLoginSubmitButton");
const editLoginErrorEl = document.getElementById("editLoginError");
const metricsAccordionButtonEl = document.getElementById("metricsAccordionButton");
const metricsAccordionBodyEl = document.getElementById("metricsAccordionBody");
const metricsAccordionIconEl = document.getElementById("metricsAccordionIcon");
const loginInfoAccordionButtonEl = document.getElementById("loginInfoAccordionButton");
const loginInfoAccordionBodyEl = document.getElementById("loginInfoAccordionBody");
const loginInfoAccordionIconEl = document.getElementById("loginInfoAccordionIcon");
const loginInfoCardEl = document.getElementById("loginInfoCard");
const logoutButtonEl = document.getElementById("logoutButton");
const modeTextEl = document.getElementById("modeText");
const staffTutorialOfferRowEl = document.getElementById("staffTutorialOfferRow");
const staffTutorialOfferFirstVisitCheckboxEl = document.getElementById("staffTutorialOfferFirstVisitCheckbox");
const staffTutorialManualEnabledCheckboxEl = document.getElementById("staffTutorialManualEnabledCheckbox");
const saveMatchButtonEl = document.getElementById("saveMatchButton");
const saveStatusEl = document.getElementById("saveStatus");
const saveStatusDetailEl = document.getElementById("saveStatusDetail");
const validationMessageEl = document.getElementById("validationMessage");
const lastUpdatedTextEl = document.getElementById("lastUpdatedText");
const saveHistoryListEl = document.getElementById("saveHistoryList");

const tabsEl = document.getElementById("playerTabs");
const statsAreaEl = document.getElementById("statsArea");
const currentPlayerNameEl = document.getElementById("currentPlayerName");
const totalPlaysEl = document.getElementById("totalPlays");
const playerBenchStatusEl = document.getElementById("playerBenchStatus");
const toggleBenchButtonEl = document.getElementById("toggleBenchButton");
const togglePlayerActiveButtonEl = document.getElementById("togglePlayerActiveButton");
const benchMessageEl = document.getElementById("benchMessage");
const newPlayerNameEl = document.getElementById("newPlayerName");
const newPlayerGradeEl = document.getElementById("newPlayerGrade");
const newPlayerRoleEl = document.getElementById("newPlayerRole");
const newPlayerHandednessEl = document.getElementById("newPlayerHandedness");
const newPlayerMemoEl = document.getElementById("newPlayerMemo");
const createPlayerButtonEl = document.getElementById("createPlayerButton");
const showActiveOnlyButtonEl = document.getElementById("showActiveOnlyButton");
const toggleGuestVisibilityButtonEl = document.getElementById("toggleGuestVisibilityButton");
const togglePlayerManagementButtonEl = document.getElementById("togglePlayerManagementButton");
const playerManagementSectionEl = document.getElementById("playerManagementSection");
const playerManagementAccordionButtonEl = document.getElementById("playerManagementAccordionButton");
const playerManagementAccordionBodyEl = document.getElementById("playerManagementAccordionBody");
const playerManagementAccordionIconEl = document.getElementById("playerManagementAccordionIcon");
const playerManagementCreateAreaEl = document.getElementById("playerManagementCreateArea");
const playerManagementListEl = document.getElementById("playerManagementList");
const matchSummaryEl = document.getElementById("matchSummary");
const activePlayerCountEl = document.getElementById("activePlayerCount");
const benchPlayerCountEl = document.getElementById("benchPlayerCount");
const allPlayersTotalPlaysEl = document.getElementById("allPlayersTotalPlays");
const opponentEl = document.getElementById("opponent");
const opponentTeamShortcutAreaEl = document.getElementById("opponentTeamShortcutArea");
const matchStageEl = document.getElementById("matchStage");
const tournamentSelectEl = document.getElementById("tournamentSelect");
const tournamentHelpTextEl = document.getElementById("tournamentHelpText");
const newTournamentNameEl = document.getElementById("newTournamentName");
const tournamentDateEl = document.getElementById("tournamentDate");
const tournamentMatchTypeEl = document.getElementById("tournamentMatchType");
const tournamentOpponentCategoryModeEl = document.getElementById("tournamentOpponentCategoryMode");
const tournamentDefaultOpponentCategoryEl = document.getElementById("tournamentDefaultOpponentCategory");
const newTournamentOpponentTeamsEl = document.getElementById("newTournamentOpponentTeams");
const tournamentParticipantListEl = document.getElementById("tournamentParticipantList");
const selectAllTournamentParticipantsButtonEl = document.getElementById("selectAllTournamentParticipantsButton");
const clearTournamentParticipantsButtonEl = document.getElementById("clearTournamentParticipantsButton");
const createTournamentButtonEl = document.getElementById("createTournamentButton");
const confirmTournamentButtonEl = document.getElementById("confirmTournamentButton");
const toggleTournamentCreateButtonEl = document.getElementById("toggleTournamentCreateButton");
const toggleTournamentEditButtonEl = document.getElementById("toggleTournamentEditButton");
const tournamentCreateAreaEl = document.getElementById("tournamentCreateArea");
const tournamentEditAreaEl = document.getElementById("tournamentEditArea");
const editTournamentNameEl = document.getElementById("editTournamentName");
const editTournamentDateEl = document.getElementById("editTournamentDate");
const editTournamentMatchTypeEl = document.getElementById("editTournamentMatchType");
const editTournamentOpponentCategoryModeEl = document.getElementById("editTournamentOpponentCategoryMode");
const editTournamentDefaultOpponentCategoryEl = document.getElementById("editTournamentDefaultOpponentCategory");
const editTournamentOpponentTeamsEl = document.getElementById("editTournamentOpponentTeams");
const editTournamentParticipantListEl = document.getElementById("editTournamentParticipantList");
const selectAllEditTournamentParticipantsButtonEl = document.getElementById("selectAllEditTournamentParticipantsButton");
const clearEditTournamentParticipantsButtonEl = document.getElementById("clearEditTournamentParticipantsButton");
const updateTournamentButtonEl = document.getElementById("updateTournamentButton");
const deleteTournamentButtonEl = document.getElementById("deleteTournamentButton");
const openTrashPanelButtonEl = document.getElementById("openTrashPanelButton");
const viewerSectionEl = document.getElementById("viewerSection");
const viewerSummaryEl = document.getElementById("viewerSummary");
const exportViewerCsvButtonEl = document.getElementById("exportViewerCsvButton");
const viewerEmptyStateEl = document.getElementById("viewerEmptyState");
const viewerTournamentTypeFilterEl = document.getElementById("viewerTournamentTypeFilter");
const viewerTournamentTypeFilterWrapEl = document.getElementById("viewerTournamentTypeFilterWrap");
const viewerStageFilterEl = document.getElementById("viewerStageFilter");
const viewerOpponentFilterEl = document.getElementById("viewerOpponentFilter");
const viewerOpponentCategoryFilterEl = document.getElementById("viewerOpponentCategoryFilter");
const viewerAdvancedFiltersAccordionButtonEl = document.getElementById("viewerAdvancedFiltersAccordionButton");
const viewerAdvancedFiltersAccordionBodyEl = document.getElementById("viewerAdvancedFiltersAccordionBody");
const viewerAdvancedFiltersAccordionIconEl = document.getElementById("viewerAdvancedFiltersAccordionIcon");
const viewerMatchFiltersAccordionButtonEl = document.getElementById("viewerMatchFiltersAccordionButton");
const viewerMatchFiltersAccordionBodyEl = document.getElementById("viewerMatchFiltersAccordionBody");
const viewerMatchFiltersAccordionIconEl = document.getElementById("viewerMatchFiltersAccordionIcon");
const viewerMatchFiltersEl = document.getElementById("viewerMatchFilters");
const viewerPlayerSelectEl = document.getElementById("viewerPlayerSelect");
const viewerTotalsEl = document.getElementById("viewerTotals");
const viewerTotalsAccordionButtonEl = document.getElementById("viewerTotalsAccordionButton");
const viewerTotalsAccordionBodyEl = document.getElementById("viewerTotalsAccordionBody");
const viewerTotalsAccordionIconEl = document.getElementById("viewerTotalsAccordionIcon");
const viewerRankingsEl = document.getElementById("viewerRankings");
const viewerRankingAccordionButtonEl = document.getElementById("viewerRankingAccordionButton");
const viewerRankingAccordionBodyEl = document.getElementById("viewerRankingAccordionBody");
const viewerRankingAccordionIconEl = document.getElementById("viewerRankingAccordionIcon");
const viewerDetailAccordionButtonEl = document.getElementById("viewerDetailAccordionButton");
const viewerDetailAccordionBodyEl = document.getElementById("viewerDetailAccordionBody");
const viewerDetailAccordionIconEl = document.getElementById("viewerDetailAccordionIcon");
const viewerTableBodyEl = document.getElementById("viewerTableBody");
const viewerDetailMatchSelectEl = document.getElementById("viewerDetailMatchSelect");
const viewerDetailSummaryEl = document.getElementById("viewerDetailSummary");
const viewerDetailTableBodyEl = document.getElementById("viewerDetailTableBody");
const selectAllViewerMatchesButtonEl = document.getElementById("selectAllViewerMatchesButton");
const clearViewerMatchesButtonEl = document.getElementById("clearViewerMatchesButton");
const viewerSortKeyEl = document.getElementById("viewerSortKey");
const viewerSortOrderEl = document.getElementById("viewerSortOrder");
const viewerSortButtonsEls = Array.from(
  document.querySelectorAll(".viewer-main-stats-table .table-sort-button"),
);
const viewerDetailSortButtonsEls = Array.from(
  document.querySelectorAll(".viewer-detail-stats-table .table-sort-button"),
);
const matchSelectEl = document.getElementById("matchSelect");
const matchHelpTextEl = document.getElementById("matchHelpText");
const createMatchButtonEl = document.getElementById("createMatchButton");
const confirmMatchButtonEl = document.getElementById("confirmMatchButton");
const toggleMatchCreateButtonEl = document.getElementById("toggleMatchCreateButton");
const toggleMatchEditButtonEl = document.getElementById("toggleMatchEditButton");
const matchCreateAreaEl = document.getElementById("matchCreateArea");
const matchEditAreaEl = document.getElementById("matchEditArea");
const matchOrderManagementWrapEl = document.getElementById("matchOrderManagementWrap");
const matchOrderAccordionButtonEl = document.getElementById("matchOrderAccordionButton");
const matchOrderAccordionBodyEl = document.getElementById("matchOrderAccordionBody");
const matchOrderAccordionIconEl = document.getElementById("matchOrderAccordionIcon");
const matchOrderManagementListEl = document.getElementById("matchOrderManagementList");
const editOpponentEl = document.getElementById("editOpponent");
const editMatchStageEl = document.getElementById("editMatchStage");
const matchOpponentCategoryEl = document.getElementById("matchOpponentCategory");
const editMatchOpponentCategoryEl = document.getElementById("editMatchOpponentCategory");
const updateMatchButtonEl = document.getElementById("updateMatchButton");
const deleteMatchButtonEl = document.getElementById("deleteMatchButton");
const backToStep1ButtonEl = document.getElementById("backToStep1Button");
const backToStep2ButtonEl = document.getElementById("backToStep2Button");
const step1SectionEl = document.getElementById("step1Section");
const step2SectionEl = document.getElementById("step2Section");
const step2AttendanceSectionEl = document.getElementById("step2AttendanceSection");
const step2LineupSectionEl = document.getElementById("step2LineupSection");
const step3SectionEl = document.getElementById("step3Section");
const lineupPickWrapEl = document.getElementById("lineupPickWrap");
const lineupPlayerCheckboxListEl = document.getElementById("lineupPlayerCheckboxList");
const lineupSelectedCountEl = document.getElementById("lineupSelectedCount");
const lineupValidationMessageEl = document.getElementById("lineupValidationMessage");
const lineupPickActionsEl = document.getElementById("lineupPickActions");
const lineupConfirmPanelEl = document.getElementById("lineupConfirmPanel");
const lineupConfirmNamesEl = document.getElementById("lineupConfirmNames");
const lineupCancelPickButtonEl = document.getElementById("lineupCancelPickButton");
const lineupSubmitPickButtonEl = document.getElementById("lineupSubmitPickButton");
const lineupCancelConfirmButtonEl = document.getElementById("lineupCancelConfirmButton");
const lineupGoRecordsButtonEl = document.getElementById("lineupGoRecordsButton");
const attendancePlayerListEl = document.getElementById("attendancePlayerList");
const attendanceSelectAllPresentButtonEl = document.getElementById("attendanceSelectAllPresentButton");
const attendanceCancelButtonEl = document.getElementById("attendanceCancelButton");
const attendanceConfirmButtonEl = document.getElementById("attendanceConfirmButton");
const startersRosterBodyEl = document.getElementById("startersRosterBody");
const benchRosterBodyEl = document.getElementById("benchRosterBody");
const absentRosterBodyEl = document.getElementById("absentRosterBody");
const startersRosterAccordionButtonEl = document.getElementById("startersRosterAccordionButton");
const startersRosterAccordionBodyEl = document.getElementById("startersRosterAccordionBody");
const startersRosterAccordionIconEl = document.getElementById("startersRosterAccordionIcon");
const benchRosterAccordionButtonEl = document.getElementById("benchRosterAccordionButton");
const benchRosterAccordionBodyEl = document.getElementById("benchRosterAccordionBody");
const benchRosterAccordionIconEl = document.getElementById("benchRosterAccordionIcon");
const absentRosterAccordionButtonEl = document.getElementById("absentRosterAccordionButton");
const absentRosterAccordionBodyEl = document.getElementById("absentRosterAccordionBody");
const absentRosterAccordionIconEl = document.getElementById("absentRosterAccordionIcon");
const onFieldCountWarningEl = document.getElementById("onFieldCountWarning");
const midMatchAddPlayerButtonEl = document.getElementById("midMatchAddPlayerButton");
const editMatchAttendanceButtonEl = document.getElementById("editMatchAttendanceButton");
const lineupIntegrityBannerEl = document.getElementById("lineupIntegrityBanner");
const lineupIntegrityBodyEl = document.getElementById("lineupIntegrityBody");
const lineupIntegrityBackButtonEl = document.getElementById("lineupIntegrityBackButton");
const matchFlowModalEl = document.getElementById("matchFlowModal");
const matchFlowModalTitleEl = document.getElementById("matchFlowModalTitle");
const matchFlowModalBodyEl = document.getElementById("matchFlowModalBody");
const matchFlowModalActionsEl = document.getElementById("matchFlowModalActions");
const matchFlowModalBackdropEl = document.getElementById("matchFlowModalBackdrop");
const checkModeSectionEl = document.getElementById("checkModeSection");
const checkModeSummaryEl = document.getElementById("checkModeSummary");
const checkModeListEl = document.getElementById("checkModeList");
const playerProfileModalEl = document.getElementById("playerProfileModal");
const playerProfileContentEl = document.getElementById("playerProfileContent");
const closePlayerProfileButtonEl = document.getElementById("closePlayerProfileButton");
const exportModalEl = document.getElementById("exportModal");
const closeExportModalButtonEl = document.getElementById("closeExportModalButton");
const exportFilenameInputEl = document.getElementById("exportFilenameInput");
const exportTournamentListEl = document.getElementById("exportTournamentList");
const selectAllExportTournamentsButtonEl = document.getElementById("selectAllExportTournamentsButton");
const exportTournamentAccordionButtonEl = document.getElementById("exportTournamentAccordionButton");
const exportTournamentAccordionBodyEl = document.getElementById("exportTournamentAccordionBody");
const exportTournamentAccordionIconEl = document.getElementById("exportTournamentAccordionIcon");
const exportHelpAccordionButtonEl = document.getElementById("exportHelpAccordionButton");
const exportHelpAccordionBodyEl = document.getElementById("exportHelpAccordionBody");
const exportHelpAccordionIconEl = document.getElementById("exportHelpAccordionIcon");
const exportErrorMessageEl = document.getElementById("exportErrorMessage");
const exportRetryAreaEl = document.getElementById("exportRetryArea");
const exportRetryButtonEl = document.getElementById("exportRetryButton");
const cancelExportButtonEl = document.getElementById("cancelExportButton");
const confirmExportButtonEl = document.getElementById("confirmExportButton");
let lockedBodyScrollY = 0;

const hasFirebaseConfig =
  Boolean(firebaseConfig.apiKey) && Boolean(firebaseConfig.databaseURL);

const app = hasFirebaseConfig ? firebase.initializeApp(firebaseConfig) : null;
const db = app ? firebase.database() : null;

function getSiteSettingsRef() {
  return db ? db.ref(SITE_SETTINGS_REF) : null;
}

function getPlayersRef() {
  return db.ref(DB_PATHS.players);
}

function getPlayerRef(playerId) {
  return db.ref(`${DB_PATHS.players}/${playerId}`);
}

function getTournamentsRef() {
  return db.ref(DB_PATHS.tournaments);
}

function getTournamentRef(tournamentId) {
  return db.ref(`${DB_PATHS.tournaments}/${tournamentId}`);
}

function getMatchesRef(tournamentId) {
  return db.ref(`${DB_PATHS.matches}/${tournamentId}`);
}

function getMatchRef(tournamentId, matchId) {
  return db.ref(`${DB_PATHS.matches}/${tournamentId}/${matchId}`);
}

function getTournamentRecordsRef(tournamentId) {
  return db.ref(`${DB_PATHS.records}/${tournamentId}`);
}

function getMatchRecordsRef(tournamentId, matchId) {
  return db.ref(`${DB_PATHS.records}/${tournamentId}/${matchId}`);
}

function isGuestPlayerId(playerId) {
  return GUEST_PLAYER_IDS.has(String(playerId ?? "").trim());
}

function normalizeOpponentTeamNames(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/[\n,、]+/);
  return Array.from(
    new Set(
      rawItems
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function formatOpponentTeamNames(value) {
  return normalizeOpponentTeamNames(value).join("\n");
}

function toCircledNumber(number) {
  return CIRCLED_NUMBERS[number] || String(number);
}

function getOpponentSeriesNumber(opponentName, teamName) {
  const text = String(opponentName ?? "").trim();
  const base = String(teamName ?? "").trim();
  if (!base || !text.startsWith(base)) return null;
  const suffix = text.slice(base.length).trim();
  const circledIndex = CIRCLED_NUMBERS.indexOf(suffix);
  if (circledIndex > 0) return circledIndex;
  const numeric = Number(suffix);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function getNextOpponentSeriesNumber(teamName) {
  const used = currentMatches
    .map((match) => getOpponentSeriesNumber(match.opponent, teamName))
    .filter((number) => Number.isInteger(number) && number > 0);
  return used.length ? Math.max(...used) + 1 : 1;
}

function formatOpponentSeriesName(teamName, number) {
  return `${teamName}${toCircledNumber(number)}`;
}

function setOpponentInputValue(value) {
  opponentEl.value = value;
  opponentEl.focus();
  opponentEl.setSelectionRange(opponentEl.value.length, opponentEl.value.length);
}

function normalizeTournament(id, value = {}) {
  const rawParticipantIds = Array.isArray(value.participantPlayerIds)
    ? value.participantPlayerIds
    : Array.isArray(value.participants)
      ? value.participants
      : null;
  const participantPlayerIds = rawParticipantIds
    ? Array.from(
        new Set(
          rawParticipantIds
            .map((item) => String(item ?? "").trim())
            .filter((item) => item && !isGuestPlayerId(item)),
        ),
      )
    : null;
  return {
    id,
    name: value.name ?? "名称未設定",
    date: value.date ?? "",
    matchType: value.matchType ?? "大会",
    opponentCategoryMode: value.opponentCategoryMode === "fixed" ? "fixed" : "per_match",
    defaultOpponentCategory: value.defaultOpponentCategory ?? "",
    opponentTeamNames: normalizeOpponentTeamNames(value.opponentTeamNames),
    participantPlayerIds,
    createdAt: value.createdAt ?? 0,
    updatedAt: value.updatedAt ?? value.createdAt ?? 0,
  };
}

function normalizeMatch(id, value = {}) {
  const startingMemberIds = Array.isArray(value.startingMemberIds)
    ? value.startingMemberIds.filter((x) => typeof x === "string" && x)
    : [];
  const substitutions = Array.isArray(value.substitutions)
    ? value.substitutions.filter((s) => s && s.inStudentId && s.outStudentId)
    : [];
  return {
    id,
    date: value.date ?? null,
    opponent: value.opponent ?? "",
    stage: value.stage ?? "予選",
    opponentCategory: value.opponentCategory ?? "",
    displayOrder: Number.isFinite(Number(value.displayOrder)) ? Number(value.displayOrder) : null,
    matchType: value.matchType ?? "その他",
    createdAt: value.createdAt ?? 0,
    updatedAt: value.updatedAt ?? value.createdAt ?? 0,
    startingMemberIds,
    substitutions,
  };
}

function normalizePlayer(id, value = {}, fallbackOrder = Number.MAX_SAFE_INTEGER) {
  const guest = isGuestPlayerId(id);
  return {
    id,
    name: value.name ?? (guest ? "助っ人" : "名称未設定"),
    grade: guest ? "" : value.grade ? String(value.grade) : "",
    role: value.role ? String(value.role) : "",
    handedness: value.handedness ? String(value.handedness) : "",
    memo: value.memo ?? "",
    active: value.active !== false,
    order: Number.isFinite(value.order) ? value.order : fallbackOrder,
    createdAt: value.createdAt ?? null,
  };
}

function getGradeLabel(grade) {
  return GRADE_SYMBOLS[String(grade)] ?? "";
}

function getGradeFullLabel(grade) {
  return {
    1: "1年生",
    2: "2年生",
    3: "3年生",
  }[String(grade)] ?? "未設定";
}

function getRoleLabel(role) {
  return ROLE_LABELS[String(role)] ?? "";
}

function getRoleFullLabel(role) {
  return {
    captain: "キャプテン",
    viceCaptain: "副キャプテン",
  }[String(role)] ?? "なし";
}

function getHandednessLabel(handedness) {
  return {
    right: "右",
    left: "左",
    both: "両",
  }[String(handedness)] ?? "未設定";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getPlayerBadgesHtml(player) {
  const badges = [];
  const gradeLabel = getGradeLabel(player?.grade);
  const roleLabel = getRoleLabel(player?.role);
  if (gradeLabel) {
    badges.push(`<span class="player-badge grade-badge">${gradeLabel}</span>`);
  }
  if (roleLabel) {
    badges.push(`<span class="player-badge role-badge">${roleLabel}</span>`);
  }

  return badges.join("");
}

function getPlayerDisplayHtml(player) {
  return `<span class="player-display"><span class="player-display-name">${escapeHtml(
    player?.name ?? "未登録選手",
  )}</span>${getPlayerBadgesHtml(player)}</span>`;
}

function renderPlayerNameButtonHtml(player) {
  return `<button class="player-name-button" type="button" data-player-id="${escapeHtml(player.id)}">${getPlayerDisplayHtml(
    player,
  )}</button>`;
}

function getGoalMetricLabel(targetItem) {
  return {
    attackSuccess: "アタック成功数",
    catch: "キャッチ数",
    attackRate: "アタック成功率",
    catchRate: "キャッチ率",
    attackContribution: "アタック貢献度",
    catchContribution: "キャッチ貢献度",
    zeroBreak: "ゼロ抜き数",
    return: "内野復帰数",
  }[String(targetItem)] ?? String(targetItem || "未設定");
}

function isGoalRateMetric(targetItem) {
  return (
    targetItem === "attackRate" ||
    targetItem === "catchRate" ||
    targetItem === "attackContribution" ||
    targetItem === "catchContribution"
  );
}

function getProfileGoalStatusView(goalStatus, currentValue, targetValue) {
  if (goalStatus === "achieved") {
    return { className: "is-achieved", text: "目標達成！", key: "achieved" };
  }
  if (goalStatus === "not_achieved") {
    return { className: "is-ongoing", text: "目標未達", key: "ongoing" };
  }
  if (currentValue >= targetValue) {
    return { className: "is-ongoing-achieving", text: "目標達成中", key: "ongoing_achieving" };
  }
  return { className: "is-ongoing", text: "目標未達", key: "ongoing" };
}

function getProfileGoalRangeLabel(goal) {
  if (goal.goalType === "short") {
    const t = currentTournaments.find((x) => x.id === goal.relatedEvent);
    return `大会: ${t?.name || "未設定"}`;
  }
  return `期間: ${goal.startDate || "?"} ～ ${goal.endDate || "?"}`;
}

function getProfileGoalProgressMessage(goal, currentValue, targetValue) {
  const status = getProfileGoalStatusView(goal.status, currentValue, targetValue).key;
  if (status === "achieved") return "この目標は達成確定済みです。";
  if (status === "ongoing_achieving") return "目標値を上回っています。維持を目指しましょう。";
  const diff = Math.max(0, targetValue - currentValue);
  if (isGoalRateMetric(goal.targetItem)) return `目標まであと ${diff.toFixed(1)}%`;
  return `目標まであと ${Math.max(0, Math.ceil(diff))} 回`;
}

async function loadAllRecordsForProfileGoalProgress() {
  const out = {};
  const targetTournaments = currentTournaments || [];
  await Promise.all(
    targetTournaments.map(async (tournament) => {
      try {
        const [matchesSnap, recordsSnap] = await Promise.all([
          getMatchesRef(tournament.id).once("value"),
          getTournamentRecordsRef(tournament.id).once("value"),
        ]);
        out[tournament.id] = {
          tournamentDate: tournament.date || "",
          matches: Object.entries(matchesSnap.val() || {}).map(([id, value]) => ({
            id,
            date: value?.date || "",
          })),
          recordsByMatch: recordsSnap.val() || {},
        };
      } catch (error) {
        out[tournament.id] = { tournamentDate: tournament.date || "", matches: [], recordsByMatch: {} };
      }
    }),
  );
  return out;
}

function calcProfileGoalCurrentValue(goal, recordsMap) {
  const target = Number(goal.targetValue) || 0;
  const isRate = isGoalRateMetric(goal.targetItem);
  const start = String(goal.startDate || "");
  const end = String(goal.endDate || "");
  const inDateRange = (dateText) => {
    if (goal.goalType === "short") return true;
    const d = String(dateText || "");
    if (!d) return !start && !end;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  const tournamentIds =
    goal.goalType === "short" && goal.relatedEvent ? [goal.relatedEvent] : Object.keys(recordsMap || {});
  let accSuccess = 0;
  let accFail = 0;
  let accCatch = 0;
  let accOut = 0;
  let accReturn = 0;
  let accZero = 0;
  let accAtkContrib = 0;
  let accCatchContrib = 0;
  let games = 0;

  tournamentIds.forEach((tid) => {
    const td = recordsMap?.[tid];
    if (!td) return;
    (td.matches || []).forEach((m) => {
      const d = String(m.date || td.tournamentDate || "");
      if (!inDateRange(d)) return;
      const all = td.recordsByMatch?.[m.id] || {};
      const rec = all?.[goal.userId];
      if (!rec || rec.isBench || rec.absent) return;
      const success = Number(rec.attackSuccess) || 0;
      const fail = Number.isFinite(rec.attackFailure) ? Math.max(0, Number(rec.attackFailure) || 0) : Math.max(0, (Number(rec.attack) || 0) - success);
      const catchN = Number(rec.catch) || 0;
      const outN = Number(rec.out) || 0;
      const retN = Number(rec.return) || 0;
      const zeroN = Number(rec.zeroBreak) || 0;
      const teamAtk = Object.values(all).reduce((s, x) => s + (x?.isBench || x?.absent ? 0 : Number(x?.attackSuccess) || 0), 0);
      const teamCatch = Object.values(all).reduce((s, x) => s + (x?.isBench || x?.absent ? 0 : Number(x?.catch) || 0), 0);
      accSuccess += success;
      accFail += fail;
      accCatch += catchN;
      accOut += outN;
      accReturn += retN;
      accZero += zeroN;
      accAtkContrib += teamAtk ? (success / teamAtk) * 100 : 0;
      accCatchContrib += teamCatch ? (catchN / teamCatch) * 100 : 0;
      games += 1;
    });
  });

  const current = {
    attackSuccess: accSuccess,
    catch: accCatch,
    zeroBreak: accZero,
    return: accReturn,
    attackRate: accSuccess + accFail ? (accSuccess / (accSuccess + accFail)) * 100 : 0,
    catchRate: accCatch + accOut ? (accCatch / (accCatch + accOut)) * 100 : 0,
    attackContribution: games ? accAtkContrib / games : 0,
    catchContribution: games ? accCatchContrib / games : 0,
  }[goal.targetItem] || 0;
  return { currentValue: current, targetValue: target, isRate };
}

async function loadProfileGoals(playerId) {
  if (!db) return [];
  try {
    const snap = await db.ref("goals").once("value");
    const data = snap.val() || {};
    const rawGoals = Object.entries(data)
      .map(([id, value]) => ({ id, ...(value || {}) }))
      .filter((goal) => goal.userId === playerId && (goal.targetScope || "player") === "player")
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    const recordsMap = await loadAllRecordsForProfileGoalProgress();
    return rawGoals.map((goal) => {
      const progress = calcProfileGoalCurrentValue(goal, recordsMap);
      return { ...goal, ...progress };
    });
  } catch (error) {
    console.error("Failed to load profile goals:", error);
    return [];
  }
}

function renderProfileGoalsHtml(goals) {
  const achieved = goals.filter((goal) => goal.status === "achieved");
  const active = goals.filter((goal) => goal.status !== "achieved");
  const activeHtml = active.length
    ? `<ol class="profile-goals-list">${active
        .map((goal) => {
          const metric = getGoalMetricLabel(goal.targetItem);
          const status = getProfileGoalStatusView(goal.status, goal.currentValue, goal.targetValue);
          const suffix = goal.isRate ? "%" : "";
          return `<li class="profile-goals-item">
            <div class="profile-goals-item-head">
              <span class="profile-goals-item-title">${escapeHtml(`${metric} ${goal.targetValue}${suffix}`)}</span>
              <span class="profile-goals-item-status ${status.className}">${escapeHtml(status.text)}</span>
            </div>
            <div class="profile-goals-item-meta">${escapeHtml(getProfileGoalRangeLabel(goal))}</div>
            <div class="profile-goals-item-current">現在: ${escapeHtml(goal.isRate ? `${(Number(goal.currentValue) || 0).toFixed(1)}%` : (Number(goal.currentValue) || 0).toFixed(1))}</div>
            <div class="profile-goals-item-message">${escapeHtml(getProfileGoalProgressMessage(goal, Number(goal.currentValue) || 0, Number(goal.targetValue) || 0))}</div>
          </li>`;
        })
        .join("")}</ol>`
    : '<p class="profile-goals-empty">現在進行中の目標はありません。</p>';
  const achievedHtml = achieved.length
    ? `<ol class="profile-goals-list">${achieved
        .map((goal) => {
          const metric = getGoalMetricLabel(goal.targetItem);
          const status = getProfileGoalStatusView(goal.status, goal.currentValue, goal.targetValue);
          const suffix = goal.isRate ? "%" : "";
          return `<li class="profile-goals-item">
            <div class="profile-goals-item-head">
              <span class="profile-goals-item-title">${escapeHtml(`${metric} ${goal.targetValue}${suffix}`)}</span>
              <span class="profile-goals-item-status ${status.className}">${escapeHtml(status.text)}</span>
            </div>
            <div class="profile-goals-item-meta">${escapeHtml(getProfileGoalRangeLabel(goal))}</div>
            <div class="profile-goals-item-current">最終: ${escapeHtml(goal.isRate ? `${(Number(goal.currentValue) || 0).toFixed(1)}%` : (Number(goal.currentValue) || 0).toFixed(1))}</div>
            <div class="profile-goals-item-message">${escapeHtml(getProfileGoalProgressMessage(goal, Number(goal.currentValue) || 0, Number(goal.targetValue) || 0))}</div>
          </li>`;
        })
        .join("")}</ol>`
    : '<p class="profile-goals-empty">達成済みの目標はまだありません。</p>';
  return `
    <div class="profile-goals">
      <section class="profile-goals-group">
        <h4 class="profile-goals-title">目標一覧</h4>
        ${activeHtml}
      </section>
      <section class="profile-goals-group">
        <h4 class="profile-goals-title">目標達成履歴</h4>
        ${achievedHtml}
      </section>
    </div>
  `;
}

async function openPlayerProfile(playerId) {
  const player = players.find((item) => item.id === playerId);
  if (!player) {
    return;
  }

  playerProfileContentEl.innerHTML = `
    <div class="profile-grid">
      <div class="profile-item">
        <span class="profile-item-label">名前</span>
        <div>${getPlayerDisplayHtml(player)}</div>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">学年</span>
        <div>${escapeHtml(getGradeFullLabel(player.grade))}</div>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">役職</span>
        <div>${escapeHtml(getRoleFullLabel(player.role))}</div>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">利き手</span>
        <div>${escapeHtml(getHandednessLabel(player.handedness))}</div>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">メモ</span>
        <div>${escapeHtml(player.memo || "なし")}</div>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">目標</span>
        <div id="playerProfileGoalsBody" class="profile-goals-empty">読み込み中...</div>
      </div>
    </div>
  `;

  playerProfileModalEl.classList.remove("hidden");
  const goalsBodyEl = document.getElementById("playerProfileGoalsBody");
  if (!goalsBodyEl) return;
  const goals = await loadProfileGoals(player.id);
  goalsBodyEl.outerHTML = renderProfileGoalsHtml(goals);
}

function closePlayerProfile() {
  playerProfileModalEl.classList.add("hidden");
}

function formatPlayerLabel(player) {
  const gradeLabel = getGradeLabel(player?.grade);
  const roleLabel = getRoleLabel(player?.role);
  const suffix = [gradeLabel, roleLabel].filter(Boolean).join(" ");
  return suffix ? `${player.name} ${suffix}` : player.name;
}

function resetViewerFilters() {
  state.viewerSelectedMatchIds = [];
  state.viewerSelectedPlayerId = "all";
  state.viewerTournamentTypeFilter = "all";
  state.viewerStageFilter = "all";
  state.viewerOpponentFilter = "all";
  state.viewerOpponentCategoryFilter = "all";
}

function isStaff() {
  return state.role === "staff";
}

function toggleMetricsAccordion() {
  if (!metricsAccordionBodyEl || !metricsAccordionIconEl) return;
  toggleAccordionAnimated(metricsAccordionBodyEl, metricsAccordionIconEl);
}

function openEditLoginModal() {
  if (!editLoginModalEl) {
    staffPasswordAreaEl.classList.remove("hidden");
    loginPasswordEl.focus();
    return;
  }
  editLoginErrorEl.textContent = "";
  editLoginPasswordEl.value = "";
  editLoginModalEl.classList.remove("hidden");
  editLoginPasswordEl.focus();
}

function closeEditLoginModal() {
  editLoginModalEl?.classList.add("hidden");
  if (editLoginErrorEl) editLoginErrorEl.textContent = "";
  if (editLoginPasswordEl) editLoginPasswordEl.value = "";
}

function toggleLoginInfoAccordion() {
  toggleAccordionAnimated(loginInfoAccordionBodyEl, loginInfoAccordionIconEl);
}

function renderCheckMode() {
  if (!isStaff()) {
    checkModeSectionEl.classList.add("hidden");
    return;
  }

  checkModeSectionEl.classList.remove("hidden");
  const warnings = [];

  if (!state.selectedTournamentId) {
    warnings.push("大会が未選択です。まず大会を選択してください。");
  }
  if (state.selectedTournamentId && !currentMatches.length) {
    warnings.push("この大会には試合がありません。試合を追加してください。");
  }
  if (!state.selectedMatchId) {
    warnings.push("試合が未選択です。試合を確定すると記録チェックが有効になります。");
  }

  const tournamentEligiblePlayers = getTournamentEligiblePlayers();
  if (!tournamentEligiblePlayers.length) {
    warnings.push("大会参加メンバー（または助っ人）がいません。大会編集で参加メンバーを設定してください。");
  }

  if (state.selectedTournamentId && state.selectedMatchId) {
    warnings.push(...validateCurrentRecords());
    if (state.currentStep === 3) {
      const onField = getActiveOnFieldCount();
      if (onField < LINEUP_STARTER_COUNT) {
        warnings.push(
          `出場中の選手が${LINEUP_STARTER_COUNT}人未満です（現在${onField}人）。ベンチの「出場」で交代なしに戻すか、スタメンを見直してください。`,
        );
      }
    }
    const unenteredPlayers = getMatchPresentPlayers()
      .filter((player) => !isGuestPlayerId(player.id))
      .filter((player) => {
        const record = getPlayerStats(player.id);
        if (isAbsentRecord(record)) {
          return false;
        }
        if (record.isBench && !record.retiredBySubstitution) {
          return false;
        }
        const total = stats.reduce((sum, stat) => sum + (record[stat.key] || 0), 0);
        return total === 0;
      })
      .map((player) => player.name);

    if (unenteredPlayers.length) {
      warnings.push(`未入力候補: ${unenteredPlayers.join(" / ")}`);
    }
  }

  if (state.selectedTournamentId && currentMatches.length) {
    const recordsByMatch = state.viewerTournamentRecords || {};
    const tournamentHasAnyRecord = currentMatches.some((match) => {
      const allRecords = recordsByMatch[match.id] || {};
      return Object.keys(allRecords).length > 0;
    });
    if (tournamentHasAnyRecord) {
      const missingPlayers = tournamentEligiblePlayers
        .filter((player) => !isGuestPlayerId(player.id))
        .filter((player) =>
          !currentMatches.some((match) => {
            const allRecords = recordsByMatch[match.id] || {};
            if (!Object.prototype.hasOwnProperty.call(allRecords, player.id)) {
              return false;
            }
            const record = allRecords[player.id] ?? {};
            if (isAbsentRecord(record)) {
              return false;
            }
            return true;
          }),
        )
        .map((player) => player.name);
      if (missingPlayers.length) {
        const preview = missingPlayers.slice(0, 5).join(" / ");
        const more = missingPlayers.length > 5 ? ` ほか${missingPlayers.length - 5}名` : "";
        warnings.push(
          `記録漏れ候補: この大会で記録が1件もない選手がいます（${preview}${more}）。不参加なら問題ありません。`,
        );
      }
    }
  }

  if (!warnings.length) {
    checkModeSummaryEl.textContent = "現在の入力状態は問題ありません。";
    checkModeListEl.innerHTML = '<li class="check-item ok">チェックOK: このまま保存・運用できます。</li>';
    return;
  }

  checkModeSummaryEl.textContent = `${warnings.length}件の確認ポイントがあります`;
  checkModeListEl.innerHTML = warnings.map((message) => `<li class="check-item warn">${escapeHtml(message)}</li>`).join("");
}

function applyPermission() {
  const canEdit = isStaff();
  const selectedTournamentValue = tournamentSelectEl?.value || state.selectedTournamentId || "";
  const selectedMatchValue = matchSelectEl?.value || state.selectedMatchId || "";
  opponentEl.disabled = !canEdit;
  matchStageEl.disabled = !canEdit;
  if (matchOrderManagementWrapEl) matchOrderManagementWrapEl.classList.toggle("hidden", !canEdit);
  newTournamentNameEl.disabled = !canEdit;
  tournamentDateEl.disabled = !canEdit;
  tournamentMatchTypeEl.disabled = !canEdit;
  tournamentOpponentCategoryModeEl.disabled = !canEdit;
  tournamentDefaultOpponentCategoryEl.disabled = !canEdit || tournamentOpponentCategoryModeEl.value !== "fixed";
  if (newTournamentOpponentTeamsEl) newTournamentOpponentTeamsEl.disabled = !canEdit;
  if (editTournamentOpponentTeamsEl) editTournamentOpponentTeamsEl.disabled = !canEdit || !state.selectedTournamentId;
  selectAllTournamentParticipantsButtonEl.disabled = !canEdit;
  clearTournamentParticipantsButtonEl.disabled = !canEdit;
  createTournamentButtonEl.disabled = !canEdit;
  confirmTournamentButtonEl.disabled = !selectedTournamentValue;
  confirmTournamentButtonEl.classList.toggle("hidden", !canEdit);
  updateTournamentButtonEl.disabled = !canEdit || !state.selectedTournamentId;
  editTournamentOpponentCategoryModeEl.disabled = !canEdit || !state.selectedTournamentId;
  editTournamentDefaultOpponentCategoryEl.disabled =
    !canEdit || !state.selectedTournamentId || editTournamentOpponentCategoryModeEl.value !== "fixed";
  selectAllEditTournamentParticipantsButtonEl.disabled = !canEdit || !state.selectedTournamentId;
  clearEditTournamentParticipantsButtonEl.disabled = !canEdit || !state.selectedTournamentId;
  deleteTournamentButtonEl.disabled = !canEdit || !state.selectedTournamentId;
  createMatchButtonEl.disabled = !canEdit;
  matchOpponentCategoryEl.disabled =
    !canEdit || (getSelectedTournament()?.opponentCategoryMode ?? "per_match") === "fixed";
  confirmMatchButtonEl.disabled = !selectedMatchValue;
  updateMatchButtonEl.disabled = !canEdit || !state.selectedMatchId;
  editMatchOpponentCategoryEl.disabled =
    !canEdit || !state.selectedMatchId || (getSelectedTournament()?.opponentCategoryMode ?? "per_match") === "fixed";
  deleteMatchButtonEl.disabled = !canEdit || !state.selectedMatchId;
  toggleTournamentCreateButtonEl.classList.toggle("hidden", !canEdit);
  toggleTournamentEditButtonEl.classList.toggle("hidden", !canEdit);
  toggleMatchCreateButtonEl.classList.toggle("hidden", !canEdit);
  toggleMatchEditButtonEl.classList.toggle("hidden", !canEdit);
  togglePlayerManagementButtonEl.classList.toggle("hidden", !canEdit);
  openTrashPanelButtonEl?.classList.toggle("hidden", !canEdit);
  createPlayerButtonEl.disabled = !canEdit;
  if (midMatchAddPlayerButtonEl) {
    midMatchAddPlayerButtonEl.disabled = !canEdit;
  }
  if (editMatchAttendanceButtonEl) {
    editMatchAttendanceButtonEl.disabled = !canEdit;
  }
  if (attendanceSelectAllPresentButtonEl) {
    attendanceSelectAllPresentButtonEl.disabled = !canEdit;
  }
  if (attendanceCancelButtonEl) {
    attendanceCancelButtonEl.disabled = !canEdit;
  }
  if (attendanceConfirmButtonEl) {
    attendanceConfirmButtonEl.disabled = !canEdit;
  }
  togglePlayerActiveButtonEl?.classList.toggle("hidden", !canEdit);
  playerManagementSectionEl.classList.toggle("hidden", !canEdit);
  loginInfoCardEl?.classList.toggle("hidden", !canEdit);
  loginCardEl?.classList.add("hidden");
  document.body.classList.toggle("is-staff-mode", canEdit);
  viewerSectionEl.classList.toggle("hidden", canEdit || !state.selectedTournamentId);
  modeTextEl.textContent = canEdit
    ? "現在: EDIT / 編集モード"
    : "現在: VIEW / 閲覧モード";
  if (staffTutorialOfferRowEl) {
    staffTutorialOfferRowEl.classList.toggle("hidden", !canEdit || !db);
  }
  renderCheckMode();
}

function toggleCreateArea(areaEl, buttonEl) {
  const willShow = areaEl.classList.contains("hidden");
  areaEl.classList.toggle("hidden", !willShow);
  buttonEl.textContent = willShow ? "閉じる" : `+ ${buttonEl.dataset.defaultLabel}`;
}

function toggleEditArea(areaEl, buttonEl) {
  const willShow = areaEl.classList.contains("hidden");
  areaEl.classList.toggle("hidden", !willShow);
  buttonEl.textContent = willShow ? "閉じる" : buttonEl.dataset.defaultLabel;
}

function showStep(step) {
  if (!isStaff()) {
    step1SectionEl.classList.remove("hidden");
    step2SectionEl.classList.add("hidden");
    if (step2AttendanceSectionEl) step2AttendanceSectionEl.classList.add("hidden");
    if (step2LineupSectionEl) step2LineupSectionEl.classList.add("hidden");
    step3SectionEl.classList.add("hidden");
    return;
  }
  state.currentStep = step;
  step1SectionEl.classList.toggle("hidden", step !== 1);
  step2SectionEl.classList.toggle("hidden", step !== 2);
  if (step2AttendanceSectionEl) {
    step2AttendanceSectionEl.classList.toggle("hidden", step !== 2.25);
  }
  if (step2LineupSectionEl) {
    step2LineupSectionEl.classList.toggle("hidden", step !== 2.5);
  }
  step3SectionEl.classList.toggle("hidden", step !== 3);
}

function syncStepByState() {
  if (!isStaff()) {
    showStep(1);
    return;
  }
  if (state.currentStep === 1) {
    showStep(1);
    return;
  }
  if (state.currentStep === 2.25) {
    if (!state.selectedTournamentId || !state.selectedMatchId) {
      state.currentStep = 2;
      showStep(2);
      return;
    }
    showStep(2.25);
    return;
  }
  if (state.currentStep === 2.5) {
    if (!state.selectedTournamentId || !state.selectedMatchId) {
      state.currentStep = 2;
      showStep(2);
      return;
    }
    showStep(2.5);
    return;
  }
  if (state.currentStep === 2) {
    if (!state.selectedTournamentId) {
      showStep(1);
      return;
    }
    showStep(2);
    return;
  }
  if (!state.selectedMatchId) {
    showStep(2);
    return;
  }
  showStep(3);
}

function parseHomeDeepLinkFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    const tid = p.get("tournament") || p.get("tid");
    const mid = p.get("match") || p.get("mid");
    const openMatchDetail = p.get("openMatchDetail") === "1";
    if (tid && mid) return { tournamentId: tid, matchId: mid, openMatchDetail };
  } catch {}
  return null;
}

async function applyHomeDeepLinkParams(tournamentId, matchId, options = {}) {
  if (!db || !tournamentId || !matchId) return;
  const openMatchDetail = options?.openMatchDetail === true;
  if (!currentTournaments.some((t) => t.id === tournamentId)) return;

  state.selectedTournamentId = tournamentId;
  tournamentSelectEl.value = tournamentId;
  const selectedTournament = currentTournaments.find((t) => t.id === tournamentId);
  fillTournamentMetaInputs(selectedTournament);
  fillTournamentEditInputs(selectedTournament);

  const matches = await loadMatchesByTournament(tournamentId);
  renderMatchOptions(matches);
  const matchObj = matches.find((m) => m.id === matchId);
  if (!matchObj) return;

  if (isStaff()) {
    state.selectedMatchId = matchId;
    matchSelectEl.value = matchId;
    fillMatchMetaInputs(matchObj);
    fillMatchEditInputs(matchObj);
    await loadRecordsForMatch();
    renderRecordSummary();
    syncStepByState();
  } else {
    state.selectedMatchId = "";
    matchSelectEl.value = "";
    fillMatchMetaInputs(null);
    fillMatchEditInputs(null);
    state.records = {};
    resetViewerFilters();
    state.viewerSelectedMatchIds = [matchId];
    state.viewerDetailMatchId = matchId;
    await loadViewerRecordsForTournament();
    if (openMatchDetail && viewerDetailAccordionBodyEl.classList.contains("hidden")) {
      toggleViewerDetailAccordion();
    }
    if (openMatchDetail) {
      const detailSection = document.getElementById("viewerDetailAccordionButton");
      detailSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderViewerContent();
  }

  renderStats();
  applyPermission();
  try {
    const path = window.location.pathname.split("/").pop() || "index.html";
    window.history.replaceState({}, "", path);
  } catch {}
}

/** 通知パネル等から index に ?tournament=&match= で入ったとき、該当試合を開く */
async function applyHomeDeepLinkFromUrlParams() {
  const params = parseHomeDeepLinkFromUrl();
  if (!params) return;
  const { tournamentId, matchId, openMatchDetail } = params;
  await applyHomeDeepLinkParams(tournamentId, matchId, { openMatchDetail });
}

window.focusMatchFromNotice = async (tournamentId, matchId, options = {}) => {
  await applyHomeDeepLinkParams(tournamentId, matchId, {
    openMatchDetail: options?.openDetail === true || options?.openMatchDetail === true,
  });
};

function login(role, password) {
  if (role === "staff") {
    const expected = PASSWORDS.staff;
    if (password !== expected) {
      loginErrorEl.textContent = "パスワードが違います。";
      return;
    }
  }

  state.role = role;
  loginErrorEl.textContent = "";
  if (editLoginErrorEl) editLoginErrorEl.textContent = "";
  loginPasswordEl.value = "";
  staffPasswordAreaEl.classList.add("hidden");
  loginCardEl.classList.add("hidden");
  if (role === "staff") closeEditLoginModal();
  appAreaEl.classList.remove("hidden");
  applyPermission();
  renderTabs();
  renderStats();
  void (async () => {
    await initializeData();
    await applyHomeDeepLinkFromUrlParams();
  })();
}

function logout() {
  state.role = "player";
  state.selectedTournamentId = "";
  state.selectedMatchId = "";
  resetViewerFilters();
  state.viewerTournamentRecords = {};
  state.viewerSortKey = "name";
  state.viewerSortOrder = "asc";
  state.viewerDetailSortKey = "name";
  state.viewerDetailSortOrder = "asc";
  state.currentStep = 1;
  if (state.autoSaveTimerId) {
    window.clearTimeout(state.autoSaveTimerId);
    state.autoSaveTimerId = null;
  }
  clearAutoSaveCountdown();
  resetMatchSaveMeta(null);
  loginPasswordEl.value = "";
  loginErrorEl.textContent = "";
  setValidationMessage("");
  staffPasswordAreaEl.classList.add("hidden");
  loginCardEl.classList.add("hidden");
  closeEditLoginModal();
  appAreaEl.classList.remove("hidden");
  setSaveState("未保存", "まだ保存されていません", "");
  showStep(1);
  applyPermission();
  void initializeData();
}

playerLoginButtonEl.addEventListener("click", () => {
  login("player", "");
});

staffModeButtonEl.addEventListener("click", () => {
  loginErrorEl.textContent = "";
  staffPasswordAreaEl.classList.remove("hidden");
  loginPasswordEl.focus();
});

window.addEventListener("sakura:open-edit-login", openEditLoginModal);

editLoginBackdropEl?.addEventListener("click", closeEditLoginModal);

editLoginCloseButtonEl?.addEventListener("click", closeEditLoginModal);

editLoginSubmitButtonEl?.addEventListener("click", () => {
  if (editLoginPasswordEl.value !== PASSWORDS.staff) {
    editLoginErrorEl.textContent = "パスワードが違います。";
    return;
  }
  login("staff", editLoginPasswordEl.value);
});

editLoginPasswordEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    editLoginSubmitButtonEl?.click();
  } else if (event.key === "Escape") {
    closeEditLoginModal();
  }
});

staffLoginButtonEl.addEventListener("click", () => {
  login("staff", loginPasswordEl.value);
});

loginPasswordEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login("staff", loginPasswordEl.value);
  }
});

logoutButtonEl.addEventListener("click", () => {
  logout();
});

function getCurrentPlayer() {
  return players.find((p) => p.id === state.selectedPlayerId) ?? players[0];
}

function getPlayerStats(playerId) {
  return state.records[playerId] || {};
}

function getAttackFailureFromRecord(record = {}) {
  if (Number.isFinite(record.attackFailure)) {
    return Math.max(0, Number(record.attackFailure) || 0);
  }
  const attack = Math.max(0, Number(record.attack) || 0);
  const attackSuccess = Math.max(0, Number(record.attackSuccess) || 0);
  return Math.max(0, attack - attackSuccess);
}

function isBenched(playerId) {
  return Boolean(getPlayerStats(playerId).isBench);
}

/** 試合中の控え（記録入力なし） */
function isMatchBenchReserve(playerId) {
  const r = getPlayerStats(playerId);
  return Boolean(r.isBench) && !r.retiredBySubstitution;
}

/** 途中交代で退場し、これまでの記録のみ保持する選手 */
function isSubstitutedOut(playerId) {
  const r = getPlayerStats(playerId);
  return Boolean(r.isBench) && Boolean(r.retiredBySubstitution);
}

/** この試合に欠席（会場にいない） */
function isAbsent(playerId) {
  return Boolean(getPlayerStats(playerId).absent);
}

function isAbsentRecord(record = {}) {
  return Boolean(record?.absent);
}

/** 参加状況を設定する対象（助っ人除く大会参加メンバー） */
function getTournamentAttendancePlayers(tournament = getSelectedTournament()) {
  return getTournamentEligiblePlayers(tournament).filter((player) => !isGuestPlayerId(player.id));
}

/** この試合に参加している選手（欠席を除く） */
function getMatchPresentPlayers(tournament = getSelectedTournament()) {
  return getTournamentEligiblePlayers(tournament).filter((player) => !isAbsent(player.id));
}

function getParticipantSelectablePlayers() {
  return players.filter((player) => player.active !== false && !isGuestPlayerId(player.id));
}

function getTournamentParticipantIds(tournament = getSelectedTournament()) {
  const selectableIds = getParticipantSelectablePlayers().map((player) => player.id);
  const selectableSet = new Set(selectableIds);
  if (!tournament) {
    return selectableIds;
  }
  if (!Array.isArray(tournament.participantPlayerIds)) {
    return selectableIds;
  }
  return Array.from(
    new Set(
      tournament.participantPlayerIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id && selectableSet.has(id)),
    ),
  );
}

function getTournamentEligiblePlayers(tournament = getSelectedTournament()) {
  const participantIdSet = new Set(getTournamentParticipantIds(tournament));
  return players.filter((player) => {
    if (player.active === false) {
      return false;
    }
    if (isGuestPlayerId(player.id)) {
      return state.showGuestPlayers;
    }
    return participantIdSet.has(player.id);
  });
}

/** 記録入力可能な「出場中」人数（isBench でない現役） */
function getActiveOnFieldCount() {
  return getMatchPresentPlayers().filter((player) => !isBenched(player.id)).length;
}

/** 統計キーに1本以上数値が入っているか（ベンチ誤操作時の保持判定など） */
function recordHasAnyStattedPlays(record = {}) {
  return stats.some((s) => (record[s.key] || 0) > 0);
}

function getVisiblePlayers() {
  const eligiblePlayers = getMatchPresentPlayers();
  if (!state.showActiveOnly) {
    return eligiblePlayers;
  }
  return eligiblePlayers.filter((player) => !isMatchBenchReserve(player.id));
}

function getAllPlayersTotalPlays() {
  return getMatchPresentPlayers().reduce((sum, player) => {
    const playerStats = getPlayerStats(player.id);
    return sum + stats.reduce((acc, stat) => acc + (playerStats[stat.key] || 0), 0);
  }, 0);
}

function renderRecordSummary() {
  const eligiblePlayers = getMatchPresentPlayers();
  const benchPlayers = eligiblePlayers.filter((player) => isMatchBenchReserve(player.id));
  const fieldCount = eligiblePlayers.filter((player) => !isBenched(player.id)).length;
  activePlayerCountEl.textContent = String(fieldCount);
  benchPlayerCountEl.textContent = String(benchPlayers.length);
  allPlayersTotalPlaysEl.textContent = String(getAllPlayersTotalPlays());

  const tournament = getSelectedTournament();
  const match = currentMatches.find((item) => item.id === state.selectedMatchId);
  const parts = [
    tournament?.name,
    tournament?.date,
    tournament?.matchType,
    match?.stage,
    match?.opponent,
  ].filter(Boolean);
  matchSummaryEl.textContent = parts.join(" / ");
}

function renderPlayerManagementList() {
  playerManagementListEl.innerHTML = "";
  if (!players.length) {
    const empty = document.createElement("p");
    empty.className = "player-mgmt-empty";
    empty.textContent = "選手が登録されていません。";
    playerManagementListEl.appendChild(empty);
    return;
  }

  const wrapMgmtField = (labelText, control) => {
    const lb = document.createElement("label");
    lb.className = "player-mgmt-field";
    const lab = document.createElement("span");
    lab.className = "player-mgmt-field-label";
    lab.textContent = labelText;
    lb.append(lab, control);
    return lb;
  };

  players.forEach((player, index) => {
    const row = document.createElement("article");
    row.className = "player-list-item player-mgmt-card";

    const head = document.createElement("header");
    head.className = "player-mgmt-head";
    const createdAt = player.createdAt
      ? new Date(player.createdAt).toLocaleString("ja-JP")
      : "日時不明";
    const gradeText = getGradeLabel(player.grade) || "学年未設定";
    const roleText = getRoleLabel(player.role) || "役割なし";
    const handednessText = getHandednessLabel(player.handedness);
    head.innerHTML = `
      <div class="player-mgmt-title">${getPlayerDisplayHtml(player)}</div>
      <div class="player-mgmt-chips" aria-label="概要">
        <span class="player-mgmt-chip">${escapeHtml(gradeText)}</span>
        <span class="player-mgmt-chip">${escapeHtml(roleText)}</span>
        <span class="player-mgmt-chip">${escapeHtml(handednessText)}</span>
      </div>
      <p class="player-mgmt-created">登録 ${escapeHtml(createdAt)}</p>
    `;

    row.appendChild(head);

    if (isStaff()) {
      const editFields = document.createElement("div");
      editFields.className = "player-edit-fields player-mgmt-fields";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = player.name;
      nameInput.placeholder = "選手名";
      nameInput.autocomplete = "off";

      const gradeSelect = document.createElement("select");
      gradeSelect.innerHTML = `
        <option value="">学年を選択</option>
        <option value="1">1年 / ①</option>
        <option value="2">2年 / ②</option>
        <option value="3">3年 / ③</option>
      `;
      gradeSelect.value = player.grade || "";
      if (isGuestPlayerId(player.id)) {
        gradeSelect.value = "";
        gradeSelect.disabled = true;
      }

      const roleSelect = document.createElement("select");
      roleSelect.innerHTML = `
        <option value="">役割なし</option>
        <option value="captain">キャプテン / C</option>
        <option value="viceCaptain">副キャプテン / VC</option>
      `;
      roleSelect.value = player.role || "";

      const handednessSelect = document.createElement("select");
      handednessSelect.innerHTML = `
        <option value="">利き手未設定</option>
        <option value="right">右</option>
        <option value="left">左</option>
        <option value="both">両</option>
      `;
      handednessSelect.value = player.handedness || "";

      const memoInput = document.createElement("input");
      memoInput.type = "text";
      memoInput.value = player.memo || "";
      memoInput.placeholder = "メモ";

      editFields.append(
        wrapMgmtField("名前", nameInput),
        wrapMgmtField("学年", gradeSelect),
        wrapMgmtField("役割", roleSelect),
        wrapMgmtField("利き手", handednessSelect),
        wrapMgmtField("メモ", memoInput),
      );
      row.appendChild(editFields);

      const toolbar = document.createElement("div");
      toolbar.className = "player-list-actions player-mgmt-toolbar";

      const orderBlock = document.createElement("div");
      orderBlock.className = "player-mgmt-order-block";
      const orderLabel = document.createElement("span");
      orderLabel.className = "player-mgmt-field-label";
      orderLabel.textContent = "表示順";
      const orderRow = document.createElement("div");
      orderRow.className = "player-mgmt-order-row";
      const orderInput = document.createElement("input");
      orderInput.type = "number";
      orderInput.className = "player-order-input player-mgmt-order-input";
      orderInput.min = "1";
      orderInput.max = String(players.length);
      orderInput.value = String(index + 1);
      orderInput.title = "1が先頭。変更したら「順を適用」を押してください。";
      const orderApplyButton = document.createElement("button");
      orderApplyButton.type = "button";
      orderApplyButton.className = "sub-btn player-mgmt-apply-order";
      orderApplyButton.textContent = "順を適用";
      orderApplyButton.addEventListener("click", () => {
        void applyPlayerDisplayOrder(player.id, orderInput.value);
      });
      orderRow.append(orderInput, orderApplyButton);
      const orderHint = document.createElement("p");
      orderHint.className = "player-mgmt-order-hint";
      orderHint.textContent = "1が先頭";
      orderBlock.append(orderLabel, orderRow, orderHint);

      const moveGroup = document.createElement("div");
      moveGroup.className = "player-mgmt-move-group";
      const moveLabel = document.createElement("span");
      moveLabel.className = "player-mgmt-field-label";
      moveLabel.textContent = "移動";
      const moveRow = document.createElement("div");
      moveRow.className = "player-mgmt-move-row";
      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.className = "sub-btn player-mgmt-move-btn";
      upButton.textContent = "↑";
      upButton.disabled = index === 0;
      upButton.title = "上へ";
      upButton.addEventListener("click", () => {
        void movePlayerOrder(player.id, -1);
      });
      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.className = "sub-btn player-mgmt-move-btn";
      downButton.textContent = "↓";
      downButton.disabled = index === players.length - 1;
      downButton.title = "下へ";
      downButton.addEventListener("click", () => {
        void movePlayerOrder(player.id, 1);
      });
      moveRow.append(upButton, downButton);
      moveGroup.append(moveLabel, moveRow);

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "primary-btn player-mgmt-save-btn";
      saveButton.textContent = "更新";
      saveButton.addEventListener("click", () => {
        void updatePlayerDetails(
          player.id,
          nameInput.value,
          gradeSelect.value,
          roleSelect.value,
          handednessSelect.value,
          memoInput.value,
        );
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "sub-btn danger-btn player-mgmt-delete-btn";
      deleteButton.textContent = "削除";
      if (isGuestPlayerId(player.id)) {
        deleteButton.disabled = true;
        deleteButton.title = "助っ人は削除できません";
      }
      deleteButton.addEventListener("click", () => {
        void deletePlayer(player.id, player.name);
      });

      const primaryActions = document.createElement("div");
      primaryActions.className = "player-mgmt-primary-actions";
      primaryActions.append(saveButton, deleteButton);

      toolbar.append(orderBlock, moveGroup, primaryActions);
      row.appendChild(toolbar);
    }

    playerManagementListEl.appendChild(row);
  });
}

function togglePlayerManagementAccordion() {
  toggleAccordionAnimated(playerManagementAccordionBodyEl, playerManagementAccordionIconEl);
}

function toggleMatchOrderAccordion() {
  toggleAccordionAnimated(matchOrderAccordionBodyEl, matchOrderAccordionIconEl);
}

function renderMatchOrderManagementList() {
  if (!matchOrderManagementListEl) return;
  matchOrderManagementListEl.innerHTML = "";
  if (!currentMatches.length) {
    matchOrderManagementListEl.innerHTML = '<p class="login-description no-margin">試合がありません。</p>';
    return;
  }
  currentMatches.forEach((match, idx) => {
    const row = document.createElement("div");
    row.className = "match-order-item";
    const currentOrder = Number.isFinite(Number(match.displayOrder)) ? Number(match.displayOrder) : idx + 1;
    row.innerHTML = `
      <div class="match-order-item-head">${escapeHtml(getMatchLabel(match))}</div>
      <div class="match-order-item-row">
        <input class="match-order-input" type="number" min="1" step="1" value="${currentOrder}" />
        <button type="button" class="sub-btn">順を適用</button>
        <button type="button" class="sub-btn player-mgmt-move-btn">↑</button>
        <button type="button" class="sub-btn player-mgmt-move-btn">↓</button>
      </div>
    `;
    const input = row.querySelector("input");
    const [applyBtn, upBtn, downBtn] = row.querySelectorAll("button");
    applyBtn?.addEventListener("click", () => {
      void applyMatchDisplayOrder(match.id, input?.value || "");
    });
    upBtn?.addEventListener("click", () => {
      void moveMatchOrder(match.id, -1);
    });
    downBtn?.addEventListener("click", () => {
      void moveMatchOrder(match.id, 1);
    });
    matchOrderManagementListEl.appendChild(row);
  });
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getViewerActiveMatchIds() {
  return state.viewerSelectedMatchIds;
}

function getViewerSelectedPlayerId() {
  return state.viewerSelectedPlayerId;
}

function getViewerFilteredMatches() {
  return currentMatches.filter((match) => {
    const tournamentType = match.tournamentMatchType ?? getSelectedTournament()?.matchType ?? "大会";
    const tournamentTypeOk =
      state.viewerTournamentTypeFilter === "all" ||
      (state.viewerTournamentTypeFilter === "tournament" && tournamentType === "大会") ||
      (state.viewerTournamentTypeFilter === "practice" && tournamentType === "練習試合");
    const stageOk = state.viewerStageFilter === "all" || (match.stage ?? "") === state.viewerStageFilter;
    const opponentOk =
      state.viewerOpponentFilter === "all" || (match.opponent ?? "") === state.viewerOpponentFilter;
    const categoryValue = match.opponentCategory || "未設定";
    const categoryOk =
      state.viewerOpponentCategoryFilter === "all" || categoryValue === state.viewerOpponentCategoryFilter;
    return tournamentTypeOk && stageOk && opponentOk && categoryOk;
  });
}

function getMatchLabel(match) {
  const tournament = getSelectedTournament();
  const tournamentName = match.tournamentName || tournament?.name || "大会名未設定";
  const tournamentDate = match.tournamentDate || tournament?.date || "";
  const tournamentLabel = tournamentDate ? `${tournamentName}（${tournamentDate}）` : tournamentName;
  const orderLabel = Number.isFinite(Number(match.displayOrder)) ? `第${Number(match.displayOrder)}試合 / ` : "";
  return `${orderLabel}${tournamentLabel} / ${match.stage || "区分未設定"} / ${match.opponent || "対戦相手未設定"}`;
}

function renderViewerMatchFilters() {
  viewerMatchFiltersEl.innerHTML = "";
  const filteredMatches = getViewerFilteredMatches();
  if (!filteredMatches.length) {
    viewerMatchFiltersEl.innerHTML = '<p class="login-description no-margin">試合がありません。</p>';
    return;
  }

  const appendMatchFilterChip = (match) => {
    const label = document.createElement("label");
    label.className = "filter-chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = getViewerActiveMatchIds().includes(match.id);
    input.addEventListener("change", () => {
      const selected = new Set(getViewerActiveMatchIds());
      if (input.checked) {
        selected.add(match.id);
      } else {
        selected.delete(match.id);
      }
      state.viewerSelectedMatchIds = Array.from(selected);
      renderViewerMatchFilters();
      renderViewerContent();
    });

    const text = document.createElement("span");
    text.textContent = getMatchLabel(match);

    label.append(input, text);
    viewerMatchFiltersEl.appendChild(label);
  };

  if (state.selectedTournamentId !== TOURNAMENT_SELECT_ALL) {
    filteredMatches.forEach((match) => appendMatchFilterChip(match));
    return;
  }

  const groupedMatches = new Map();
  filteredMatches.forEach((match) => {
    const key = match.tournamentId || "__unknown_tournament__";
    const group = groupedMatches.get(key) ?? [];
    group.push(match);
    groupedMatches.set(key, group);
  });

  let hasAnyGroup = false;
  currentTournaments.forEach((tournament) => {
    const matches = groupedMatches.get(tournament.id) ?? [];
    if (!matches.length) return;
    hasAnyGroup = true;
    const heading = document.createElement("p");
    heading.className = "helper-message no-margin";
    heading.style.gridColumn = "1 / -1";
    heading.style.marginTop = "6px";
    heading.style.fontWeight = "700";
    heading.textContent = `【${tournament.name}】`;
    viewerMatchFiltersEl.appendChild(heading);
    matches.forEach((match) => appendMatchFilterChip(match));
  });

  if (!hasAnyGroup) {
    filteredMatches.forEach((match) => appendMatchFilterChip(match));
  }
}

function setTournamentParticipantSelection(mode, target) {
  const ids = getParticipantSelectablePlayers().map((player) => player.id);
  if (target === "create") {
    state.newTournamentParticipantIds = mode === "all" ? ids : [];
  } else if (target === "edit") {
    state.editTournamentParticipantIds = mode === "all" ? ids : [];
  }
  renderTournamentParticipantLists();
}

function renderViewerPlayerSelect() {
  viewerPlayerSelectEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "大会参加者全員";
  viewerPlayerSelectEl.appendChild(allOption);

  getTournamentEligiblePlayers()
    .forEach((player) => {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = String(player.name ?? "").trim() || "名称未設定";
      viewerPlayerSelectEl.appendChild(option);
    });

  const availableIds = ["all", ...getTournamentEligiblePlayers().map((player) => player.id)];
  if (!availableIds.includes(state.viewerSelectedPlayerId)) {
    state.viewerSelectedPlayerId = "all";
  }
  viewerPlayerSelectEl.value = state.viewerSelectedPlayerId;
}

function renderViewerOpponentFilter() {
  viewerOpponentFilterEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "すべての相手";
  viewerOpponentFilterEl.appendChild(allOption);

  const stage = state.viewerStageFilter;
  const matchesForOpponents = currentMatches.filter((match) => {
    if (stage === "all") return true;
    return (match.stage ?? "") === stage;
  });

  const opponents = Array.from(
    new Set(matchesForOpponents.map((match) => match.opponent || "対戦相手未設定").filter(Boolean)),
  );

  opponents.forEach((opponent) => {
    const option = document.createElement("option");
    option.value = opponent;
    option.textContent = opponent;
    viewerOpponentFilterEl.appendChild(option);
  });

  const available = ["all", ...opponents];
  if (!available.includes(state.viewerOpponentFilter)) {
    state.viewerOpponentFilter = "all";
  }
  viewerOpponentFilterEl.value = state.viewerOpponentFilter;
}

function renderViewerDetailMatchSelect(availableMatches) {
  viewerDetailMatchSelectEl.innerHTML = "";

  if (!availableMatches.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "試合がありません";
    viewerDetailMatchSelectEl.appendChild(option);
    state.viewerDetailMatchId = "";
    return;
  }

  availableMatches.forEach((match) => {
    const option = document.createElement("option");
    option.value = match.id;
    option.textContent = getMatchLabel(match);
    viewerDetailMatchSelectEl.appendChild(option);
  });

  if (!availableMatches.some((match) => match.id === state.viewerDetailMatchId)) {
    state.viewerDetailMatchId = availableMatches[0].id;
  }

  viewerDetailMatchSelectEl.value = state.viewerDetailMatchId;
}

function getViewerPlainPlayerNameForSort(row) {
  const player = players.find((p) => p.id === row.id);
  return (player?.name ?? row.name ?? "").trim();
}

function getViewerNameSortIndex(plainName) {
  const idx = VIEWER_ROSTER_NAME_ORDER.indexOf(plainName);
  if (idx !== -1) {
    return idx;
  }
  return VIEWER_ROSTER_NAME_ORDER.length;
}

function sortViewerRowsWithKeyOrder(rows, sortKey, sortOrder) {
  const direction = sortOrder === "asc" ? 1 : -1;
  const key = sortKey;
  return [...rows].sort((a, b) => {
    if (key === "name") {
      const na = getViewerPlainPlayerNameForSort(a);
      const nb = getViewerPlainPlayerNameForSort(b);
      const ia = getViewerNameSortIndex(na);
      const ib = getViewerNameSortIndex(nb);
      if (ia !== ib) {
        return (ia - ib) * direction;
      }
      return na.localeCompare(nb, "ja") * direction;
    }
    return ((a[key] ?? 0) - (b[key] ?? 0)) * direction;
  });
}

function sortViewerRows(rows) {
  return sortViewerRowsWithKeyOrder(rows, state.viewerSortKey, state.viewerSortOrder);
}

function sortViewerDetailRows(rows) {
  return sortViewerRowsWithKeyOrder(rows, state.viewerDetailSortKey, state.viewerDetailSortOrder);
}

function syncViewerSortControls() {
  viewerSortKeyEl.value = state.viewerSortKey;
  viewerSortOrderEl.value = state.viewerSortOrder;
  viewerSortButtonsEls.forEach((button) => {
    const isActive = button.dataset.sortKey === state.viewerSortKey;
    button.classList.toggle("active", isActive);
    button.classList.toggle("asc", isActive && state.viewerSortOrder === "asc");
    button.classList.toggle("desc", isActive && state.viewerSortOrder === "desc");
  });
}

function syncViewerDetailSortControls() {
  viewerDetailSortButtonsEls.forEach((button) => {
    const isActive = button.dataset.sortKey === state.viewerDetailSortKey;
    button.classList.toggle("active", isActive);
    button.classList.toggle("asc", isActive && state.viewerDetailSortOrder === "asc");
    button.classList.toggle("desc", isActive && state.viewerDetailSortOrder === "desc");
  });
}

function getAverage(rows, key) {
  if (!rows.length) {
    return 0;
  }
  return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0) / rows.length;
}

function isViewerSinglePlayerMode() {
  return state.viewerSelectedPlayerId !== "all";
}

function buildViewerPlayerRow(playerId, recordsByMatch, selectedMatchIds, matchMetaById = null) {
  const player = players.find((item) => item.id === playerId);
  const totals = {
    attack: 0,
    attackSuccess: 0,
    attackFailure: 0,
    zeroBreak: 0,
    catch: 0,
    out: 0,
    return: 0,
    attackContributionTotal: 0,
    catchContributionTotal: 0,
    benchMatchCount: 0,
  };

  const matchGroups = new Map();
  selectedMatchIds.forEach((matchId) => {
    const matchObj = matchMetaById?.get(matchId) ?? currentMatches.find((m) => m.id === matchId);
    const groupKey = matchObj?.tournamentId || state.selectedTournamentId || "__unknown_tournament__";
    const group = matchGroups.get(groupKey) ?? { matchIds: [], hasPlayerRecord: false };
    group.matchIds.push(matchId);
    matchGroups.set(groupKey, group);
  });

  matchGroups.forEach((group) => {
    group.hasPlayerRecord = group.matchIds.some((matchId) => {
      const allRecords = recordsByMatch[matchId] ?? {};
      if (!Object.prototype.hasOwnProperty.call(allRecords, playerId)) {
        return false;
      }
      const record = allRecords[playerId] ?? {};
      if (isAbsentRecord(record)) {
        return false;
      }
      const recordIsPureBench =
        Boolean(record.isBench) &&
        !record.retiredBySubstitution &&
        !recordHasAnyStattedPlays(record);
      return !recordIsPureBench;
    });
  });

  const participatingMatchIds = new Set();
  matchGroups.forEach((group) => {
    if (!group.hasPlayerRecord) return;
    group.matchIds.forEach((matchId) => participatingMatchIds.add(matchId));
  });

  selectedMatchIds.forEach((matchId) => {
    const allRecords = recordsByMatch[matchId] ?? {};
    const record = allRecords[playerId] ?? {};
    if (isAbsentRecord(record)) {
      return;
    }
    const recordIsPureBench =
      Boolean(record.isBench) &&
      !record.retiredBySubstitution &&
      !recordHasAnyStattedPlays(record);
    if (recordIsPureBench && participatingMatchIds.has(matchId)) {
      totals.benchMatchCount += 1;
    }
    const teamAttackSuccess = Object.values(allRecords).reduce((sum, item) => {
      if (item?.absent) {
        return sum;
      }
      const pure =
        item?.isBench && !item?.retiredBySubstitution && !recordHasAnyStattedPlays(item ?? {});
      return sum + (pure ? 0 : item?.attackSuccess || 0);
    }, 0);
    const teamCatch = Object.values(allRecords).reduce((sum, item) => {
      if (item?.absent) {
        return sum;
      }
      const pure =
        item?.isBench && !item?.retiredBySubstitution && !recordHasAnyStattedPlays(item ?? {});
      return sum + (pure ? 0 : item?.catch || 0);
    }, 0);

    if (!recordIsPureBench) {
      totals.attackSuccess += record.attackSuccess || 0;
      totals.attackFailure += getAttackFailureFromRecord(record);
      totals.zeroBreak += record.zeroBreak || 0;
      totals.catch += record.catch || 0;
      totals.out += record.out || 0;
      totals.return += record.return || 0;
    }

    totals.attackContributionTotal += teamAttackSuccess
      ? ((record.attackSuccess || 0) / teamAttackSuccess) * 100
      : 0;
    totals.catchContributionTotal += teamCatch ? ((record.catch || 0) / teamCatch) * 100 : 0;
  });

  const incoming = totals.catch + totals.out;
  totals.attack = totals.attackSuccess + totals.attackFailure;
  const attackRate = totals.attack ? (totals.attackSuccess / totals.attack) * 100 : 0;
  const catchRate = incoming ? (totals.catch / incoming) * 100 : 0;
  const attackContribution = selectedMatchIds.length
    ? totals.attackContributionTotal / selectedMatchIds.length
    : 0;
  const catchContribution = selectedMatchIds.length
    ? totals.catchContributionTotal / selectedMatchIds.length
    : 0;

  const gamesTotal = Array.from(matchGroups.values())
    .filter((group) => group.hasPlayerRecord)
    .reduce((sum, group) => sum + group.matchIds.length, 0);
  const gamesPlayed = Math.max(0, gamesTotal - totals.benchMatchCount);

  return {
    id: playerId,
    name: player ? String(player.name ?? "").trim() || "未登録選手" : "未登録選手",
    attack: totals.attack,
    attackSuccess: totals.attackSuccess,
    attackFailure: totals.attackFailure,
    attackRate,
    zeroBreak: totals.zeroBreak,
    catch: totals.catch,
    out: totals.out,
    incoming,
    catchRate,
    return: totals.return,
    /** 出場した試合数（選択範囲内でベンチ以外） */
    games: gamesPlayed,
    /** 集計対象の試合数（選択試合数） */
    gamesTotal,
    attackContribution,
    catchContribution,
  };
}

function renderViewerTotals(rows, selectedMatchIds) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.attack += row.attack;
      acc.attackSuccess += row.attackSuccess;
      acc.attackFailure += row.attackFailure;
      acc.zeroBreak += row.zeroBreak;
      acc.catch += row.catch;
      acc.out += row.out;
      acc.incoming += row.incoming;
      acc.return += row.return;
      return acc;
    },
    { attack: 0, attackSuccess: 0, attackFailure: 0, zeroBreak: 0, catch: 0, out: 0, incoming: 0, return: 0 },
  );

  const metrics = [
    ["選択試合数", selectedMatchIds.length],
    ["総アタック数", totals.attack],
    ["アタック成功数", totals.attackSuccess],
    ["アタック失敗数", totals.attackFailure],
    ["アタック成功率", formatPercentWithCounts(totals.attackSuccess, totals.attack)],
    ["飛んできた本数", totals.incoming],
    ["キャッチ数", totals.catch],
    ["アウト数", totals.out],
    ["キャッチ率", formatPercentWithCounts(totals.catch, totals.incoming)],
    ["内野復帰数", totals.return],
    ["ゼロ抜き数", totals.zeroBreak],
  ];

  if (isViewerSinglePlayerMode()) {
    metrics.splice(8, 0, ["アタック貢献度", formatPercent(getAverage(rows, "attackContribution"))]);
    metrics.splice(9, 0, ["キャッチ貢献度", formatPercent(getAverage(rows, "catchContribution"))]);
  }

  viewerTotalsEl.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="summary-box">
          <span class="summary-label">${label}</span>
          <span class="summary-value viewer-summary-value">${value}</span>
        </div>`,
    )
    .join("");
}

function createRankingRows(rows, key, minimumValue = 0) {
  return [...rows]
    .filter((row) => (row[key] ?? 0) > minimumValue)
    .sort((a, b) => {
      const diff = (b[key] ?? 0) - (a[key] ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name, "ja");
    })
    .slice(0, 3);
}

function renderRankingCard(title, rows, key, formatter = (value) => String(value), minimumValue = 0) {
  const rankedRows = createRankingRows(rows, key, minimumValue);
  if (!rankedRows.length) {
    return `
      <section class="ranking-card">
        <h4 class="ranking-card-title">${title}</h4>
        <p class="login-description no-margin">表示できるデータがありません。</p>
      </section>
    `;
  }

  return `
    <section class="ranking-card">
      <h4 class="ranking-card-title">${title}</h4>
      <div class="ranking-list">
        ${rankedRows
          .map((row, index) => {
            const player = players.find((item) => item.id === row.id) ?? { id: row.id, name: row.name };
            return `
              <div class="ranking-item">
                <span class="ranking-item-rank">${index + 1}位</span>
                <div class="ranking-item-main">
                  ${renderPlayerNameButtonHtml(player)}
                </div>
                <span class="ranking-item-value">${formatter(row[key] ?? 0)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderViewerRankings(rows) {
  if (!rows.length) {
    viewerRankingsEl.innerHTML = "";
    return;
  }

  viewerRankingsEl.innerHTML = [
    renderRankingCard("アタック成功数", rows, "attackSuccess"),
    renderRankingCard("キャッチ数", rows, "catch"),
    renderRankingCard("アタック貢献度", rows, "attackContribution", formatPercent, 0),
    renderRankingCard("キャッチ貢献度", rows, "catchContribution", formatPercent, 0),
  ].join("");

  viewerRankingsEl.querySelectorAll(".player-name-button").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.playerId;
      if (playerId) {
        openPlayerProfile(playerId);
      }
    });
  });
}

function toggleViewerTotalsAccordion() {
  toggleAccordionAnimated(viewerTotalsAccordionBodyEl, viewerTotalsAccordionIconEl);
}

function toggleViewerRankingAccordion() {
  toggleAccordionAnimated(viewerRankingAccordionBodyEl, viewerRankingAccordionIconEl);
}

function toggleViewerDetailAccordion() {
  toggleAccordionAnimated(viewerDetailAccordionBodyEl, viewerDetailAccordionIconEl);
}

function renderViewerTable(rows) {
  viewerTableBodyEl.innerHTML = "";
  if (!rows.length) {
    viewerTableBodyEl.innerHTML =
      '<tr><td colspan="14" class="empty-cell">集計できるデータがありません。</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="sticky-col">${renderPlayerNameButtonHtml(players.find((player) => player.id === row.id) ?? { id: row.id, name: row.name })}</td>
      <td>${row.gamesTotal ? `${row.games}/${row.gamesTotal}` : "0/0"}</td>
      <td>${row.attack}</td>
      <td>${row.attackSuccess}</td>
      <td>${row.attackFailure}</td>
      <td>${formatPercentWithCounts(row.attackSuccess, row.attack)}</td>
      <td>${row.incoming}</td>
      <td>${row.catch}</td>
      <td>${row.out}</td>
      <td>${formatPercentWithCounts(row.catch, row.incoming)}</td>
      <td class="viewer-contribution-col">${formatPercent(row.attackContribution)}</td>
      <td class="viewer-contribution-col">${formatPercent(row.catchContribution)}</td>
      <td>${row.return}</td>
      <td>${row.zeroBreak}</td>
    `;
    tr.querySelector(".player-name-button")?.addEventListener("click", () => {
      openPlayerProfile(row.id);
    });
    viewerTableBodyEl.appendChild(tr);
  });
}

function renderViewerDetailTable(rows) {
  viewerDetailTableBodyEl.innerHTML = "";
  if (!rows.length) {
    viewerDetailTableBodyEl.innerHTML =
      '<tr><td colspan="13" class="empty-cell">この試合の詳細データがありません。</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="sticky-col">${renderPlayerNameButtonHtml(players.find((player) => player.id === row.id) ?? { id: row.id, name: row.name })}</td>
      <td>${row.attack}</td>
      <td>${row.attackSuccess}</td>
      <td>${row.attackFailure}</td>
      <td>${formatPercentWithCounts(row.attackSuccess, row.attack)}</td>
      <td>${row.incoming}</td>
      <td>${row.catch}</td>
      <td>${row.out}</td>
      <td>${formatPercentWithCounts(row.catch, row.incoming)}</td>
      <td>${formatPercent(row.attackContribution)}</td>
      <td>${formatPercent(row.catchContribution)}</td>
      <td>${row.return}</td>
      <td>${row.zeroBreak}</td>
    `;
    tr.querySelector(".player-name-button")?.addEventListener("click", () => {
      openPlayerProfile(row.id);
    });
    viewerDetailTableBodyEl.appendChild(tr);
  });
}

/** 閲覧CSVのファイル名用（Windows等で使えない文字を除去） */
function sanitizeCsvFilenamePart(text) {
  return String(text ?? "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/** 大会日が入っているときだけ「年-月-日」を返す（未入力は空） */
function getViewerCsvDatePrefix(tournamentDate) {
  if (tournamentDate && /^\d{4}-\d{1,2}-\d{1,2}/.test(String(tournamentDate))) {
    const [y, m, d] = String(tournamentDate).split("-").map((v) => Number.parseInt(v, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return `${y}-${m}-${d}`;
    }
  }
  return "";
}

function getTodayDatePrefix() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatPercentWithCounts(success, total) {
  const safeSuccess = Math.max(0, Number(success) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  const rate = safeTotal ? (safeSuccess / safeTotal) * 100 : 0;
  return `${formatPercent(rate)}（${safeSuccess}/${safeTotal}）`;
}

function buildViewerRankingsData(rows, topN = 5) {
  const defs = [
    ["アタック成功数", "attackSuccess", (v) => String(v)],
    ["キャッチ数", "catch", (v) => String(v)],
    ["アタック貢献度", "attackContribution", (v) => formatPercent(v)],
    ["キャッチ貢献度", "catchContribution", (v) => formatPercent(v)],
  ];
  return defs.map(([title, key, fmt]) => {
    const list = [...rows]
      .filter((r) => (r[key] ?? 0) > 0)
      .sort((a, b) => {
        const diff = (b[key] ?? 0) - (a[key] ?? 0);
        if (diff !== 0) return diff;
        return (a.name ?? "").localeCompare(b.name ?? "", "ja");
      })
      .slice(0, topN)
      .map((row, idx) => ({ rank: idx + 1, name: row.name, value: fmt(row[key] ?? 0) }));
    return { title, list };
  });
}

function buildViewerSummaryStats(rows, selectedMatchCount) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.attack += row.attack;
      acc.attackSuccess += row.attackSuccess;
      acc.attackFailure += row.attackFailure;
      acc.catch += row.catch;
      acc.out += row.out;
      acc.incoming += row.incoming;
      acc.return += row.return;
      acc.zeroBreak += row.zeroBreak;
      return acc;
    },
    { attack: 0, attackSuccess: 0, attackFailure: 0, catch: 0, out: 0, incoming: 0, return: 0, zeroBreak: 0 },
  );
  return [
    ["選択試合数", selectedMatchCount],
    ["総アタック数", totals.attack],
    ["アタック成功数", totals.attackSuccess],
    ["アタック失敗数", totals.attackFailure],
    ["アタック成功率", formatPercentWithCounts(totals.attackSuccess, totals.attack)],
    ["飛んできた本数", totals.incoming],
    ["キャッチ数", totals.catch],
    ["アウト数", totals.out],
    ["キャッチ率", formatPercentWithCounts(totals.catch, totals.incoming)],
    ["内野復帰数", totals.return],
    ["ゼロ抜き数", totals.zeroBreak],
  ];
}

function createViewerTableRowsCsv(rows) {
  return rows.map((row) => [
    row.name,
    row.gamesTotal ? `${row.games}/${row.gamesTotal}` : "0/0",
    row.attack,
    row.attackSuccess,
    row.attackFailure,
    formatPercentWithCounts(row.attackSuccess, row.attack),
    row.incoming,
    row.catch,
    row.out,
    formatPercentWithCounts(row.catch, row.incoming),
    formatPercent(row.attackContribution),
    formatPercent(row.catchContribution),
    row.return,
    row.zeroBreak,
  ]);
}

async function buildTournamentViewerSnapshot(tournamentId) {
  const tournament = currentTournaments.find((t) => t.id === tournamentId);
  if (!tournament) return null;
  const matches = await loadMatchesByTournament(tournamentId);
  const matchMetaById = new Map(matches.map((match) => [match.id, { ...match, tournamentId }]));
  const recordsSnapshot = await getTournamentRecordsRef(tournamentId).once("value");
  const recordsByMatch = recordsSnapshot.val() ?? {};
  const filteredMatches = matches.filter((match) => {
    const stageOk = state.viewerStageFilter === "all" || (match.stage ?? "") === state.viewerStageFilter;
    const opponentOk = state.viewerOpponentFilter === "all" || (match.opponent ?? "") === state.viewerOpponentFilter;
    const categoryValue = match.opponentCategory || "未設定";
    const categoryOk =
      state.viewerOpponentCategoryFilter === "all" || categoryValue === state.viewerOpponentCategoryFilter;
    return stageOk && opponentOk && categoryOk;
  });
  let selectedMatchIds = filteredMatches.map((m) => m.id);
  if (tournamentId === state.selectedTournamentId) {
    selectedMatchIds = state.viewerSelectedMatchIds.filter((id) => filteredMatches.some((m) => m.id === id));
  }
  const selectedPlayerId = state.viewerSelectedPlayerId;
  const rows = players
    .map((player) => buildViewerPlayerRow(player.id, recordsByMatch, selectedMatchIds, matchMetaById))
    .filter((row) => selectedPlayerId === "all" || row.id === selectedPlayerId)
    .filter((row) => players.find((p) => p.id === row.id)?.active !== false)
    .filter((row) => row.games > 0 || row.attack || row.catch || row.out || row.return || row.zeroBreak)
    .map((row) => ({ ...row }));
  const sortedRows = sortViewerRows(rows);
  const summaryStats = buildViewerSummaryStats(rows, selectedMatchIds.length);
  const rankings = buildViewerRankingsData(sortedRows, 5);
  return {
    tournament,
    filteredMatches,
    selectedMatchIds,
    selectedPlayerId,
    rows: sortedRows,
    summaryStats,
    rankings,
  };
}

async function buildAllMatchesViewerSnapshot() {
  const allMatches = [];
  const recordsByMatch = {};
  for (const tournament of currentTournaments) {
    const matches = await loadMatchesByTournament(tournament.id);
    const recordsSnapshot = await getTournamentRecordsRef(tournament.id).once("value");
    const tournamentRecords = recordsSnapshot.val() ?? {};
    matches.forEach((match) => {
      const mergedMatchId = `${tournament.id}::${match.id}`;
      allMatches.push({
        ...match,
        id: mergedMatchId,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentDate: tournament.date || "",
        tournamentMatchType: tournament.matchType ?? "大会",
      });
      recordsByMatch[mergedMatchId] = tournamentRecords[match.id] ?? {};
    });
  }
  const matchMetaById = new Map(allMatches.map((match) => [match.id, match]));
  const filteredMatches = allMatches.filter((match) => {
    const typeOk =
      state.viewerTournamentTypeFilter === "all" ||
      (state.viewerTournamentTypeFilter === "tournament" && match.tournamentMatchType === "大会") ||
      (state.viewerTournamentTypeFilter === "practice" && match.tournamentMatchType === "練習試合");
    const stageOk = state.viewerStageFilter === "all" || (match.stage ?? "") === state.viewerStageFilter;
    const opponentOk = state.viewerOpponentFilter === "all" || (match.opponent ?? "") === state.viewerOpponentFilter;
    const categoryValue = match.opponentCategory || "未設定";
    const categoryOk =
      state.viewerOpponentCategoryFilter === "all" || categoryValue === state.viewerOpponentCategoryFilter;
    return typeOk && stageOk && opponentOk && categoryOk;
  });
  const selectedMatchIds = filteredMatches.map((match) => match.id);
  const selectedPlayerId = state.viewerSelectedPlayerId;
  const rows = players
    .map((player) => buildViewerPlayerRow(player.id, recordsByMatch, selectedMatchIds, matchMetaById))
    .filter((row) => selectedPlayerId === "all" || row.id === selectedPlayerId)
    .filter((row) => players.find((p) => p.id === row.id)?.active !== false)
    .filter((row) => row.games > 0 || row.attack || row.catch || row.out || row.return || row.zeroBreak)
    .map((row) => ({ ...row }));
  const sortedRows = sortViewerRows(rows);
  return {
    tournament: { id: EXPORT_SELECT_ALL_MATCHES, name: "全ての試合", date: "" },
    filteredMatches,
    selectedMatchIds,
    selectedPlayerId,
    rows: sortedRows,
    summaryStats: buildViewerSummaryStats(rows, selectedMatchIds.length),
    rankings: buildViewerRankingsData(sortedRows, 5),
  };
}

async function buildExportSnapshots(tournamentIds) {
  if (tournamentIds.includes(EXPORT_SELECT_ALL_MATCHES)) {
    const allSnap = await buildAllMatchesViewerSnapshot();
    return allSnap ? [allSnap] : [];
  }
  const snapshots = [];
  for (const tournamentId of tournamentIds) {
    const snap = await buildTournamentViewerSnapshot(tournamentId);
    if (snap) snapshots.push(snap);
  }
  return snapshots;
}

function getExportSelectedFormat() {
  if (isCsvExportBlockedOnMobile()) return "pdf";
  const checked = document.querySelector('input[name="exportFormat"]:checked');
  return checked?.value ?? "pdf";
}

function isCsvExportBlockedOnMobile() {
  return Boolean(window.matchMedia?.("(max-width: 768px)")?.matches);
}

function syncCsvExportAvailability() {
  const csvInput = document.querySelector('input[name="exportFormat"][value="csv"]');
  const csvItem = csvInput?.closest(".export-radio-item");
  if (!csvInput || !csvItem) return;
  const blocked = isCsvExportBlockedOnMobile();
  csvInput.disabled = blocked;
  csvItem.classList.toggle("hidden", blocked);
  if (blocked && csvInput.checked) {
    const pdfInput = document.querySelector('input[name="exportFormat"][value="pdf"]');
    if (pdfInput) pdfInput.checked = true;
  }
}

function getExportSelectedTournamentIds() {
  return state.exportSelectedTournamentIds.filter(
    (id) => id === EXPORT_SELECT_ALL_MATCHES || currentTournaments.some((t) => t.id === id),
  );
}

function buildDefaultExportFileBaseName() {
  const ids = getExportSelectedTournamentIds();
  if (ids.includes(EXPORT_SELECT_ALL_MATCHES)) {
    const dateCandidate = getTodayDatePrefix();
    return dateCandidate ? `${dateCandidate}_全ての試合` : "全ての試合";
  }
  const names = ids
    .map((id) => currentTournaments.find((t) => t.id === id)?.name ?? "")
    .map((name) => sanitizeCsvFilenamePart(name))
    .filter(Boolean);
  const joinedNames = names.length ? names.join("_") : "さくらグループ";
  const dateCandidate =
    ids.length === 1
      ? getViewerCsvDatePrefix(currentTournaments.find((t) => t.id === ids[0])?.date)
      : getTodayDatePrefix();
  return dateCandidate ? `${dateCandidate}_${joinedNames}` : joinedNames;
}

function setExportError(message) {
  exportErrorMessageEl.textContent = message;
  exportErrorMessageEl.classList.toggle("hidden", !message);
}

function setExportRetryVisible(visible) {
  exportRetryAreaEl.classList.toggle("hidden", !visible);
}

function lockBodyScrollForModal() {
  if (document.body.classList.contains("body-scroll-lock")) return;
  lockedBodyScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = `-${lockedBodyScrollY}px`;
  document.body.classList.add("body-scroll-lock");
}

function unlockBodyScrollForModal() {
  if (!document.body.classList.contains("body-scroll-lock")) return;
  document.body.classList.remove("body-scroll-lock");
  document.body.style.top = "";
  window.scrollTo(0, lockedBodyScrollY);
}

function openExportModal() {
  if (!currentTournaments.length) {
    window.alert("大会データがありません。");
    return;
  }
  if (!state.exportSelectedTournamentIds.length) {
    state.exportSelectedTournamentIds =
      state.selectedTournamentId === TOURNAMENT_SELECT_ALL
        ? [EXPORT_SELECT_ALL_MATCHES]
        : state.selectedTournamentId
          ? [state.selectedTournamentId]
          : currentTournaments.map((t) => t.id);
  }
  exportFilenameInputEl.value = buildDefaultExportFileBaseName();
  renderExportTournamentList();
  syncExportTournamentAccordionState();
  syncCsvExportAvailability();
  setExportError("");
  setExportRetryVisible(false);
  lockBodyScrollForModal();
  exportModalEl.classList.remove("hidden");
}

function closeExportModal() {
  exportModalEl.classList.add("hidden");
  unlockBodyScrollForModal();
}

function renderExportTournamentList() {
  exportTournamentListEl.innerHTML = "";
  const allMatchesLabel = document.createElement("label");
  allMatchesLabel.className = "filter-chip";
  const allMatchesInput = document.createElement("input");
  allMatchesInput.type = "checkbox";
  allMatchesInput.checked = state.exportSelectedTournamentIds.includes(EXPORT_SELECT_ALL_MATCHES);
  allMatchesInput.addEventListener("change", () => {
    if (allMatchesInput.checked) {
      state.exportSelectedTournamentIds = [EXPORT_SELECT_ALL_MATCHES];
    } else {
      state.exportSelectedTournamentIds = [];
    }
    renderExportTournamentList();
    exportFilenameInputEl.value = buildDefaultExportFileBaseName();
  });
  const allMatchesText = document.createElement("span");
  allMatchesText.textContent = "全ての試合";
  allMatchesLabel.append(allMatchesInput, allMatchesText);
  exportTournamentListEl.appendChild(allMatchesLabel);

  currentTournaments.forEach((tournament) => {
    const label = document.createElement("label");
    label.className = "filter-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.exportSelectedTournamentIds.includes(tournament.id);
    input.addEventListener("change", () => {
      const set = new Set(state.exportSelectedTournamentIds);
      set.delete(EXPORT_SELECT_ALL_MATCHES);
      if (input.checked) set.add(tournament.id);
      else set.delete(tournament.id);
      state.exportSelectedTournamentIds = Array.from(set);
      exportFilenameInputEl.value = buildDefaultExportFileBaseName();
    });
    const text = document.createElement("span");
    const dateLabel = tournament.date ? ` (${tournament.date})` : "";
    text.textContent = `${tournament.name}${dateLabel}`;
    label.append(input, text);
    exportTournamentListEl.appendChild(label);
  });
}

function isSmartphoneViewport() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function syncExportTournamentAccordionState() {
  if (!exportTournamentAccordionBodyEl || !exportTournamentAccordionIconEl) return;
  if (isSmartphoneViewport()) {
    exportTournamentAccordionBodyEl.classList.add("hidden");
    exportTournamentAccordionIconEl.textContent = "＋";
    return;
  }
  exportTournamentAccordionBodyEl.classList.remove("hidden");
  exportTournamentAccordionIconEl.textContent = "−";
}

function ensureOverwriteConfirm(fileName) {
  const key = "sakuramatch-export-history";
  let history = [];
  try {
    history = JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    history = [];
  }
  if (history.includes(fileName)) {
    return window.confirm("このファイル名は既に出力履歴があります。続行しますか？");
  }
  history.push(fileName);
  window.localStorage.setItem(key, JSON.stringify(history.slice(-80)));
  return true;
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildOutputFileNameWithExt(ext) {
  const input = sanitizeCsvFilenamePart(exportFilenameInputEl.value) || buildDefaultExportFileBaseName();
  return `${input}.${ext}`;
}

function buildCsvTextFromSnapshots(snapshots) {
  const headers = [
    "大会名",
    "選手名",
    "出場数",
    "総アタック数",
    "アタック成功数",
    "アタック失敗数",
    "アタック成功率",
    "飛んできた本数",
    "キャッチ数",
    "アウト数",
    "キャッチ率",
    "アタック貢献度",
    "キャッチ貢献度",
    "内野復帰数",
    "ゼロ抜き数",
  ];
  const lines = [headers];
  snapshots.forEach((snap) => {
    const conditionLines = buildExportConditionItems(snap).map(([k, v]) => `${k}: ${v}`);
    if (conditionLines.length) {
      lines.push([`出力条件: ${conditionLines.join(" / ")}`]);
    }
    createViewerTableRowsCsv(snap.rows).forEach((row) => lines.push([snap.tournament.name, ...row]));
    lines.push([]);
  });
  return lines.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function renderExportCard(title, items) {
  const darkBg = "#0f0f0f";
  const darkPanel = "#181818";
  const darkBorder = "#3a2e10";
  const textMain = "#f8e7a1";
  const textSub = "#d6bf73";
  return `
    <section style="background:${darkBg};border:1px solid ${darkBorder};border-radius:12px;padding:14px;margin-bottom:14px;">
      <h3 style="margin:0 0 10px;font-size:16px;color:${textMain};">${escapeHtml(title)}</h3>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        ${items
          .map(
            ([label, value]) =>
              `<div style="border:1px solid ${darkBorder};background:${darkPanel};border-radius:8px;padding:8px;"><div style="font-size:11px;color:${textSub};">${escapeHtml(label)}</div><div style="font-size:14px;color:${textMain};font-weight:700;">${escapeHtml(value)}</div></div>`,
          )
          .join("")}
      </div>
    </section>`;
}

async function renderElementToCanvas(element, scale = 1.5) {
  return await window.html2canvas(element, { backgroundColor: "#ffffff", scale });
}

async function renderElementToPngBlob(element) {
  const canvas = await renderElementToCanvas(element, 1.5);
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function getSelectedPlayerNameForExport(selectedPlayerId) {
  if (!selectedPlayerId || selectedPlayerId === "all") {
    return "";
  }
  return players.find((p) => p.id === selectedPlayerId)?.name ?? "";
}

function getExportSortLabel(key) {
  return (
    {
      name: "選手名",
      games: "出場数",
      attack: "総アタック数",
      attackSuccess: "アタック成功数",
      attackFailure: "アタック失敗数",
      attackRate: "アタック成功率",
      incoming: "飛んできた本数",
      catch: "キャッチ数",
      out: "アウト数",
      catchRate: "キャッチ率",
      attackContribution: "アタック貢献度",
      catchContribution: "キャッチ貢献度",
      return: "内野復帰数",
      zeroBreak: "ゼロ抜き数",
    }[key] ?? key
  );
}

function buildExportConditionItems(snap) {
  const items = [];
  if (state.viewerStageFilter !== "all") {
    items.push(["試合区分", state.viewerStageFilter]);
  }
  if (state.viewerOpponentFilter !== "all") {
    items.push(["対戦相手", state.viewerOpponentFilter]);
  }
  if (state.viewerOpponentCategoryFilter !== "all") {
    items.push(["対戦カテゴリ", state.viewerOpponentCategoryFilter]);
  }
  if (snap.filteredMatches.length > 0 && snap.selectedMatchIds.length !== snap.filteredMatches.length) {
    items.push(["選択試合", `${snap.selectedMatchIds.length}/${snap.filteredMatches.length}`]);
  }
  const playerName = getSelectedPlayerNameForExport(snap.selectedPlayerId);
  if (playerName) {
    items.push(["選手絞り込み", playerName]);
  }
  if (!(state.viewerSortKey === "name" && state.viewerSortOrder === "asc")) {
    items.push(["並び替え", `${getExportSortLabel(state.viewerSortKey)}（${state.viewerSortOrder === "asc" ? "昇順" : "降順"}）`]);
  }
  return items;
}

function renderExportConditionBadgeHtml(items) {
  if (!items.length) {
    return "";
  }
  return `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;">
      ${items
        .map(
          ([label, value]) =>
            `<span style="display:inline-block;border:1px solid #6b5420;border-radius:999px;padding:3px 8px;font-size:11px;color:#f8e7a1;background:#1a1a1a;">${escapeHtml(label)}: ${escapeHtml(String(value))}</span>`,
        )
        .join("")}
    </div>
  `;
}

async function exportAsPng(snapshots, baseName) {
  for (const snap of snapshots) {
    const mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "0";
    mount.style.width = "1100px";
    mount.style.background = "#0a0a0a";
    mount.style.color = "#f8e7a1";
    mount.style.padding = "16px";

    const summarySection = document.createElement("div");
    const conditionItems = buildExportConditionItems(snap);
    summarySection.innerHTML = renderExportCard(
      `${snap.tournament.name} 統計`,
      snap.summaryStats.map(([label, value]) => [label, String(value)]),
    );
    if (conditionItems.length) {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderExportConditionBadgeHtml(conditionItems);
      summarySection.prepend(wrap);
    }

    const rankingItems = snap.rankings.flatMap((r) =>
      r.list.map((item) => [`${r.title} ${item.rank}位`, `${item.name} ${item.value}`]),
    );
    const rankingSection = document.createElement("div");
    rankingSection.innerHTML = renderExportCard(`${snap.tournament.name} ランキング`, rankingItems);
    if (conditionItems.length) {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderExportConditionBadgeHtml(conditionItems);
      rankingSection.prepend(wrap);
    }

    const tableEl = document.createElement("table");
    tableEl.style.width = "100%";
    tableEl.style.borderCollapse = "collapse";
    const tableCaption = conditionItems.length
      ? `<caption style="caption-side:top;text-align:left;padding:6px 0;">${renderExportConditionBadgeHtml(conditionItems)}</caption>`
      : "";
    tableEl.innerHTML = `
      ${tableCaption}
      <thead><tr>${["選手名", "出場数", "総アタック数", "アタック成功数", "アタック失敗数", "アタック成功率", "飛んできた本数", "キャッチ数", "アウト数", "キャッチ率", "アタック貢献度", "キャッチ貢献度", "内野復帰数", "ゼロ抜き数"]
        .map((h) => `<th style="border:1px solid #6b5420;padding:6px;background:#1a1a1a;font-size:12px;color:#f8e7a1;">${h}</th>`)
        .join("")}</tr></thead>
      <tbody>
        ${createViewerTableRowsCsv(snap.rows)
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td style="border:1px solid #3a2e10;padding:6px;font-size:12px;color:#f8e7a1;background:#101010;">${escapeHtml(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}
      </tbody>`;

    mount.append(summarySection, rankingSection, tableEl);
    document.body.appendChild(mount);

    const summaryBlob = await renderElementToPngBlob(summarySection);
    const rankingBlob = await renderElementToPngBlob(rankingSection);
    const tableBlob = await renderElementToPngBlob(tableEl);
    triggerBlobDownload(summaryBlob, `${baseName}_${sanitizeCsvFilenamePart(snap.tournament.name)}_統計.png`);
    triggerBlobDownload(rankingBlob, `${baseName}_${sanitizeCsvFilenamePart(snap.tournament.name)}_ランキング.png`);
    triggerBlobDownload(tableBlob, `${baseName}_${sanitizeCsvFilenamePart(snap.tournament.name)}_成績表.png`);
    mount.remove();
  }
}

function exportAsCsv(snapshots, fileName) {
  const csvText = buildCsvTextFromSnapshots(snapshots);
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, fileName);
}

function exportAsPdf(snapshots, fileName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

    const addCanvasPageToPdf = (canvas, shouldAddPage) => {
    if (shouldAddPage) {
      doc.addPage();
    }
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 8;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const x = (pageWidth - drawW) / 2;
    const y = margin;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, drawW, drawH);
  };

    const renderPdfPageBlock = async (html, widthPx = 880) => {
    const mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "0";
      mount.style.width = `${widthPx}px`;
      mount.style.background = "#0a0a0a";
      mount.style.padding = "8px";
      mount.style.color = "#f8e7a1";
    mount.innerHTML = html;
    document.body.appendChild(mount);
      const canvas = await renderElementToCanvas(mount, 2);
    mount.remove();
    return canvas;
  };

  const run = async () => {
    let pageCount = 0;
    for (const snap of snapshots) {
      const conditionItems = buildExportConditionItems(snap);
      const infoCanvas = await renderPdfPageBlock(`
        <h2 style="margin:0 0 8px;font-size:24px;">大会情報 / 統計</h2>
        <div style="font-size:22px;font-weight:700;margin-bottom:6px;">${escapeHtml(snap.tournament.name)}</div>
        <div style="font-size:15px;margin-bottom:8px;">日付: ${escapeHtml(snap.tournament.date || "未設定")} / 選択試合数: ${snap.selectedMatchIds.length}</div>
        ${renderExportConditionBadgeHtml(conditionItems)}
        ${renderExportCard(`${snap.tournament.name} 統計`, snap.summaryStats)}
      `, 860);
      addCanvasPageToPdf(infoCanvas, pageCount > 0);
      pageCount += 1;

      const tableRows = createViewerTableRowsCsv(snap.rows)
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td style="border:1px solid #3a2e10;padding:6px;font-size:11px;color:#f8e7a1;background:#101010;">${escapeHtml(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      const tableCanvas = await renderPdfPageBlock(`
        <h2 style="margin:0 0 6px;font-size:24px;">${escapeHtml(snap.tournament.name)} 成績表</h2>
        ${renderExportConditionBadgeHtml(conditionItems)}
        <table style="width:100%;border-collapse:collapse;background:#0f0f0f;">
          <thead><tr>${["選手名", "出場数", "総アタック数", "アタック成功数", "アタック失敗数", "アタック成功率", "飛んできた本数", "キャッチ数", "アウト数", "キャッチ率", "アタック貢献度", "キャッチ貢献度", "内野復帰数", "ゼロ抜き数"]
            .map((h) => `<th style="border:1px solid #6b5420;padding:5px;background:#1a1a1a;font-size:12px;color:#f8e7a1;">${h}</th>`)
            .join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      `, 980);
      addCanvasPageToPdf(tableCanvas, true);
      pageCount += 1;

      const rankingItems = snap.rankings.flatMap((r) =>
        r.list.map((item) => [`${r.title} ${item.rank}位`, `${item.name} ${item.value}`]),
      );
      const rankingCanvas = await renderPdfPageBlock(`
        <h2 style="margin:0 0 6px;font-size:24px;">${escapeHtml(snap.tournament.name)} ランキング</h2>
        ${renderExportConditionBadgeHtml(conditionItems)}
        ${renderExportCard(`${snap.tournament.name} ランキング`, rankingItems)}
      `, 860);
      addCanvasPageToPdf(rankingCanvas, true);
      pageCount += 1;
    }
    doc.save(fileName);
  };

  return run();
}

async function executeExport() {
  try {
    setExportError("");
    setExportRetryVisible(false);
    const format = getExportSelectedFormat();
    const selectedTournamentIds = getExportSelectedTournamentIds();
    if (!selectedTournamentIds.length) {
      setExportError("出力対象の大会を1つ以上選択してください。");
      return;
    }

    const snapshots = await buildExportSnapshots(selectedTournamentIds);
    const allRows = snapshots.flatMap((snap) => snap.rows);
    if (!allRows.length) {
      setExportError("出力対象のデータがありません。");
      return;
    }

    const containsAllMatchExport = snapshots.some(
      (snap) => snap.filteredMatches.length > 0 && snap.selectedMatchIds.length === snap.filteredMatches.length,
    );
    if (containsAllMatchExport) {
      const ok = window.confirm("全試合を出力しますか？");
      if (!ok) {
        return;
      }
    }

    const fileName = buildOutputFileNameWithExt(format === "png" ? "png" : format);
    if (!ensureOverwriteConfirm(fileName)) {
      return;
    }

    if (format === "csv") {
      exportAsCsv(snapshots, fileName);
    } else if (format === "pdf") {
      await exportAsPdf(snapshots, fileName);
    } else {
      const baseName = fileName.replace(/\.png$/i, "");
      await exportAsPng(snapshots, baseName);
    }
    window.alert("出力が完了しました。");
    closeExportModal();
  } catch (error) {
    console.error(error);
    setExportError("出力エラーが発生しました。再度お試しください。");
    setExportRetryVisible(true);
  }
}

function renderViewerContent() {
  const hasTournament = Boolean(state.selectedTournamentId);
  const isAllMatchesSelected = state.selectedTournamentId === TOURNAMENT_SELECT_ALL;
  const canShowViewer = !isStaff() && hasTournament;
  viewerSectionEl.classList.toggle("hidden", !canShowViewer);
  if (!canShowViewer) {
    state.viewerLastRenderedRows = [];
    state.viewerLastSelectedMatchIds = [];
    setViewerEmptyState("");
    viewerRankingsEl.innerHTML = "";
    return;
  }

  viewerTournamentTypeFilterWrapEl.classList.toggle("hidden", !isAllMatchesSelected);
  if (!isAllMatchesSelected) {
    state.viewerTournamentTypeFilter = "all";
    viewerMatchFiltersAccordionBodyEl.classList.remove("hidden");
    viewerMatchFiltersAccordionIconEl.textContent = "−";
  } else {
    viewerMatchFiltersAccordionBodyEl.classList.add("hidden");
    viewerMatchFiltersAccordionIconEl.textContent = "＋";
  }
  viewerTournamentTypeFilterEl.value = state.viewerTournamentTypeFilter;
  viewerStageFilterEl.value = state.viewerStageFilter;
  renderViewerOpponentFilter();
  if (viewerOpponentCategoryFilterEl) {
    viewerOpponentCategoryFilterEl.value = state.viewerOpponentCategoryFilter;
  }
  const filteredMatches = getViewerFilteredMatches();
  renderViewerDetailMatchSelect(filteredMatches);
  const selectedMatchIds = getViewerActiveMatchIds().filter((matchId) =>
    filteredMatches.some((match) => match.id === matchId),
  );
  const selectedPlayerId = getViewerSelectedPlayerId();
  syncViewerSortControls();
  syncViewerDetailSortControls();
  renderViewerMatchFilters();
  renderViewerPlayerSelect();

  if (!currentMatches.length) {
    state.viewerLastRenderedRows = [];
    state.viewerLastSelectedMatchIds = [];
    setViewerEmptyState("この大会にはまだ試合がありません。試合が追加されるとここに集計が表示されます。");
    viewerTotalsEl.innerHTML = "";
    viewerRankingsEl.innerHTML = "";
    renderViewerTable([]);
    viewerDetailSummaryEl.textContent = "";
    renderViewerDetailTable([]);
    return;
  }

  if (!filteredMatches.length) {
    state.viewerLastRenderedRows = [];
    state.viewerLastSelectedMatchIds = [];
    setViewerEmptyState("現在の区分・対戦相手条件に一致する試合がありません。条件を変更してみてください。");
    viewerTotalsEl.innerHTML = "";
    viewerRankingsEl.innerHTML = "";
    renderViewerTable([]);
    viewerDetailSummaryEl.textContent = "";
    renderViewerDetailTable([]);
    return;
  }

  if (!selectedMatchIds.length) {
    state.viewerLastRenderedRows = [];
    state.viewerLastSelectedMatchIds = [];
    setViewerEmptyState("試合が選択されていません。上の絞り込みから1試合以上選択してください。");
    viewerTotalsEl.innerHTML = "";
    viewerRankingsEl.innerHTML = "";
    renderViewerTable([]);
    viewerDetailSummaryEl.textContent = "";
    renderViewerDetailTable([]);
    return;
  }

  const selectedPlayerText =
    selectedPlayerId === "all"
      ? "大会参加者全員を表示中"
      : `${players.find((player) => player.id === selectedPlayerId)?.name ?? "選手"}を表示中`;
  const selectedTournament = getSelectedTournament();
  const tournamentDateLabel = selectedTournament?.date ? ` / 大会日: ${selectedTournament.date}` : "";
  viewerSummaryEl.textContent = `${selectedMatchIds.length}試合 / ${selectedPlayerText}${tournamentDateLabel}`;

  const rowIds = getTournamentEligiblePlayers().map((player) => player.id);
  const rows = rowIds
    .map((playerId) => buildViewerPlayerRow(playerId, state.viewerTournamentRecords, selectedMatchIds))
    .filter((row) => selectedPlayerId === "all" || row.id === selectedPlayerId)
    .filter((row) => getTournamentEligiblePlayers().some((player) => player.id === row.id))
    .filter((row) => row.games > 0 || row.attack || row.catch || row.out || row.return || row.zeroBreak)
    .map((row) => ({ ...row }));

  if (!rows.length) {
    state.viewerLastRenderedRows = [];
    state.viewerLastSelectedMatchIds = [];
    setViewerEmptyState("現在の絞り込み条件では集計できるデータがありません。条件を変更してみてください。");
    viewerTotalsEl.innerHTML = "";
    viewerRankingsEl.innerHTML = "";
    renderViewerTable([]);
    viewerDetailSummaryEl.textContent = "";
    renderViewerDetailTable([]);
    return;
  }

  setViewerEmptyState("");

  const sortedRows = sortViewerRows(rows);
  state.viewerLastRenderedRows = sortedRows;
  state.viewerLastSelectedMatchIds = selectedMatchIds;

  renderViewerTotals(rows, selectedMatchIds);
  renderViewerRankings(sortedRows);
  renderViewerTable(sortedRows);

  const detailMatch = filteredMatches.find((match) => match.id === state.viewerDetailMatchId) ?? filteredMatches[0];
  const detailRows = players
    .map((player) =>
      buildViewerPlayerRow(player.id, state.viewerTournamentRecords, detailMatch ? [detailMatch.id] : []),
    )
    .filter((row) => selectedPlayerId === "all" || row.id === selectedPlayerId)
    .filter((row) => players.find((player) => player.id === row.id)?.active !== false)
    .filter((row) => row.attack || row.catch || row.out || row.return || row.zeroBreak || row.games > 0);

  viewerDetailSummaryEl.textContent = detailMatch
    ? `${getMatchLabel(detailMatch)} の個別成績`
    : "";
  renderViewerDetailTable(sortViewerDetailRows(detailRows));
}

async function loadViewerRecordsForTournament() {
  if (!db || !state.selectedTournamentId) {
    state.viewerTournamentRecords = {};
    renderViewerContent();
    return;
  }

  if (isViewerVirtualTournamentSelection(state.selectedTournamentId)) {
    const targetTournaments = currentTournaments;
    const mergedRecords = {};
    for (const tournament of targetTournaments) {
      const snapshot = await getTournamentRecordsRef(tournament.id).once("value");
      Object.assign(mergedRecords, snapshot.val() ?? {});
    }
    state.viewerTournamentRecords = mergedRecords;
    renderViewerContent();
    return;
  }

  const snapshot = await getTournamentRecordsRef(state.selectedTournamentId).once("value");
  state.viewerTournamentRecords = snapshot.val() ?? {};
  renderViewerContent();
}

function queueAutoSave() {
  if (!isStaff() || !state.selectedTournamentId || !state.selectedMatchId) {
    return;
  }
  if (state.autoSaveTimerId) {
    window.clearTimeout(state.autoSaveTimerId);
  }
  startAutoSaveCountdown();
  state.autoSaveTimerId = window.setTimeout(() => {
    void saveCurrentMatchRecords(true);
  }, AUTO_SAVE_DELAY_MS);
}

function updateStat(playerId, statKey, diff) {
  if (!isStaff()) {
    return;
  }
  const eligibleIdSet = new Set(getTournamentEligiblePlayers().map((player) => player.id));
  if (!eligibleIdSet.has(playerId)) {
    return;
  }
  if (isMatchBenchReserve(playerId) || isSubstitutedOut(playerId)) {
    return;
  }
  const playerStats = getPlayerStats(playerId);
  const next = Math.max(0, (playerStats[statKey] || 0) + diff);
  state.records[playerId] = { ...playerStats, [statKey]: next };
  renderStats();
  refreshValidationState();
  queueAutoSave();
}

function getSelectedMatchNormalized() {
  return currentMatches.find((item) => item.id === state.selectedMatchId) ?? null;
}

function getMissingStartingMemberPlayerIds(match) {
  const ids = match?.startingMemberIds;
  if (!Array.isArray(ids) || !ids.length) {
    return [];
  }
  const activeSet = new Set(getTournamentEligiblePlayers().map((player) => player.id));
  return ids.filter((id) => !activeSet.has(id));
}

function matchHasValidSavedLineup(match) {
  const ids = match?.startingMemberIds;
  if (!Array.isArray(ids) || ids.length !== LINEUP_STARTER_COUNT) {
    return false;
  }
  const activeSet = new Set(getMatchPresentPlayers().map((player) => player.id));
  return ids.every((id) => activeSet.has(id));
}

function renderOnFieldCountWarning() {
  if (!onFieldCountWarningEl || !isStaff()) {
    return;
  }
  if (state.currentStep !== 3) {
    onFieldCountWarningEl.classList.add("hidden");
    onFieldCountWarningEl.innerHTML = "";
    return;
  }
  const n = getActiveOnFieldCount();
  if (n >= LINEUP_STARTER_COUNT) {
    onFieldCountWarningEl.classList.add("hidden");
    onFieldCountWarningEl.innerHTML = "";
    return;
  }
  onFieldCountWarningEl.classList.remove("hidden");
  onFieldCountWarningEl.innerHTML = `<p class="no-margin">⚠️ 出場中の選手が<strong>${LINEUP_STARTER_COUNT}人未満</strong>です（現在<strong>${n}人</strong>）。ベンチの「<strong>出場</strong>」から<strong>交代なしで出場に戻せます</strong>。</p>`;
}

function renderLineupIntegrityBanner() {
  if (!lineupIntegrityBannerEl || !lineupIntegrityBodyEl || !isStaff()) {
    return;
  }
  if (state.currentStep !== 3) {
    lineupIntegrityBannerEl.classList.add("hidden");
    return;
  }
  const match = getSelectedMatchNormalized();
  const missing = getMissingStartingMemberPlayerIds(match);
  if (!missing.length) {
    lineupIntegrityBannerEl.classList.add("hidden");
    return;
  }
  lineupIntegrityBannerEl.classList.remove("hidden");
  lineupIntegrityBodyEl.innerHTML = `
    <p class="no-margin">選択したスターティングメンバーに存在しない選手が含まれています。</p>
    <p class="no-margin"><strong>削除された選手:</strong></p>
    <ul class="lineup-integrity-list">${missing.map((id) => `<li>${escapeHtml(id)}</li>`).join("")}</ul>
  `;
}

function getRosterStartersAndBench() {
  const match = getSelectedMatchNormalized();
  const starterIdsOrdered = Array.isArray(match?.startingMemberIds)
    ? match.startingMemberIds.filter((id) => getMatchPresentPlayers().some((p) => p.id === id))
    : [];
  const eligiblePlayers = getMatchPresentPlayers();
  const activeById = Object.fromEntries(eligiblePlayers.map((player) => [player.id, player]));
  const starters = [];
  const benches = [];
  if (starterIdsOrdered.length === LINEUP_STARTER_COUNT) {
    // スタメン登録メンバーでも「ベンチ」操作後は控え扱い → ベンチ列へ（交代退場はスタメン列のまま）
    starterIdsOrdered.forEach((id) => {
      const p = activeById[id];
      if (!p) {
        return;
      }
      if (isMatchBenchReserve(p.id)) {
        benches.push(p);
      } else {
        starters.push(p);
      }
    });
    eligiblePlayers.forEach((player) => {
      if (!starterIdsOrdered.includes(player.id)) {
        benches.push(player);
      }
    });
  } else {
    eligiblePlayers.forEach((player) => {
      if (isMatchBenchReserve(player.id)) {
        benches.push(player);
      } else {
        starters.push(player);
      }
    });
  }
  return { starters, benches };
}

function getRosterAbsentPlayers() {
  return getTournamentAttendancePlayers().filter((player) => isAbsent(player.id));
}

function buildRosterRowElement(player, { isStarterColumn, isAbsentColumn = false }) {
  const row = document.createElement("div");
  row.className = "roster-row";

  const main = document.createElement("div");
  main.className = "roster-row-main";

  const nameEl = document.createElement("strong");
  nameEl.className = "roster-row-name";
  nameEl.textContent = formatPlayerLabel(player);

  const sub = document.createElement("div");
  sub.className = "roster-row-sub";
  const st = getPlayerStats(player.id);
  const total = stats.reduce((sum, stat) => sum + (st[stat.key] || 0), 0);
  let statusText = "出場中";
  if (isAbsentColumn) {
    statusText = "欠席";
  } else if (isSubstitutedOut(player.id)) {
    statusText = "交代退場";
  } else if (isMatchBenchReserve(player.id)) {
    statusText = "ベンチ";
  }
  const playText =
    isAbsentColumn || (isMatchBenchReserve(player.id) && total === 0)
      ? "—"
      : `計${total}${isMatchBenchReserve(player.id) && total > 0 ? "・保持" : ""}`;
  sub.textContent = `${statusText} · ${playText}`;

  main.append(nameEl, sub);

  const actions = document.createElement("div");
  actions.className = "roster-row-actions";

  const recordBtn = document.createElement("button");
  recordBtn.type = "button";
  recordBtn.className = "sub-btn roster-row-btn";
  if (isSubstitutedOut(player.id)) {
    recordBtn.textContent = "表示";
    recordBtn.title = "記録を表示";
    recordBtn.addEventListener("click", () => {
      state.selectedPlayerId = player.id;
      renderTabs();
      renderStats();
    });
  } else if (!isMatchBenchReserve(player.id)) {
    recordBtn.textContent = "入力";
    recordBtn.title = "記録を入力";
    recordBtn.addEventListener("click", () => {
      state.selectedPlayerId = player.id;
      renderTabs();
      renderStats();
    });
  }

  const enterBtn = document.createElement("button");
  enterBtn.type = "button";
  enterBtn.className = "sub-btn roster-row-btn";
  enterBtn.textContent = "出場";
  enterBtn.title = "出場させる";
  if (!isStarterColumn && isMatchBenchReserve(player.id) && isStaff()) {
    enterBtn.addEventListener("click", () => openSubstitutionConfirmModal(player.id));
  } else {
    enterBtn.classList.add("hidden");
  }

  if (!isAbsentColumn && (!isMatchBenchReserve(player.id) || isSubstitutedOut(player.id))) {
    actions.appendChild(recordBtn);
  }
  if (!isAbsentColumn && !isStarterColumn) {
    actions.appendChild(enterBtn);
  }

  row.append(main, actions);
  return row;
}

function renderMatchRosterPanels() {
  if (!startersRosterBodyEl || !benchRosterBodyEl || !absentRosterBodyEl || !isStaff()) {
    return;
  }
  if (state.currentStep !== 3) {
    return;
  }
  const metaEl = document.getElementById("step3RosterMatchMeta");
  if (metaEl) {
    const match = getSelectedMatchNormalized();
    const tournament = getSelectedTournament();
    const parts = [];
    if (match?.opponent) {
      parts.push(`対戦相手: ${match.opponent}`);
    }
    if (match?.stage) {
      parts.push(`試合区分: ${match.stage}`);
    }
    if (tournament?.name) {
      parts.push(`大会: ${tournament.name}`);
    }
    metaEl.innerHTML = parts
      .map((text) => `<span class="roster-meta-chip">${escapeHtml(text)}</span>`)
      .join("");
  }
  const { starters, benches } = getRosterStartersAndBench();
  const absentees = getRosterAbsentPlayers();
  startersRosterBodyEl.innerHTML = "";
  benchRosterBodyEl.innerHTML = "";
  absentRosterBodyEl.innerHTML = "";
  starters.forEach((player) => startersRosterBodyEl.appendChild(buildRosterRowElement(player, { isStarterColumn: true })));
  benches.forEach((player) => benchRosterBodyEl.appendChild(buildRosterRowElement(player, { isStarterColumn: false })));
  if (!absentees.length) {
    absentRosterBodyEl.innerHTML = '<p class="helper-message no-margin roster-empty-message">欠席者はいません。</p>';
    renderOnFieldCountWarning();
    return;
  }
  absentees.forEach((player) =>
    absentRosterBodyEl.appendChild(buildRosterRowElement(player, { isStarterColumn: false, isAbsentColumn: true })),
  );
  renderOnFieldCountWarning();
}

function closeMatchFlowModal() {
  if (matchFlowModalEl) {
    matchFlowModalEl.classList.add("hidden");
  }
}

function buildMatchFlowSubstitutionConfirmBodyHtml(playerLabelEscaped) {
  return `
    <div class="match-flow-confirm">
      <div class="match-flow-confirm-player">
        <span class="match-flow-confirm-label">選手</span>
        <span class="match-flow-confirm-name">${playerLabelEscaped}</span>
      </div>
      <div class="match-flow-confirm-flow" aria-hidden="true">
        <span class="match-flow-pill match-flow-pill--dim">ベンチ</span>
        <span class="match-flow-arrow">→</span>
        <span class="match-flow-pill match-flow-pill--active">出場中</span>
      </div>
      <p class="match-flow-confirm-footnote">途中交代として記録されます</p>
    </div>
  `;
}

function openMatchFlowModal({ title, bodyHtml, actionButtons }) {
  if (!matchFlowModalEl || !matchFlowModalTitleEl || !matchFlowModalBodyEl || !matchFlowModalActionsEl) {
    return;
  }
  matchFlowModalTitleEl.textContent = title;
  matchFlowModalBodyEl.innerHTML = bodyHtml;
  matchFlowModalActionsEl.innerHTML = "";
  actionButtons.forEach((btn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = btn.label;
    const base = btn.primary ? "primary-btn" : "sub-btn";
    b.className = `${base} match-flow-action-btn`;
    if (btn.primary) {
      b.classList.add("match-flow-action-btn--primary");
    } else {
      b.classList.add("match-flow-action-btn--secondary");
    }
    if (btn.danger) {
      b.classList.add("danger-btn", "match-flow-action-btn--danger");
    }
    b.addEventListener("click", btn.onClick);
    matchFlowModalActionsEl.appendChild(b);
  });
  matchFlowModalEl.classList.remove("hidden");
}

function applyDirectBenchReturn(playerId) {
  if (!isStaff()) {
    return;
  }
  const cur = getPlayerStats(playerId);
  const { isBench: _removed, ...rest } = cur;
  const next = { ...rest };
  next.attackFailure = getAttackFailureFromRecord(next);
  state.records[playerId] = recordHasAnyStattedPlays(next) ? next : {};
  state.selectedPlayerId = playerId;
  renderTabs();
  renderStats();
  queueAutoSave();
}

function openSubstitutionConfirmModal(benchPlayerId) {
  const benchPlayer = players.find((p) => p.id === benchPlayerId);
  if (!benchPlayer || !isMatchBenchReserve(benchPlayerId)) {
    return;
  }
  const onField = getActiveOnFieldCount();
  if (onField < LINEUP_STARTER_COUNT) {
    openMatchFlowModal({
      title: "出場に戻す",
      bodyHtml: `
        <div class="match-flow-confirm match-flow-confirm--plain">
          <p class="match-flow-lead">出場中は <strong>${onField}人</strong>（目安 ${LINEUP_STARTER_COUNT}人）</p>
          <p class="match-flow-desc">空きがあるため、<strong>交代の記録なし</strong>で出場に戻せます。</p>
        </div>
      `,
      actionButtons: [
        {
          label: "キャンセル",
          onClick: () => closeMatchFlowModal(),
        },
        {
          label: "出場に戻す",
          primary: true,
          onClick: () => {
            applyDirectBenchReturn(benchPlayerId);
            closeMatchFlowModal();
          },
        },
      ],
    });
    return;
  }
  openMatchFlowModal({
    title: "出場の確認",
    bodyHtml: buildMatchFlowSubstitutionConfirmBodyHtml(escapeHtml(formatPlayerLabel(benchPlayer))),
    actionButtons: [
      {
        label: "キャンセル",
        onClick: () => closeMatchFlowModal(),
      },
      {
        label: "出場させる",
        primary: true,
        onClick: () => {
          closeMatchFlowModal();
          openSubstitutionRecordModal(benchPlayerId);
        },
      },
    ],
  });
}

function openSubstitutionRecordModal(benchPlayerId) {
  const benchPlayer = players.find((p) => p.id === benchPlayerId);
  if (!benchPlayer) {
    return;
  }
  const outs = getMatchPresentPlayers().filter((p) => !isBenched(p.id));
  if (!outs.length) {
    openMatchFlowModal({
      title: "途中交代を記録できません",
      bodyHtml:
        "<div class=\"match-flow-prose\"><p class=\"match-flow-prose-lead\">交代で退場させる出場中の選手がいません。</p></div>",
      actionButtons: [{ label: "閉じる", onClick: () => closeMatchFlowModal() }],
    });
    return;
  }
  const selectId = `subOutSelect-${benchPlayerId}`;
  const timeId = `subTimeInput-${benchPlayerId}`;
  const bodyHtml = `
    <div class="match-flow-form">
      <div class="match-flow-form-group match-flow-form-group--highlight">
        <span class="match-flow-form-label">出場する選手</span>
        <span class="match-flow-form-value">${escapeHtml(formatPlayerLabel(benchPlayer))}</span>
      </div>
      <label class="match-flow-field">
        <span class="match-flow-field-label">交代する選手</span>
        <select id="${selectId}" class="match-flow-select roster-modal-select">
        ${outs
          .map(
            (p) =>
              `<option value="${escapeHtml(p.id)}">${escapeHtml(formatPlayerLabel(p))}</option>`,
          )
          .join("")}
        </select>
      </label>
      <label class="match-flow-field">
        <span class="match-flow-field-label">交代時刻（任意）</span>
        <input id="${timeId}" type="text" class="match-flow-input roster-modal-input" placeholder="例: 3期" />
      </label>
    </div>
  `;
  openMatchFlowModal({
    title: "途中交代の記録",
    bodyHtml,
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "記録",
        primary: true,
        onClick: () => {
          const sel = document.getElementById(selectId);
          const timeEl = document.getElementById(timeId);
          const outId = sel?.value;
          if (!outId) {
            return;
          }
          applySubstitutionToState(benchPlayerId, outId, timeEl?.value?.trim() ?? "");
          closeMatchFlowModal();
        },
      },
    ],
  });
}

function applySubstitutionToState(inStudentId, outStudentId, timeLabel) {
  if (!isStaff()) {
    return;
  }
  const outStats = { ...getPlayerStats(outStudentId) };
  const retired = {
    ...outStats,
    isBench: true,
    retiredBySubstitution: true,
  };
  retired.attackFailure = getAttackFailureFromRecord(retired);

  const inPrev = getPlayerStats(inStudentId);
  const inNext = inPrev.isBench ? {} : { ...inPrev };
  inNext.isBench = false;
  delete inNext.retiredBySubstitution;
  inNext.attackFailure = getAttackFailureFromRecord(inNext);

  state.records[outStudentId] = retired;
  state.records[inStudentId] = inNext;
  state.matchSubstitutions = [
    ...state.matchSubstitutions,
    {
      inStudentId,
      outStudentId,
      time: timeLabel || "",
      timestamp: Date.now(),
    },
  ];
  state.selectedPlayerId = inStudentId;
  renderTabs();
  renderStats();
  refreshValidationState();
  queueAutoSave();
}

function seedLineupDraftFromMatchAndRecords() {
  const match = getSelectedMatchNormalized();
  const activeIds = new Set(getMatchPresentPlayers().map((player) => player.id));
  if (matchHasValidSavedLineup(match)) {
    state.lineupDraftIds = [...match.startingMemberIds];
    return;
  }
  if (Array.isArray(match?.startingMemberIds) && match.startingMemberIds.length) {
    state.lineupDraftIds = match.startingMemberIds.filter((id) => activeIds.has(id));
    return;
  }
  const fromRecords = getMatchPresentPlayers()
    .filter((player) => !isBenched(player.id))
    .map((player) => player.id);
  if (fromRecords.length === LINEUP_STARTER_COUNT) {
    state.lineupDraftIds = fromRecords;
    return;
  }
  state.lineupDraftIds = [];
}

function setLineupValidationMessage(html, tone) {
  if (!lineupValidationMessageEl) {
    return;
  }
  lineupValidationMessageEl.innerHTML = html;
  lineupValidationMessageEl.classList.remove("lineup-msg-error", "lineup-msg-warn", "lineup-msg-ok", "hidden");
  if (!html) {
    lineupValidationMessageEl.classList.add("hidden");
    return;
  }
  if (tone) {
    lineupValidationMessageEl.classList.add(tone);
  }
}

function renderLineupPickPanel() {
  if (!lineupPlayerCheckboxListEl || !lineupSelectedCountEl) {
    return;
  }
  state.lineupUiPhase = "pick";
  lineupPickWrapEl?.classList.remove("hidden");
  if (lineupConfirmPanelEl) {
    lineupConfirmPanelEl.classList.add("hidden");
  }
  if (lineupPickActionsEl) {
    lineupPickActionsEl.classList.remove("hidden");
  }
  const activePlayers = getMatchPresentPlayers();
  lineupPlayerCheckboxListEl.innerHTML = "";
  activePlayers.forEach((player) => {
    const label = document.createElement("label");
    label.className = "lineup-check-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = player.id;
    cb.checked = state.lineupDraftIds.includes(player.id);
    cb.addEventListener("change", () => {
      const set = new Set(state.lineupDraftIds);
      if (cb.checked) {
        if (set.size >= LINEUP_STARTER_COUNT) {
          cb.checked = false;
          setLineupValidationMessage(
            `<p class="no-margin">⚠️ スターティングメンバーは${LINEUP_STARTER_COUNT}人までです。</p>`,
            "lineup-msg-warn",
          );
          return;
        }
        set.add(player.id);
      } else {
        set.delete(player.id);
      }
      state.lineupDraftIds = [...set];
      setLineupValidationMessage("", "");
      renderLineupPickPanel();
    });
    const span = document.createElement("span");
    span.textContent = formatPlayerLabel(player);
    label.append(cb, span);
    lineupPlayerCheckboxListEl.appendChild(label);
  });
  lineupSelectedCountEl.textContent = String(state.lineupDraftIds.length);
}

function showLineupConfirmSummary() {
  state.lineupUiPhase = "confirm";
  lineupPickWrapEl?.classList.add("hidden");
  if (lineupPickActionsEl) {
    lineupPickActionsEl.classList.add("hidden");
  }
  if (lineupConfirmPanelEl) {
    lineupConfirmPanelEl.classList.remove("hidden");
  }
  if (lineupConfirmNamesEl) {
    const ordered = state.lineupDraftIds
      .map((id, index) => {
        const p = players.find((x) => x.id === id);
        return `<li>${index + 1}. ${escapeHtml(p ? formatPlayerLabel(p) : id)}</li>`;
      })
      .join("");
    lineupConfirmNamesEl.innerHTML = `<ol class="lineup-confirm-ol">${ordered}</ol>`;
  }
  setLineupValidationMessage(
    `<p class="no-margin lineup-msg-title-ok">✅ スターティングメンバーが確定しました</p>
     <p class="no-margin">選択: ${LINEUP_STARTER_COUNT}人</p>
     <p class="no-margin">残りの選手はベンチ欄に自動で移動します。</p>`,
    "lineup-msg-ok",
  );
}

function applyLineupDraftToRecordsAndPersist(starterIds) {
  const activePlayers = getMatchPresentPlayers();
  const starterSet = new Set(starterIds);
  activePlayers.forEach((player) => {
    if (starterSet.has(player.id)) {
      const prev = getPlayerStats(player.id);
      const next = { ...prev };
      next.isBench = false;
      delete next.retiredBySubstitution;
      delete next.absent;
      next.attackFailure = getAttackFailureFromRecord(next);
      state.records[player.id] = next;
    } else {
      state.records[player.id] = { isBench: true };
    }
  });
  getTournamentAttendancePlayers().forEach((player) => {
    if (state.attendanceDraft[player.id] === "absent" || isAbsent(player.id)) {
      state.records[player.id] = { absent: true };
    }
  });
  state.matchSubstitutions = [];
}

async function persistStartingLineupToFirebase(starterIds) {
  if (!db || !state.selectedTournamentId || !state.selectedMatchId) {
    return;
  }
  const match = currentMatches.find((m) => m.id === state.selectedMatchId);
  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    SakuraOfflineSync.enqueue("match_update", {
      tournamentId: state.selectedTournamentId,
      matchId: state.selectedMatchId,
      opponent: match?.opponent ?? "",
      stage: match?.stage ?? "予選",
      opponentCategory: match?.opponentCategory ?? "",
      startingMemberIds: starterIds,
      substitutions: [],
    });
    currentMatches = currentMatches.map((m) =>
      m.id === state.selectedMatchId
        ? { ...m, startingMemberIds: starterIds, substitutions: [], updatedAt: Date.now() }
        : m,
    );
    renderMatchOptions(currentMatches);
    persistRtdbSnapshot();
    return;
  }
  try {
    await getMatchRef(state.selectedTournamentId, state.selectedMatchId).update({
      startingMemberIds: starterIds,
      substitutions: [],
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    const matches = await loadMatchesByTournament(state.selectedTournamentId);
    renderMatchOptions(matches);
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    const code = error?.code ?? "unknown";
    if (
      typeof SakuraOfflineSync !== "undefined" &&
      (code === "unavailable" || code === "network-request-failed" || !navigator.onLine)
    ) {
      SakuraOfflineSync.enqueue("match_update", {
        tournamentId: state.selectedTournamentId,
        matchId: state.selectedMatchId,
        opponent: match?.opponent ?? "",
        stage: match?.stage ?? "予選",
        opponentCategory: match?.opponentCategory ?? "",
        startingMemberIds: starterIds,
        substitutions: [],
      });
      currentMatches = currentMatches.map((m) =>
        m.id === state.selectedMatchId
          ? { ...m, startingMemberIds: starterIds, substitutions: [], updatedAt: Date.now() }
          : m,
      );
      renderMatchOptions(currentMatches);
      persistRtdbSnapshot();
      return;
    }
    throw error;
  }
}

function seedAttendanceDraftFromRecords() {
  const draft = {};
  getTournamentAttendancePlayers().forEach((player) => {
    draft[player.id] = isAbsent(player.id) ? "absent" : "present";
  });
  state.attendanceDraft = draft;
}

function renderAttendancePanel() {
  if (!attendancePlayerListEl) {
    return;
  }
  attendancePlayerListEl.innerHTML = "";
  const playersForAttendance = getTournamentAttendancePlayers();
  if (!playersForAttendance.length) {
    attendancePlayerListEl.innerHTML =
      '<p class="helper-message no-margin">大会参加メンバーがいません。大会編集で参加メンバーを設定してください。</p>';
    return;
  }
  playersForAttendance.forEach((player) => {
    const status = state.attendanceDraft[player.id] === "absent" ? "absent" : "present";
    const row = document.createElement("div");
    row.className = "attendance-row";
    const nameEl = document.createElement("span");
    nameEl.className = "attendance-row-name";
    nameEl.textContent = formatPlayerLabel(player);
    const controls = document.createElement("div");
    controls.className = "attendance-row-controls";
    const presentBtn = document.createElement("button");
    presentBtn.type = "button";
    presentBtn.className = `attendance-toggle-btn${status === "present" ? " is-active" : ""}`;
    presentBtn.textContent = "参加";
    presentBtn.addEventListener("click", () => {
      state.attendanceDraft[player.id] = "present";
      renderAttendancePanel();
    });
    const absentBtn = document.createElement("button");
    absentBtn.type = "button";
    absentBtn.className = `attendance-toggle-btn is-absent${status === "absent" ? " is-active" : ""}`;
    absentBtn.textContent = "欠席";
    absentBtn.addEventListener("click", () => {
      state.attendanceDraft[player.id] = "absent";
      renderAttendancePanel();
    });
    controls.append(presentBtn, absentBtn);
    row.append(nameEl, controls);
    attendancePlayerListEl.appendChild(row);
  });
}

function setMatchFlowSummaryOnElement(elementId, match) {
  const el = document.getElementById(elementId);
  if (!el) {
    return;
  }
  const summaryParts = [getSelectedTournament()?.name, match?.stage, match?.opponent].filter(Boolean);
  el.textContent = summaryParts.length ? summaryParts.join(" | ") : "";
}

function openAttendanceStepAfterLoad() {
  seedAttendanceDraftFromRecords();
  state.currentStep = 2.25;
  showStep(2.25);
  setMatchFlowSummaryOnElement("attendanceMatchSummary", getSelectedMatchNormalized());
  if (attendanceConfirmButtonEl) {
    attendanceConfirmButtonEl.textContent = matchHasValidSavedLineup(getSelectedMatchNormalized())
      ? "次へ：記録入力"
      : "次へ：スタメン選択";
  }
  renderAttendancePanel();
}

function playerHasAttendanceConflict(playerId, nextStatus) {
  if (nextStatus !== "absent") {
    return false;
  }
  const cur = getPlayerStats(playerId);
  if (isAbsentRecord(cur)) {
    return false;
  }
  return recordHasAnyStattedPlays(cur) || Boolean(cur.isBench && cur.retiredBySubstitution);
}

function applyAttendanceDraftToRecords() {
  getTournamentAttendancePlayers().forEach((player) => {
    const id = player.id;
    const nextStatus = state.attendanceDraft[id] === "absent" ? "absent" : "present";
    if (nextStatus === "absent") {
      state.records[id] = { absent: true };
      return;
    }
    const cur = getPlayerStats(id);
    if (isAbsentRecord(cur)) {
      state.records[id] = {};
    }
  });
}

function proceedAfterAttendanceConfirmed() {
  applyAttendanceDraftToRecords();
  const match = getSelectedMatchNormalized();
  if (matchHasValidSavedLineup(match)) {
    state.currentStep = 3;
    showStep(3);
    renderTabs();
    renderStats();
    queueAutoSave();
    return;
  }
  openLineupStepAfterLoad();
}

function confirmAttendanceAndProceed() {
  const conflicts = getTournamentAttendancePlayers().filter((player) =>
    playerHasAttendanceConflict(player.id, state.attendanceDraft[player.id]),
  );
  if (!conflicts.length) {
    proceedAfterAttendanceConfirmed();
    return;
  }
  const names = conflicts.map((p) => escapeHtml(formatPlayerLabel(p))).join("、");
  openMatchFlowModal({
    title: "欠席に変更しますか？",
    bodyHtml: `
      <div class="match-flow-prose">
        <p class="match-flow-prose-lead">次の選手はすでに記録があります。欠席にすると<strong>この試合の記録は消えます</strong>。</p>
        <p class="no-margin">${names}</p>
      </div>
    `,
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "欠席にして続行",
        primary: true,
        danger: true,
        onClick: () => {
          closeMatchFlowModal();
          proceedAfterAttendanceConfirmed();
        },
      },
    ],
  });
}

function openLineupStepAfterLoad() {
  seedLineupDraftFromMatchAndRecords();
  state.lineupUiPhase = "pick";
  state.currentStep = 2.5;
  showStep(2.5);
  setLineupValidationMessage("", "");
  renderLineupPickPanel();
  setMatchFlowSummaryOnElement("lineupMatchSummary", getSelectedMatchNormalized());
}

function openUnsavedLeaveModal(onDiscard, onSaveThenLeave) {
  openMatchFlowModal({
    title: "試合を閉じますか？",
    bodyHtml:
      "<div class=\"match-flow-prose\"><p class=\"match-flow-prose-lead\">保存されていない変更があります。</p><p class=\"match-flow-prose-muted\">続ける前に保存するか、破棄するかを選んでください。</p></div>",
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "保存しないで閉じる",
        danger: true,
        onClick: () => {
          closeMatchFlowModal();
          onDiscard();
        },
      },
      {
        label: "保存して閉じる",
        primary: true,
        onClick: async () => {
          await saveCurrentMatchRecords(false);
          closeMatchFlowModal();
          onSaveThenLeave();
        },
      },
    ],
  });
}

function validateLineupDraftAndProceed() {
  const presentCount = getMatchPresentPlayers().filter((player) => !isGuestPlayerId(player.id)).length;
  if (presentCount < LINEUP_STARTER_COUNT) {
    setLineupValidationMessage(
      `<p class="no-margin">❌ 参加選手が不足しています</p>
       <p class="no-margin">この試合の参加は${presentCount}人です。スタメン${LINEUP_STARTER_COUNT}人を選ぶには、参加状況で欠席を減らしてください。</p>`,
      "lineup-msg-error",
    );
    return;
  }
  const n = state.lineupDraftIds.length;
  if (n === 0) {
    setLineupValidationMessage(
      `<p class="no-margin">❌ スターティングメンバーが選択されていません</p>
       <p class="no-margin">最低${LINEUP_STARTER_COUNT}人のスターティングメンバーを選択してください。</p>`,
      "lineup-msg-error",
    );
    return;
  }
  if (n > LINEUP_STARTER_COUNT) {
    setLineupValidationMessage(
      `<p class="no-margin">❌ 出場人数オーバー</p>
       <p class="no-margin">⚠️ スターティングメンバーは${LINEUP_STARTER_COUNT}人までです。<br/>現在: ${n}人選択</p>
       <p class="no-margin">${n - LINEUP_STARTER_COUNT}人削除してください。</p>`,
      "lineup-msg-error",
    );
    return;
  }
  if (n < LINEUP_STARTER_COUNT) {
    const lack = LINEUP_STARTER_COUNT - n;
    setLineupValidationMessage(
      `<p class="no-margin">⚠️ スターティングメンバーが足りません</p>
       <p class="no-margin">選択: ${n}人 / 必要: ${LINEUP_STARTER_COUNT}人</p>
       <p class="no-margin">あと ${lack}人 選択してください。</p>`,
      "lineup-msg-warn",
    );
    return;
  }
  showLineupConfirmSummary();
}

function openMidMatchAddPlayerModal() {
  const uid = `mm-${Date.now()}`;
  const nameId = `midAddName-${uid}`;
  const gradeId = `midAddGrade-${uid}`;
  const roleId = `midAddRole-${uid}`;
  const handId = `midAddHand-${uid}`;
  openMatchFlowModal({
    title: "試合中に新規選手を追加",
    bodyHtml: `
      <div class="form-grid match-flow-form match-flow-form--grid">
        <label>選手名 <input id="${nameId}" type="text" placeholder="例: 田中 太郎" /></label>
        <label>学年
          <select id="${gradeId}">
            <option value="">選択してください</option>
            <option value="1">1年 / ①</option>
            <option value="2">2年 / ②</option>
            <option value="3">3年 / ③</option>
          </select>
        </label>
        <label>役割
          <select id="${roleId}">
            <option value="">なし</option>
            <option value="captain">キャプテン / C</option>
            <option value="viceCaptain">副キャプテン / VC</option>
          </select>
        </label>
        <label>利き手
          <select id="${handId}">
            <option value="">未設定</option>
            <option value="right">右</option>
            <option value="left">左</option>
            <option value="both">両</option>
          </select>
        </label>
      </div>
    `,
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "追加",
        primary: true,
        onClick: async () => {
          const name = document.getElementById(nameId)?.value?.trim() ?? "";
          const grade = document.getElementById(gradeId)?.value ?? "";
          const role = document.getElementById(roleId)?.value ?? "";
          const handedness = document.getElementById(handId)?.value ?? "";
          if (!name) {
            setSaveStatus("選手名を入力してください");
            return;
          }
          if (!grade) {
            setSaveStatus("学年を選択してください");
            return;
          }
          if (!db) {
            setSaveStatus("Firebase未接続（設定待ち）");
            return;
          }
          const ref = getPlayersRef().push();
          await ref.set({
            id: ref.key,
            name,
            grade,
            role,
            handedness,
            memo: "",
            active: true,
            order: players.length,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
          });
          closeMatchFlowModal();
          await loadPlayersFromRealtimeDatabase();
          state.records[ref.key] = { isBench: true };
          state.selectedPlayerId = ref.key;
          renderTabs();
          renderStats();
          queueAutoSave();
          setSaveStatus("選手を追加しベンチに登録しました");
        },
      },
    ],
  });
}

function hasUnsavedRecordChanges() {
  return saveStatusEl.classList.contains("is-dirty") || saveStatusEl.classList.contains("is-saving");
}

function renderTabs() {
  tabsEl.innerHTML = "";
  const visiblePlayers = getVisiblePlayers();
  if (!visiblePlayers.find((player) => player.id === state.selectedPlayerId)) {
    state.selectedPlayerId = visiblePlayers[0]?.id ?? "";
  }
  visiblePlayers.forEach((player) => {
    const btn = document.createElement("button");
    btn.className = `tab ${player.id === state.selectedPlayerId ? "active" : ""}`;
    btn.textContent = isMatchBenchReserve(player.id)
      ? `${formatPlayerLabel(player)}（ベンチ）`
      : isSubstitutedOut(player.id)
        ? `${formatPlayerLabel(player)}（交代退場）`
        : formatPlayerLabel(player);
    btn.addEventListener("click", () => {
      state.selectedPlayerId = player.id;
      renderTabs();
      renderStats();
    });
    tabsEl.appendChild(btn);
  });
  renderMatchRosterPanels();
}

function renderStats() {
  const player = getCurrentPlayer();
  if (!player) {
    currentPlayerNameEl.textContent = "選手データがありません";
    statsAreaEl.innerHTML = "";
    totalPlaysEl.textContent = "0";
    playerBenchStatusEl.textContent = "";
    benchMessageEl.classList.add("hidden");
    toggleBenchButtonEl.disabled = !isStaff();
    renderRecordSummary();
    renderMatchRosterPanels();
    renderLineupIntegrityBanner();
    return;
  }
  const playerStats = getPlayerStats(player.id);
  const reserveBench = isMatchBenchReserve(player.id);
  const retired = isSubstitutedOut(player.id);
  const benched = isBenched(player.id);
  currentPlayerNameEl.textContent = `選手記録: ${formatPlayerLabel(player)}`;
  if (retired) {
    playerBenchStatusEl.textContent = "現在: 交代で退場（記録は表示のみ）";
  } else {
    playerBenchStatusEl.textContent = benched ? "現在: ベンチ中" : "現在: 出場中";
  }
  toggleBenchButtonEl.textContent = benched ? "出場に戻す" : "ベンチ";
  if (togglePlayerActiveButtonEl) {
    togglePlayerActiveButtonEl.textContent = player.active === false ? "選手を再表示" : "選手を非表示";
  }

  statsAreaEl.innerHTML = "";
  benchMessageEl.classList.toggle("hidden", !reserveBench);
  benchMessageEl.textContent = retired
    ? "この選手は途中交代で退場済みです。これ以降のプレーは集計されません。"
    : "ベンチ登録中のため、この選手の試合記録入力は非表示です。";

  if (reserveBench) {
    const preservedTotal = stats.reduce((sum, stat) => sum + (playerStats[stat.key] || 0), 0);
    totalPlaysEl.textContent = String(preservedTotal);
    benchMessageEl.textContent =
      preservedTotal > 0
        ? "ベンチ中のため入力はできません。すでに付いた記録は保持され、出場に戻すと再び入力できます。"
        : "ベンチ登録中のため、この選手の試合記録入力は非表示です。";
    toggleBenchButtonEl.disabled = !isStaff();
    renderRecordSummary();
    renderMatchRosterPanels();
    renderLineupIntegrityBanner();
    refreshValidationState();
    return;
  }

  if (retired) {
    let total = 0;
    stats.forEach((stat) => {
      const value = playerStats[stat.key] || 0;
      total += value;
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("span");
      label.textContent = stat.label;
      const val = document.createElement("span");
      val.className = "value";
      val.textContent = String(value);
      row.append(label, val);
      statsAreaEl.appendChild(row);
    });
    totalPlaysEl.textContent = String(total);
    toggleBenchButtonEl.disabled = !isStaff() || retired;
    renderRecordSummary();
    renderMatchRosterPanels();
    renderLineupIntegrityBanner();
    refreshValidationState();
    return;
  }

  let total = 0;

  stats.forEach((stat) => {
    const value = playerStats[stat.key] || 0;
    total += value;

    const row = document.createElement("div");
    row.className = "row";

    const label = document.createElement("span");
    label.textContent = stat.label;

    const counter = document.createElement("div");
    counter.className = "counter";

    const minus = document.createElement("button");
    minus.className = "btn";
    minus.textContent = "-";
    minus.disabled = !isStaff();
    minus.addEventListener("click", () => updateStat(player.id, stat.key, -1));

    const val = document.createElement("span");
    val.className = "value";
    val.textContent = String(value);

    const plus = document.createElement("button");
    plus.className = "btn plus";
    plus.textContent = "+";
    plus.disabled = !isStaff();
    plus.addEventListener("click", () => updateStat(player.id, stat.key, 1));

    counter.append(minus, val, plus);
    row.append(label, counter);
    statsAreaEl.appendChild(row);
  });

  totalPlaysEl.textContent = String(total);
  toggleBenchButtonEl.disabled = !isStaff();
  renderRecordSummary();
  renderMatchRosterPanels();
  renderLineupIntegrityBanner();
  refreshValidationState();
}

function setSaveStatus(text) {
  setSaveState(text, "", "");
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setSaveState(status, detail = "", tone = "") {
  saveStatusEl.textContent = status;
  saveStatusDetailEl.textContent = detail;
  saveStatusEl.classList.remove("is-dirty", "is-saving", "is-saved", "is-error");
  if (tone) {
    saveStatusEl.classList.add(tone);
  }
}

function clearAutoSaveCountdown() {
  if (state.autoSaveCountdownId) {
    window.clearInterval(state.autoSaveCountdownId);
    state.autoSaveCountdownId = null;
  }
  state.autoSaveDueAt = null;
}

function renderSaveHistory() {
  if (!state.currentMatchSaveHistory.length) {
    saveHistoryListEl.innerHTML = '<div class="save-history-item">まだ保存履歴はありません。</div>';
    return;
  }

  saveHistoryListEl.innerHTML = state.currentMatchSaveHistory
    .map(
      (item) => `
        <div class="save-history-item">${item.time} / ${item.label}</div>
      `,
    )
    .join("");
}

function setLastUpdatedAt(timestamp) {
  state.currentMatchLastUpdatedAt = timestamp || null;
  lastUpdatedTextEl.textContent = timestamp
    ? `最終更新: ${formatTime(timestamp)}`
    : "最終更新: 未保存";
}

function pushSaveHistory(label, timestamp = Date.now()) {
  state.currentMatchSaveHistory = [
    { label, time: formatTime(timestamp) },
    ...state.currentMatchSaveHistory,
  ].slice(0, 5);
  renderSaveHistory();
}

function resetMatchSaveMeta(updatedAt = null) {
  state.currentMatchSaveHistory = [];
  renderSaveHistory();
  setLastUpdatedAt(updatedAt);
}

function startAutoSaveCountdown() {
  clearAutoSaveCountdown();
  state.autoSaveDueAt = Date.now() + AUTO_SAVE_DELAY_MS;

  const updateCountdown = () => {
    if (!state.autoSaveDueAt) {
      return;
    }
    const remainingMs = Math.max(0, state.autoSaveDueAt - Date.now());
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    setSaveState("自動保存待ち", `${remainingSeconds}秒後に自動保存します`, "is-dirty");
  };

  updateCountdown();
  state.autoSaveCountdownId = window.setInterval(() => {
    if (!state.autoSaveDueAt) {
      clearAutoSaveCountdown();
      return;
    }
    updateCountdown();
  }, 250);
}

function setValidationMessage(message) {
  validationMessageEl.textContent = message;
  validationMessageEl.classList.toggle("hidden", !message);
}

function setTournamentHelpText(message) {
  tournamentHelpTextEl.textContent = message;
}

function setMatchHelpText(message) {
  matchHelpTextEl.textContent = message;
}

function setViewerEmptyState(message) {
  viewerEmptyStateEl.textContent = message;
  viewerEmptyStateEl.classList.toggle("hidden", !message);
}

function validateCurrentRecords() {
  const errors = [];

  getTournamentEligiblePlayers().forEach((player) => {
    const playerStats = getPlayerStats(player.id);
    if (!playerStats) {
      return;
    }

    if (isAbsentRecord(playerStats)) {
      return;
    }

    if (playerStats.isBench) {
      if (playerStats.retiredBySubstitution) {
        return;
      }
      return;
    }

    const attackSuccess = playerStats.attackSuccess || 0;
    const attackFailure = getAttackFailureFromRecord(playerStats);
    if (attackFailure < 0) {
      errors.push(`${player.name} のアタック失敗数が不正です。`);
    }
    if (attackSuccess < 0) {
      errors.push(`${player.name} のアタック成功数が不正です。`);
    }
  });

  return errors;
}

function refreshValidationState() {
  if (!isStaff() || !state.selectedTournamentId || !state.selectedMatchId) {
    setValidationMessage("");
    renderCheckMode();
    return true;
  }

  const errors = validateCurrentRecords();
  if (!errors.length) {
    setValidationMessage("");
    renderCheckMode();
    return true;
  }

  setValidationMessage(errors[0]);
  renderCheckMode();
  return false;
}

function renderTournamentOptions(tournaments) {
  currentTournaments = tournaments;
  const validIds = new Set(tournaments.map((t) => t.id));
  state.exportSelectedTournamentIds = state.exportSelectedTournamentIds.filter((id) => validIds.has(id));
  if (!state.exportSelectedTournamentIds.length && tournaments.length) {
    state.exportSelectedTournamentIds = [state.selectedTournamentId || tournaments[0].id];
  }
  tournamentSelectEl.innerHTML = "";
  if (!tournaments.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "大会がありません";
    tournamentSelectEl.appendChild(option);
    state.selectedTournamentId = "";
    setTournamentHelpText(
      isStaff()
        ? "まだ大会がありません。右上の「+ 新規大会を追加」から最初の大会を作成してください。"
        : "公開されている大会がまだありません。編集モードで大会が追加されると閲覧できます。",
    );
    applyPermission();
    return;
  }

  if (!isStaff()) {
    const allOption = document.createElement("option");
    allOption.value = TOURNAMENT_SELECT_ALL;
    allOption.textContent = "全ての試合";
    tournamentSelectEl.appendChild(allOption);
  }

  tournaments.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    const dateText = item.date ? `（${item.date}）` : "";
    option.textContent = `${item.name}${dateText}`;
    tournamentSelectEl.appendChild(option);
  });

  const isViewerVirtualSelection = !isStaff() && state.selectedTournamentId === TOURNAMENT_SELECT_ALL;
  if (!state.selectedTournamentId || (!tournaments.find((t) => t.id === state.selectedTournamentId) && !isViewerVirtualSelection)) {
    state.selectedTournamentId = isStaff() ? tournaments[0].id : TOURNAMENT_SELECT_ALL;
  }
  tournamentSelectEl.value = state.selectedTournamentId;
  const selected = tournaments.find((t) => t.id === state.selectedTournamentId);
  fillTournamentMetaInputs(selected);
  setTournamentHelpText(
    isStaff()
      ? "大会を選んで次へ進むか、新規作成・編集を行ってください。"
      : "大会を選ぶか「全ての試合」を選ぶと、対象の集計成績を閲覧できます。",
  );
  applyPermission();
}

function renderMatchOptions(matches) {
  const byDateAsc = (a, b) => {
    const ao = Number(a.displayOrder);
    const bo = Number(b.displayOrder);
    const ah = Number.isFinite(ao);
    const bh = Number.isFinite(bo);
    if (ah && bh && ao !== bo) return ao - bo;
    if (ah && !bh) return -1;
    if (!ah && bh) return 1;
    const ad = String(a.date || "");
    const bd = String(b.date || "");
    if (ad !== bd) return ad.localeCompare(bd, "ja");
    return String(a.createdAt || 0).localeCompare(String(b.createdAt || 0), "ja");
  };
  const sorted = [...matches].sort(byDateAsc);
  currentMatches = sorted;
  matchSelectEl.innerHTML = "";
  if (!sorted.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "試合がありません";
    matchSelectEl.appendChild(option);
    state.selectedMatchId = "";
    setMatchHelpText(
      isStaff()
        ? "この大会にはまだ試合がありません。「+ 新規試合を追加」から試合を作成してください。"
        : "この大会にはまだ閲覧できる試合データがありません。",
    );
    applyPermission();
    return;
  }

  sorted.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    const tournament = getSelectedTournament();
    const tournamentName = item.tournamentName || tournament?.name || "大会名未設定";
    const tournamentDate = item.tournamentDate || tournament?.date || "";
    const tournamentLabel = tournamentDate ? `${tournamentName}（${tournamentDate}）` : tournamentName;
    const orderLabel = Number.isFinite(Number(item.displayOrder)) ? `第${Number(item.displayOrder)}試合 / ` : "";
    option.textContent = `${orderLabel}${tournamentLabel} / ${item.stage || "区分未設定"} / ${item.opponent || "対戦相手未設定"}`;
    matchSelectEl.appendChild(option);
  });

  if (state.selectedMatchId && sorted.find((m) => m.id === state.selectedMatchId)) {
    matchSelectEl.value = state.selectedMatchId;
  } else {
    state.selectedMatchId = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "試合を選択してください";
    placeholder.selected = true;
    placeholder.disabled = true;
    matchSelectEl.prepend(placeholder);
    matchSelectEl.value = "";
  }
  setMatchHelpText(
    isStaff()
      ? "試合を選んで次へ進むか、新規作成・編集を行ってください。"
      : "試合を選択すると、選択中大会の詳細データを確認できます。",
  );
  renderMatchOrderManagementList();
  renderOpponentTeamShortcuts();
  applyPermission();
}

function fillMatchMetaInputs(match) {
  const tournament = getSelectedTournament();
  const defaultCategory = tournament?.defaultOpponentCategory ?? "";
  const mode = tournament?.opponentCategoryMode ?? "per_match";
  if (!match) {
    opponentEl.value = "";
    matchStageEl.value = "予選";
    matchOpponentCategoryEl.value = mode === "fixed" ? defaultCategory : "";
    return;
  }

  opponentEl.value = match.opponent ?? "";
  matchStageEl.value = match.stage ?? "予選";
  matchOpponentCategoryEl.value = mode === "fixed" ? defaultCategory : match.opponentCategory ?? "";
  matchOpponentCategoryEl.disabled = mode === "fixed" || !isStaff();
}

function fillTournamentMetaInputs(tournament) {
  if (tournament) {
    tournamentDateEl.value = tournament.date ?? "";
    tournamentMatchTypeEl.value = tournament.matchType ?? "大会";
    tournamentOpponentCategoryModeEl.value = tournament.opponentCategoryMode ?? "per_match";
    tournamentDefaultOpponentCategoryEl.value = tournament.defaultOpponentCategory ?? "";
    if (newTournamentOpponentTeamsEl) {
      newTournamentOpponentTeamsEl.value = formatOpponentTeamNames(tournament.opponentTeamNames);
    }
    state.newTournamentParticipantIds = getTournamentParticipantIds(tournament);
  } else {
    tournamentOpponentCategoryModeEl.value = "per_match";
    tournamentDefaultOpponentCategoryEl.value = "";
    if (newTournamentOpponentTeamsEl) {
      newTournamentOpponentTeamsEl.value = "";
    }
    state.newTournamentParticipantIds = getParticipantSelectablePlayers().map((player) => player.id);
  }
  tournamentDefaultOpponentCategoryEl.disabled =
    tournamentOpponentCategoryModeEl.value !== "fixed" || !isStaff();
  renderTournamentParticipantLists();
  renderOpponentTeamShortcuts();
}

function renderOpponentTeamShortcuts() {
  if (!opponentTeamShortcutAreaEl) return;
  opponentTeamShortcutAreaEl.innerHTML = "";
  const teamNames = normalizeOpponentTeamNames(getSelectedTournament()?.opponentTeamNames);
  if (!teamNames.length) {
    const empty = document.createElement("p");
    empty.className = "helper-message no-margin";
    empty.textContent = "大会作成・編集で参加チームを登録すると、ここにコピー用ボタンが表示されます。";
    opponentTeamShortcutAreaEl.appendChild(empty);
    return;
  }

  const title = document.createElement("p");
  title.className = "opponent-team-shortcuts-title";
  title.textContent = "今日の参加チーム";
  const list = document.createElement("div");
  list.className = "opponent-team-shortcut-list";
  const seriesArea = document.createElement("div");
  seriesArea.className = "opponent-team-series-area";

  const renderSeriesOptions = (teamName) => {
    seriesArea.innerHTML = "";
    const nextNumber = getNextOpponentSeriesNumber(teamName);
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "opponent-team-chip opponent-team-chip--next";
    nextButton.textContent = `次: ${formatOpponentSeriesName(teamName, nextNumber)}`;
    nextButton.addEventListener("click", () => {
      setOpponentInputValue(formatOpponentSeriesName(teamName, nextNumber));
    });

    const numberedList = document.createElement("div");
    numberedList.className = "opponent-team-series-list";
    Array.from({ length: 20 }, (_, index) => index + 1).forEach((number) => {
      if (number === nextNumber) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "opponent-team-chip";
      button.textContent = formatOpponentSeriesName(teamName, number);
      button.addEventListener("click", () => {
        setOpponentInputValue(formatOpponentSeriesName(teamName, number));
      });
      numberedList.appendChild(button);
    });

    seriesArea.append(nextButton, numberedList);
  };

  teamNames.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "opponent-team-chip";
    button.textContent = name;
    button.addEventListener("click", () => {
      setOpponentInputValue(name);
      renderSeriesOptions(name);
    });
    list.appendChild(button);
  });
  opponentTeamShortcutAreaEl.append(title, list, seriesArea);
}

function renderTournamentParticipantList(containerEl, selectedIds, onChange) {
  if (!containerEl) {
    return;
  }
  const selectablePlayers = getParticipantSelectablePlayers();
  const selectedSet = new Set(selectedIds);
  containerEl.innerHTML = "";
  if (!selectablePlayers.length) {
    const empty = document.createElement("p");
    empty.className = "helper-message no-margin";
    empty.textContent = "選択できる選手がいません。";
    containerEl.appendChild(empty);
    return;
  }
  selectablePlayers.forEach((player) => {
    const label = document.createElement("label");
    label.className = "lineup-check-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = player.id;
    cb.checked = selectedSet.has(player.id);
    cb.disabled = !isStaff();
    cb.addEventListener("change", () => {
      const next = new Set(selectedIds);
      if (cb.checked) {
        next.add(player.id);
      } else {
        next.delete(player.id);
      }
      onChange(Array.from(next));
    });
    const text = document.createElement("span");
    text.textContent = formatPlayerLabel(player);
    label.append(cb, text);
    containerEl.appendChild(label);
  });
}

function renderTournamentParticipantLists() {
  const selectableIds = new Set(getParticipantSelectablePlayers().map((player) => player.id));
  state.newTournamentParticipantIds = state.newTournamentParticipantIds.filter((id) => selectableIds.has(id));
  state.editTournamentParticipantIds = state.editTournamentParticipantIds.filter((id) => selectableIds.has(id));
  renderTournamentParticipantList(tournamentParticipantListEl, state.newTournamentParticipantIds, (ids) => {
    state.newTournamentParticipantIds = ids;
    renderTournamentParticipantLists();
  });
  renderTournamentParticipantList(editTournamentParticipantListEl, state.editTournamentParticipantIds, (ids) => {
    state.editTournamentParticipantIds = ids;
    renderTournamentParticipantLists();
  });
}

function fillTournamentEditInputs(tournament) {
  if (!tournament) {
    editTournamentNameEl.value = "";
    editTournamentDateEl.value = "";
    editTournamentMatchTypeEl.value = "大会";
    editTournamentOpponentCategoryModeEl.value = "per_match";
    editTournamentDefaultOpponentCategoryEl.value = "";
    if (editTournamentOpponentTeamsEl) {
      editTournamentOpponentTeamsEl.value = "";
    }
    state.editTournamentParticipantIds = getParticipantSelectablePlayers().map((player) => player.id);
    editTournamentDefaultOpponentCategoryEl.disabled = editTournamentOpponentCategoryModeEl.value !== "fixed" || !isStaff();
    renderTournamentParticipantLists();
    return;
  }
  editTournamentNameEl.value = tournament.name ?? "";
  editTournamentDateEl.value = tournament.date ?? "";
  editTournamentMatchTypeEl.value = tournament.matchType ?? "大会";
  editTournamentOpponentCategoryModeEl.value = tournament.opponentCategoryMode ?? "per_match";
  editTournamentDefaultOpponentCategoryEl.value = tournament.defaultOpponentCategory ?? "";
  if (editTournamentOpponentTeamsEl) {
    editTournamentOpponentTeamsEl.value = formatOpponentTeamNames(tournament.opponentTeamNames);
  }
  state.editTournamentParticipantIds = getTournamentParticipantIds(tournament);
  editTournamentDefaultOpponentCategoryEl.disabled = editTournamentOpponentCategoryModeEl.value !== "fixed" || !isStaff();
  renderTournamentParticipantLists();
}

function fillMatchEditInputs(match) {
  const tournament = getSelectedTournament();
  const defaultCategory = tournament?.defaultOpponentCategory ?? "";
  const mode = tournament?.opponentCategoryMode ?? "per_match";
  if (!match) {
    editOpponentEl.value = "";
    editMatchStageEl.value = "予選";
    editMatchOpponentCategoryEl.value = mode === "fixed" ? defaultCategory : "";
    editMatchOpponentCategoryEl.disabled = mode === "fixed" || !isStaff();
    return;
  }
  editOpponentEl.value = match.opponent ?? "";
  editMatchStageEl.value = match.stage ?? "予選";
  editMatchOpponentCategoryEl.value = mode === "fixed" ? defaultCategory : match.opponentCategory ?? "";
  editMatchOpponentCategoryEl.disabled = mode === "fixed" || !isStaff();
}

function getSelectedTournament() {
  return currentTournaments.find((t) => t.id === state.selectedTournamentId) ?? null;
}

function isViewerVirtualTournamentSelection(tournamentId) {
  return tournamentId === TOURNAMENT_SELECT_ALL;
}

async function seedTournamentsIfNeeded() {
  if (!db) return;
  const snapshot = await getTournamentsRef().once("value");
  if (snapshot.exists()) {
    return;
  }

  const defaultTournamentRef = getTournamentsRef().push();
  await defaultTournamentRef.set({
    id: defaultTournamentRef.key,
    name: "初期大会",
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });
}

async function loadTournaments() {
  if (!db) return [];
  const snapshot = await getTournamentsRef().once("value");
  const data = snapshot.val() ?? {};
  return Object.entries(data)
    .map(([id, value]) => normalizeTournament(id, value))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

async function loadMatchesByTournament(tournamentId) {
  if (!db || !tournamentId) return [];
  const snapshot = await getMatchesRef(tournamentId).once("value");
  const data = snapshot.val() ?? {};
  return Object.entries(data).map(([id, value]) => normalizeMatch(id, value));
}

async function loadMatchesByViewerSelection(tournamentId) {
  if (!isViewerVirtualTournamentSelection(tournamentId)) {
    const matches = await loadMatchesByTournament(tournamentId);
    const tournament = currentTournaments.find((t) => t.id === tournamentId);
    return matches.map((match) => ({
      ...match,
      tournamentId,
      tournamentName: tournament?.name ?? "大会名未設定",
      tournamentDate: tournament?.date ?? "",
      tournamentMatchType: tournament?.matchType ?? "大会",
    }));
  }
  const targetTournaments = currentTournaments;
  const allMatches = [];
  for (const tournament of targetTournaments) {
    const matches = await loadMatchesByTournament(tournament.id);
    allMatches.push(
      ...matches.map((match) => ({
        ...match,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentDate: tournament.date ?? "",
        tournamentMatchType: tournament.matchType ?? "大会",
      })),
    );
  }
  return allMatches;
}

async function loadRecordsForMatch() {
  if (!db || !state.selectedTournamentId || !state.selectedMatchId) {
    if (state.autoSaveTimerId) {
      window.clearTimeout(state.autoSaveTimerId);
      state.autoSaveTimerId = null;
    }
    clearAutoSaveCountdown();
    state.records = {};
    resetMatchSaveMeta(null);
    setSaveState("未保存", "試合を選択すると保存状態が表示されます", "");
    renderStats();
    refreshValidationState();
    return;
  }
  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    if (state.autoSaveTimerId) {
      window.clearTimeout(state.autoSaveTimerId);
      state.autoSaveTimerId = null;
    }
    clearAutoSaveCountdown();
    const selectedMatch = currentMatches.find((item) => item.id === state.selectedMatchId);
    state.matchSubstitutions = Array.isArray(selectedMatch?.substitutions)
      ? selectedMatch.substitutions.map((s) => ({
          inStudentId: String(s.inStudentId),
          outStudentId: String(s.outStudentId),
          time: s.time != null ? String(s.time) : "",
          timestamp: s.timestamp ?? Date.now(),
        }))
      : [];
    resetMatchSaveMeta(selectedMatch?.updatedAt ?? null);
    setSaveState("オフライン", "キャッシュ上の記録を表示しています", "is-saved");
    renderStats();
    refreshValidationState();
    return;
  }
  const snapshot = await getMatchRecordsRef(state.selectedTournamentId, state.selectedMatchId).once("value");
  if (state.autoSaveTimerId) {
    window.clearTimeout(state.autoSaveTimerId);
    state.autoSaveTimerId = null;
  }
  clearAutoSaveCountdown();
  const rawRecords = snapshot.val() ?? {};
  state.records = Object.fromEntries(
    Object.entries(rawRecords).map(([playerId, record]) => {
      const safeRecord = record ?? {};
      if (safeRecord.absent) {
        return [playerId, { absent: true }];
      }
      if (safeRecord.isBench) {
        if (safeRecord.retiredBySubstitution) {
          return [
            playerId,
            {
              ...safeRecord,
              isBench: true,
              retiredBySubstitution: true,
              attackFailure: getAttackFailureFromRecord(safeRecord),
            },
          ];
        }
        return [
          playerId,
          {
            ...safeRecord,
            isBench: true,
            attackFailure: getAttackFailureFromRecord(safeRecord),
          },
        ];
      }
      return [
        playerId,
        {
          ...safeRecord,
          attackFailure: getAttackFailureFromRecord(safeRecord),
        },
      ];
    }),
  );
  const selectedMatch = currentMatches.find((item) => item.id === state.selectedMatchId);
  state.matchSubstitutions = Array.isArray(selectedMatch?.substitutions)
    ? selectedMatch.substitutions.map((s) => ({
        inStudentId: String(s.inStudentId),
        outStudentId: String(s.outStudentId),
        time: s.time != null ? String(s.time) : "",
        timestamp: s.timestamp ?? Date.now(),
      }))
    : [];
  resetMatchSaveMeta(selectedMatch?.updatedAt ?? null);
  setSaveState("保存済み", "この試合の最新データを読み込みました", "is-saved");
  renderStats();
  refreshValidationState();
}

async function seedPlayersIfNeeded() {
  if (!db) return;
  const snapshot = await getPlayersRef().once("value");
  if (snapshot.exists()) {
    return;
  }

  for (const [index, player] of FALLBACK_PLAYERS.entries()) {
    await getPlayerRef(player.id).set({
      name: player.name,
      active: true,
      order: index,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }
}

async function ensureGuestPlayersIfNeeded() {
  if (!db) return;
  const snapshot = await getPlayersRef().once("value");
  const playersData = snapshot.val() ?? {};
  const baseOrder = Object.keys(playersData).length;
  for (const [index, guest] of GUEST_PLAYER_SLOTS.entries()) {
    if (playersData[guest.id]) {
      continue;
    }
    await getPlayerRef(guest.id).set({
      id: guest.id,
      name: guest.name,
      grade: "",
      role: "",
      handedness: "",
      memo: "",
      active: true,
      order: baseOrder + index,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }
}

async function loadPlayersFromRealtimeDatabase() {
  if (!db) {
    setSaveState("Firebase未接続", "script.js に接続設定を入力すると同期できます", "is-error");
    return;
  }

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    if (restoreFromOfflineSnapshot()) {
      renderPlayerManagementList();
      renderTabs();
      void loadRecordsForMatch();
      renderViewerContent();
      setSaveStatus("オフライン: 選手キャッシュを表示");
      return;
    }
  }

  try {
    await seedPlayersIfNeeded();
    await ensureGuestPlayersIfNeeded();
    const snapshot = await getPlayersRef().once("value");
    const playersData = snapshot.val() ?? {};
    players = Object.entries(playersData)
      .map(([id, value], index) => normalizePlayer(id, value, index))
      .sort((a, b) => {
        if ((a.order ?? Number.MAX_SAFE_INTEGER) !== (b.order ?? Number.MAX_SAFE_INTEGER)) {
          return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
        }
        return a.name.localeCompare(b.name, "ja");
      });

    if (!players.length) {
      players = [...FALLBACK_PLAYERS];
    }
    if (!players.find((p) => p.id === state.selectedPlayerId)) {
      state.selectedPlayerId = players[0].id;
    }
    const activePlayerIds = getTournamentEligiblePlayers().map((player) => player.id);
    if (state.viewerSelectedPlayerId !== "all" && !activePlayerIds.includes(state.viewerSelectedPlayerId)) {
      state.viewerSelectedPlayerId = "all";
    }
    state.newTournamentParticipantIds = getParticipantSelectablePlayers().map((player) => player.id);
    const selectedTournament = getSelectedTournament();
    state.editTournamentParticipantIds = selectedTournament
      ? getTournamentParticipantIds(selectedTournament)
      : state.newTournamentParticipantIds;
    renderPlayerManagementList();
    renderTournamentParticipantLists();
    renderTabs();
    await loadRecordsForMatch();
    renderViewerContent();
    setSaveStatus("選手データ同期済み");
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    if (restoreFromOfflineSnapshot()) {
      renderPlayerManagementList();
      renderTournamentParticipantLists();
      renderTabs();
      void loadRecordsForMatch();
      renderViewerContent();
      setSaveStatus("オフライン: キャッシュを表示");
      return;
    }
    const code = error?.code ?? "unknown";
    if (code === "permission-denied") {
      setSaveState("同期失敗", "Realtime Databaseルールで拒否されています", "is-error");
      return;
    }
    setSaveState("同期失敗", `エラーコード: ${code}`, "is-error");
  }
}

function getMatchFormMeta() {
  const tournament = getSelectedTournament();
  const mode = tournament?.opponentCategoryMode ?? "per_match";
  const defaultCategory = tournament?.defaultOpponentCategory ?? "";
  const selectedCategory = matchOpponentCategoryEl.value || "";
  return {
    date: tournament?.date ?? "",
    opponent: opponentEl.value.trim(),
    stage: matchStageEl.value,
    opponentCategory: mode === "fixed" ? defaultCategory : selectedCategory,
    matchType: tournament?.matchType ?? "大会",
  };
}

function buildMatchMetaPayload() {
  return {
    ...getMatchFormMeta(),
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  };
}

function buildRecordsPayload() {
  const records = players.map((player) => {
    const stats = { ...getPlayerStats(player.id) };
    if (stats.absent) {
      return {
        id: player.id,
        stats: { absent: true },
      };
    }
    if (stats.isBench && !stats.retiredBySubstitution) {
      const copy = { ...stats };
      copy.attackFailure = getAttackFailureFromRecord(copy);
      delete copy.attack;
      return {
        id: player.id,
        stats: copy,
      };
    }
    stats.attackFailure = getAttackFailureFromRecord(stats);
    delete stats.attack;
    return {
      id: player.id,
      stats,
    };
  });

  return Object.fromEntries(records.map((item) => [item.id, item.stats]));
}

function persistRtdbSnapshot() {
  if (typeof SakuraOfflineSync === "undefined") {
    return;
  }
  try {
    SakuraOfflineSync.persistAppSnapshot({
      players,
      tournaments: currentTournaments,
      matches: currentMatches,
      viewerTournamentRecords: state.viewerTournamentRecords,
      matchRecords: state.records,
      matchSubstitutions: state.matchSubstitutions,
      state: {
        selectedTournamentId: state.selectedTournamentId,
        selectedMatchId: state.selectedMatchId,
      },
    });
  } catch (e) {
    console.warn(e);
  }
}

function restoreFromOfflineSnapshot() {
  if (typeof SakuraOfflineSync === "undefined") {
    return false;
  }
  const snap = SakuraOfflineSync.loadAppSnapshot();
  if (!snap || !Array.isArray(snap.players) || snap.players.length === 0) {
    return false;
  }
  players = snap.players;
  currentTournaments = snap.tournaments || [];
  currentMatches = snap.matches || [];
  state.viewerTournamentRecords = snap.viewerTournamentRecords || {};
  state.records = snap.matchRecords || {};
  state.matchSubstitutions = snap.matchSubstitutions || [];
  if (snap.state) {
    state.selectedTournamentId = snap.state.selectedTournamentId || "";
    state.selectedMatchId = snap.state.selectedMatchId || "";
  }
  return true;
}

function renderAfterOfflineRestore() {
  renderTournamentOptions(currentTournaments);
  tournamentSelectEl.value = state.selectedTournamentId;
  renderMatchOptions(currentMatches);
  matchSelectEl.value = state.selectedMatchId;
  resetViewerFilters();
  fillTournamentEditInputs(getSelectedTournament());
  const selectedMatch = currentMatches.find((item) => item.id === state.selectedMatchId);
  fillMatchMetaInputs(selectedMatch);
  fillMatchEditInputs(selectedMatch);
  state.viewerSelectedMatchIds = currentMatches.map((match) => match.id);
  viewerSortKeyEl.value = state.viewerSortKey;
  viewerSortOrderEl.value = state.viewerSortOrder;
  renderViewerContent();
  renderPlayerManagementList();
  renderTabs();
  renderStats();
  renderRecordSummary();
  renderCheckMode();
  syncStepByState();
  refreshValidationState();
  applyPermission();
  void loadRecordsForMatch();
}

async function createPlayer() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ選手追加可能");
    return;
  }
  const name = newPlayerNameEl.value.trim();
  const grade = newPlayerGradeEl.value;
  const role = newPlayerRoleEl.value;
  const handedness = newPlayerHandednessEl.value;
  const memo = newPlayerMemoEl.value.trim();
  if (!name) {
    setSaveStatus("選手名を入力してください");
    return;
  }
  if (!grade) {
    setSaveStatus("学年を選択してください");
    return;
  }
  const ref = getPlayersRef().push();
  await ref.set({
    id: ref.key,
    name,
    grade,
    role,
    handedness,
    memo,
    active: true,
    order: players.length,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });
  newPlayerNameEl.value = "";
  newPlayerGradeEl.value = "";
  newPlayerRoleEl.value = "";
  newPlayerHandednessEl.value = "";
  newPlayerMemoEl.value = "";
  playerManagementCreateAreaEl.classList.add("hidden");
  togglePlayerManagementButtonEl.textContent = `+ ${togglePlayerManagementButtonEl.dataset.defaultLabel}`;
  await loadPlayersFromRealtimeDatabase();
  state.selectedPlayerId = ref.key;
  renderTabs();
  renderStats();
  setSaveStatus("選手を追加しました");
}

async function updatePlayerDetails(playerId, nextName, nextGrade, nextRole, nextHandedness, nextMemo) {
  if (!isStaff()) {
    return;
  }

  const name = nextName.trim();
  if (!name) {
    setSaveStatus("選手名を入力してください");
    return;
  }
  const guestPlayer = isGuestPlayerId(playerId);
  if (!guestPlayer && !nextGrade) {
    setSaveStatus("学年を選択してください");
    return;
  }

  await getPlayerRef(playerId).update({
    name,
    grade: guestPlayer ? "" : nextGrade,
    role: nextRole,
    handedness: nextHandedness,
    memo: nextMemo.trim(),
  });

  await loadPlayersFromRealtimeDatabase();
  renderPlayerManagementList();
  renderTabs();
  renderStats();
  renderViewerContent();
  setSaveStatus("選手情報を更新しました");
}

async function deletePlayer(playerId, playerName) {
  if (!isStaff()) {
    return;
  }
  if (isGuestPlayerId(playerId)) {
    setSaveStatus("助っ人は削除できません");
    return;
  }
  const confirmed = window.confirm(
    `${playerName} を削除します（ゴミ箱へ移動）。30日以内に復元できます。\n試合記録の当該選手分もまとめて削除されます。よろしいですか？`,
  );
  if (!confirmed) {
    return;
  }
  if (!db || typeof window.TrashCore === "undefined") {
    setSaveStatus("ゴミ箱モジュールを読み込めません。ページを再読み込みしてください。");
    return;
  }
  const TC = window.TrashCore;
  const snap = await TC.snapshotPlayerForTrash(db, playerId);
  await TC.pushTrashItem(db, {
    itemType: TC.ITEM_TYPES.student,
    itemId: playerId,
    itemName: playerName,
    originalData: snap,
  });
  await getPlayerRef(playerId).remove();
  await TC.removePlayerRecordsFromDatabase(db, playerId);
  players = players.filter((player) => player.id !== playerId);
  delete state.records[playerId];
  if (state.selectedPlayerId === playerId) {
    state.selectedPlayerId = players[0]?.id ?? "";
  }
  renderPlayerManagementList();
  renderTabs();
  renderStats();
  renderViewerContent();
  setSaveStatus("選手をゴミ箱へ移動しました");
}

async function persistPlayerOrderList(reorderedPlayers) {
  await Promise.all(
    reorderedPlayers.map((player, index) =>
      getPlayerRef(player.id).update({
        order: index,
      }),
    ),
  );
  await loadPlayersFromRealtimeDatabase();
  renderPlayerManagementList();
  renderTabs();
  renderStats();
  renderViewerContent();
}

async function movePlayerOrder(playerId, direction) {
  if (!isStaff()) {
    return;
  }

  const currentIndex = players.findIndex((player) => player.id === playerId);
  const targetIndex = currentIndex + direction;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= players.length) {
    return;
  }

  const reordered = [...players];
  const [movedPlayer] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, movedPlayer);

  await persistPlayerOrderList(reordered);
  setSaveStatus("選手の並び順を更新しました");
}

/** 表示順を番号で指定（1が先頭）。Firebase の各選手の order を書き換えます。 */
async function applyPlayerDisplayOrder(playerId, newPositionRaw) {
  if (!isStaff()) {
    return;
  }
  const len = players.length;
  if (!len) {
    return;
  }
  let newPosition = Math.floor(Number(newPositionRaw));
  if (!Number.isFinite(newPosition)) {
    newPosition = 1;
  }
  newPosition = Math.max(1, Math.min(len, newPosition));
  const newIndex = newPosition - 1;
  const currentIndex = players.findIndex((player) => player.id === playerId);
  if (currentIndex < 0) {
    return;
  }
  if (newIndex === currentIndex) {
    setSaveStatus("すでにその表示位置です");
    return;
  }
  const reordered = [...players];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(newIndex, 0, moved);
  await persistPlayerOrderList(reordered);
  setSaveStatus("表示順を更新しました");
}

async function applyMatchDisplayOrder(matchId, newOrderRaw) {
  if (!isStaff() || !state.selectedTournamentId || !matchId) return;
  let displayOrder = Math.floor(Number(newOrderRaw));
  if (!Number.isFinite(displayOrder) || displayOrder <= 0) {
    setSaveStatus("試合順は 1 以上で入力してください");
    return;
  }
  const selected = currentMatches.find((m) => m.id === matchId);
  if (!selected) return;
  if (Number(selected.displayOrder) === displayOrder) {
    setSaveStatus("すでにその試合順です");
    return;
  }

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    SakuraOfflineSync.enqueue("match_update", {
      tournamentId: state.selectedTournamentId,
      matchId,
      opponent: selected.opponent || "",
      stage: selected.stage || "予選",
      opponentCategory: selected.opponentCategory || "",
      displayOrder,
    });
    currentMatches = currentMatches.map((m) => (m.id === matchId ? { ...m, displayOrder, updatedAt: Date.now() } : m));
    renderMatchOptions(currentMatches);
    renderViewerContent();
    renderMatchOrderManagementList();
    persistRtdbSnapshot();
    setSaveStatus("オフライン: 試合順変更をキューに追加しました");
    return;
  }

  try {
    await getMatchRef(state.selectedTournamentId, matchId).update({
      displayOrder,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    const matches = await loadMatchesByTournament(state.selectedTournamentId);
    renderMatchOptions(matches);
    renderViewerContent();
    renderMatchOrderManagementList();
    persistRtdbSnapshot();
    setSaveStatus("試合順を更新しました");
  } catch (error) {
    console.error(error);
    setSaveStatus(`試合順更新に失敗しました: ${error?.code ?? "unknown"}`);
  }
}

async function persistMatchDisplayOrderList(reorderedMatches) {
  if (!isStaff() || !state.selectedTournamentId) return;
  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    reorderedMatches.forEach((match, index) => {
      SakuraOfflineSync.enqueue("match_update", {
        tournamentId: state.selectedTournamentId,
        matchId: match.id,
        opponent: match.opponent || "",
        stage: match.stage || "予選",
        opponentCategory: match.opponentCategory || "",
        displayOrder: index + 1,
      });
    });
    currentMatches = reorderedMatches.map((match, index) => ({ ...match, displayOrder: index + 1, updatedAt: Date.now() }));
    renderMatchOptions(currentMatches);
    renderViewerContent();
    renderMatchOrderManagementList();
    persistRtdbSnapshot();
    setSaveStatus("オフライン: 試合順変更をキューに追加しました");
    return;
  }

  await Promise.all(
    reorderedMatches.map((match, index) =>
      getMatchRef(state.selectedTournamentId, match.id).update({
        displayOrder: index + 1,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      }),
    ),
  );
  const matches = await loadMatchesByTournament(state.selectedTournamentId);
  renderMatchOptions(matches);
  renderViewerContent();
  renderMatchOrderManagementList();
  persistRtdbSnapshot();
}

async function moveMatchOrder(matchId, direction) {
  if (!isStaff() || !state.selectedTournamentId) return;
  const currentIndex = currentMatches.findIndex((m) => m.id === matchId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentMatches.length) return;
  const reordered = [...currentMatches];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  await persistMatchDisplayOrderList(reordered);
  setSaveStatus("試合順を更新しました");
}

function applyBenchStateChange(playerId, nextBench) {
  if (!isStaff()) {
    return;
  }
  const current = getPlayerStats(playerId);
  if (nextBench) {
    state.records[playerId] = { ...current, isBench: true };
  } else {
    const { isBench: _b, ...rest } = current;
    const next = { ...rest };
    next.attackFailure = getAttackFailureFromRecord(next);
    state.records[playerId] = recordHasAnyStattedPlays(next) ? next : {};
  }
  renderTabs();
  renderStats();
  if (state.currentStep === 3) {
    renderMatchRosterPanels();
  }
  queueAutoSave();
}

function openBenchDownWarningModal(playerId) {
  const player = players.find((p) => p.id === playerId);
  if (!player) {
    return;
  }
  const st = getPlayerStats(playerId);
  const detailRows = stats
    .map((s) => ({ label: s.label, val: st[s.key] || 0 }))
    .filter((x) => x.val > 0)
    .map(
      (x) =>
        `<div class="match-flow-stat-row"><span class="match-flow-stat-row-label">${escapeHtml(x.label)}</span><span class="match-flow-stat-row-val">${x.val}</span></div>`,
    )
    .join("");
  const total = stats.reduce((sum, s) => sum + (st[s.key] || 0), 0);
  openMatchFlowModal({
    title: "ベンチに下げる",
    bodyHtml: `
      <div class="match-flow-panel match-flow-panel--warning">
        <div class="match-flow-confirm match-flow-confirm--plain">
          <div class="match-flow-confirm-player">
            <span class="match-flow-confirm-label">選手</span>
            <span class="match-flow-confirm-name">${escapeHtml(formatPlayerLabel(player))}</span>
          </div>
        </div>
        <p class="match-flow-panel-tag">試合記録があります</p>
        <div class="match-flow-info-box">
          <p>ベンチに下げても<strong>数値は消えず保持</strong>され、出場に戻すと再び入力できます。</p>
        </div>
        <div class="match-flow-stat-card">
          <div class="match-flow-stat-line">
            <span class="match-flow-stat-label">総プレー</span>
            <span class="match-flow-stat-num">${total}</span>
          </div>
          ${detailRows ? `<div class="match-flow-stat-rows">${detailRows}</div>` : ""}
        </div>
      </div>
    `,
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "それでもベンチに下げる",
        primary: true,
        danger: true,
        onClick: () => {
          closeMatchFlowModal();
          applyBenchStateChange(playerId, true);
        },
      },
    ],
  });
}

function openFieldOverCapacityConfirmModal(playerId) {
  const player = players.find((p) => p.id === playerId);
  if (!player) {
    return;
  }
  const onField = getActiveOnFieldCount();
  openMatchFlowModal({
    title: "出場人数の確認",
    bodyHtml: `
      <div class="match-flow-panel match-flow-panel--caution">
        <div class="match-flow-capacity-head">
          <span class="match-flow-capacity-chip">出場中 ${onField}人</span>
          <span class="match-flow-capacity-sep" aria-hidden="true">/</span>
          <span class="match-flow-capacity-chip match-flow-capacity-chip--muted">目安 ${LINEUP_STARTER_COUNT}人</span>
        </div>
        <p class="match-flow-prose-lead">スタメン枠で<strong>出場中が${LINEUP_STARTER_COUNT}人</strong>いる状態です。記録入力できる出場中は現在 <strong>${onField}人</strong> です。</p>
        <div class="match-flow-confirm match-flow-confirm--plain">
          <div class="match-flow-confirm-player">
            <span class="match-flow-confirm-label">出場に戻す選手</span>
            <span class="match-flow-confirm-name">${escapeHtml(formatPlayerLabel(player))}</span>
          </div>
        </div>
        <div class="match-flow-capacity-flow" aria-hidden="true">
          <span class="match-flow-pill match-flow-pill--dim">${onField}人</span>
          <span class="match-flow-arrow">→</span>
          <span class="match-flow-pill match-flow-pill--warn">${onField + 1}人</span>
        </div>
        <p class="match-flow-capacity-impact">目安（${LINEUP_STARTER_COUNT}人）を超えます。</p>
        <div class="match-flow-info-box match-flow-info-box--subtle">
          <p class="match-flow-prose-muted match-flow-info-box-text">先に別の選手をベンチに下げるか、このまま進めるかを選んでください。</p>
        </div>
      </div>
    `,
    actionButtons: [
      { label: "キャンセル", onClick: () => closeMatchFlowModal() },
      {
        label: "それでも出場に戻す",
        primary: true,
        danger: true,
        onClick: () => {
          closeMatchFlowModal();
          applyBenchStateChange(playerId, false);
        },
      },
    ],
  });
}

function toggleBenchStatus() {
  if (!isStaff()) {
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    return;
  }
  if (isSubstitutedOut(player.id)) {
    return;
  }
  const current = getPlayerStats(player.id);
  const nextBench = !current.isBench;
  if (nextBench && recordHasAnyStattedPlays(current)) {
    openBenchDownWarningModal(player.id);
    return;
  }
  if (!nextBench && getActiveOnFieldCount() >= LINEUP_STARTER_COUNT) {
    openFieldOverCapacityConfirmModal(player.id);
    return;
  }
  applyBenchStateChange(player.id, nextBench);
}

async function togglePlayerActive() {
  if (!isStaff()) {
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    return;
  }
  const nextActive = player.active === false;
  await getPlayerRef(player.id).update({ active: nextActive });
  await loadPlayersFromRealtimeDatabase();
  state.selectedPlayerId = getVisiblePlayers()[0]?.id ?? "";
  renderTabs();
  renderStats();
  setSaveStatus(nextActive ? "選手を再表示しました" : "選手を非表示にしました");
}

async function handleTrashRestored() {
  if (!db) {
    return;
  }
  const tournaments = await loadTournaments();
  renderTournamentOptions(tournaments);
  const matches = isStaff()
    ? await loadMatchesByTournament(state.selectedTournamentId)
    : await loadMatchesByViewerSelection(state.selectedTournamentId);
  renderMatchOptions(matches);
  resetViewerFilters();
  await loadViewerRecordsForTournament();
  await loadPlayersFromRealtimeDatabase();
  await loadRecordsForMatch();
  renderViewerContent();
  renderPlayerManagementList();
  renderTabs();
  renderStats();
  renderRecordSummary();
  renderCheckMode();
  refreshValidationState();
  applyPermission();
  setSaveStatus("ゴミ箱から復元しました。データを再読み込みしました。");
}

function initTrashPanelIfNeeded() {
  if (!db || typeof window.TrashUI === "undefined") {
    return;
  }
  if (!isStaff()) {
    return;
  }
  window.TrashUI.init({
    db,
    toggleButton: openTrashPanelButtonEl,
    onRestored: handleTrashRestored,
  });
}

async function initializeData() {
  if (!db) {
    setSaveStatus("Firebase未接続（設定待ち）");
    return;
  }

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    if (restoreFromOfflineSnapshot()) {
      renderAfterOfflineRestore();
      setSaveStatus("オフライン: 前回のキャッシュを表示しています");
      initTrashPanelIfNeeded();
      return;
    }
    setSaveStatus("オフラインで表示できるキャッシュがありません");
    return;
  }

  try {
    await seedTournamentsIfNeeded();
    const tournaments = await loadTournaments();
    renderTournamentOptions(tournaments);
    const matches = isStaff()
      ? await loadMatchesByTournament(state.selectedTournamentId)
      : await loadMatchesByViewerSelection(state.selectedTournamentId);
    renderMatchOptions(matches);
    resetViewerFilters();
    fillTournamentEditInputs(getSelectedTournament());
    fillMatchEditInputs(null);
    state.viewerSelectedMatchIds = matches.map((match) => match.id);
    viewerSortKeyEl.value = state.viewerSortKey;
    viewerSortOrderEl.value = state.viewerSortOrder;
    await loadViewerRecordsForTournament();
    await loadPlayersFromRealtimeDatabase();
    syncStepByState();
    refreshValidationState();
    initTrashPanelIfNeeded();
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    if (restoreFromOfflineSnapshot()) {
      renderAfterOfflineRestore();
      setSaveStatus("接続に失敗したためキャッシュを表示しています");
      initTrashPanelIfNeeded();
      return;
    }
    const code = error?.code ?? "";
    if (code === "permission-denied") {
      setSaveState("同期失敗", "Realtime Databaseルールで拒否されています", "is-error");
      return;
    }
    setSaveState("読み込み失敗", String(error?.message || error), "is-error");
  }
}

async function createTournament() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ大会作成可能");
    return;
  }
  const name = newTournamentNameEl.value.trim();
  const date = tournamentDateEl.value;
  const matchType = tournamentMatchTypeEl.value;
  const opponentCategoryMode = tournamentOpponentCategoryModeEl.value === "fixed" ? "fixed" : "per_match";
  const defaultOpponentCategory = tournamentDefaultOpponentCategoryEl.value || "";
  const opponentTeamNames = normalizeOpponentTeamNames(newTournamentOpponentTeamsEl?.value);
  const selectableSet = new Set(getParticipantSelectablePlayers().map((player) => player.id));
  const participantPlayerIds = Array.from(
    new Set(state.newTournamentParticipantIds.filter((id) => selectableSet.has(id))),
  );
  if (!name) {
    setSaveStatus("新規大会名を入力してください");
    return;
  }
  if (!date) {
    setSaveStatus("大会日を入力してください");
    return;
  }
  if (!participantPlayerIds.length) {
    setSaveStatus("大会参加メンバーを1人以上選択してください");
    return;
  }
  const ref = getTournamentsRef().push();
  await ref.set({
    id: ref.key,
    name,
    date,
    matchType,
    opponentCategoryMode,
    defaultOpponentCategory,
    opponentTeamNames,
    participantPlayerIds,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });
  newTournamentNameEl.value = "";
  if (newTournamentOpponentTeamsEl) {
    newTournamentOpponentTeamsEl.value = "";
  }
  state.newTournamentParticipantIds = getParticipantSelectablePlayers().map((player) => player.id);
  setSaveStatus("大会を作成しました");
  tournamentCreateAreaEl.classList.add("hidden");
  toggleTournamentCreateButtonEl.textContent = `+ ${toggleTournamentCreateButtonEl.dataset.defaultLabel}`;
  const tournaments = await loadTournaments();
  state.selectedTournamentId = ref.key;
  resetViewerFilters();
  renderTournamentOptions(tournaments);
  fillTournamentEditInputs(getSelectedTournament());
  renderMatchOptions([]);
  state.viewerSelectedMatchIds = [];
  state.viewerTournamentRecords = {};
  renderViewerContent();
  fillMatchMetaInputs(null);
  fillMatchEditInputs(null);
  state.records = {};
  renderStats();
  applyPermission();
}

async function updateSelectedTournament() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ大会更新可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }

  const name = editTournamentNameEl.value.trim();
  const date = editTournamentDateEl.value;
  const matchType = editTournamentMatchTypeEl.value;
  const opponentCategoryMode = editTournamentOpponentCategoryModeEl.value === "fixed" ? "fixed" : "per_match";
  const defaultOpponentCategory = editTournamentDefaultOpponentCategoryEl.value || "";
  const opponentTeamNames = normalizeOpponentTeamNames(editTournamentOpponentTeamsEl?.value);
  const selectableSet = new Set(getParticipantSelectablePlayers().map((player) => player.id));
  const participantPlayerIds = Array.from(
    new Set(state.editTournamentParticipantIds.filter((id) => selectableSet.has(id))),
  );

  if (!name) {
    setSaveStatus("大会名を入力してください");
    return;
  }
  if (!date) {
    setSaveStatus("大会日を入力してください");
    return;
  }
  if (!participantPlayerIds.length) {
    setSaveStatus("大会参加メンバーを1人以上選択してください");
    return;
  }

  await getTournamentRef(state.selectedTournamentId).update({
    name,
    date,
    matchType,
    opponentCategoryMode,
    defaultOpponentCategory,
    opponentTeamNames,
    participantPlayerIds,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });

  const tournaments = await loadTournaments();
  resetViewerFilters();
  renderTournamentOptions(tournaments);
  fillTournamentEditInputs(getSelectedTournament());
  renderMatchOptions(currentMatches);
  renderRecordSummary();
  renderViewerContent();
  setSaveStatus("大会内容を更新しました");
}

async function deleteSelectedTournament() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ大会削除可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }

  const tournament = getSelectedTournament();
  const tournamentName = tournament?.name ?? "この大会";
  const confirmed = window.confirm(
    `${tournamentName} を削除します（ゴミ箱へ移動）。\n大会に紐づく試合と記録もすべてまとめて移動し、30日以内に復元できます。よろしいですか？`,
  );
  if (!confirmed) {
    return;
  }

  if (!db || typeof window.TrashCore === "undefined") {
    setSaveStatus("ゴミ箱モジュールを読み込めません。ページを再読み込みしてください。");
    return;
  }
  const TC = window.TrashCore;
  const tournamentId = state.selectedTournamentId;
  const snap = await TC.snapshotTournamentTree(db, tournamentId);
  await TC.pushTrashItem(db, {
    itemType: TC.ITEM_TYPES.competition,
    itemId: tournamentId,
    itemName: tournamentName,
    originalData: snap,
  });
  await getTournamentRef(tournamentId).remove();
  await getMatchesRef(tournamentId).remove();
  await getTournamentRecordsRef(tournamentId).remove();

  const tournaments = await loadTournaments();
  renderTournamentOptions(tournaments);
  fillTournamentEditInputs(getSelectedTournament());

  const matches = await loadMatchesByTournament(state.selectedTournamentId);
  resetViewerFilters();
  renderMatchOptions(matches);
  state.selectedMatchId = "";
  fillMatchMetaInputs(null);
  fillMatchEditInputs(null);
  state.viewerSelectedMatchIds = matches.map((match) => match.id);
  state.viewerTournamentRecords = {};
  state.records = {};
  await loadViewerRecordsForTournament();
  renderStats();
  syncStepByState();
  applyPermission();

  tournamentEditAreaEl.classList.add("hidden");
  toggleTournamentEditButtonEl.textContent = toggleTournamentEditButtonEl.dataset.defaultLabel;
  setSaveStatus("大会をゴミ箱へ移動しました");
}

async function createMatchInSelectedTournament() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ試合作成可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }
  const meta = getMatchFormMeta();
  const maxOrder = currentMatches.reduce((mx, m) => {
    const n = Number(m.displayOrder);
    return Number.isFinite(n) && n > mx ? n : mx;
  }, 0);
  const desiredDisplayOrder = maxOrder + 1;

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    const tempId = SakuraOfflineSync.makeTempId("match");
    const localMatch = normalizeMatch(tempId, {
      ...meta,
      displayOrder: desiredDisplayOrder,
      id: tempId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startingMemberIds: [],
      substitutions: [],
    });
    currentMatches = [...currentMatches, localMatch];
    state.selectedMatchId = tempId;
    SakuraOfflineSync.enqueue("match_create", {
      tournamentId: state.selectedTournamentId,
      tempMatchId: tempId,
      matchPayload: {
        opponent: meta.opponent,
        stage: meta.stage,
        opponentCategory: meta.opponentCategory,
        date: meta.date,
        displayOrder: desiredDisplayOrder,
        matchType: meta.matchType,
        startingMemberIds: [],
        substitutions: [],
      },
    });
    renderMatchOptions(currentMatches);
    state.viewerSelectedMatchIds = currentMatches.map((match) => match.id);
    state.viewerSelectedPlayerId = "all";
    const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
    fillMatchMetaInputs(selected);
    fillMatchEditInputs(selected);
    state.records = {};
    renderStats();
    applyPermission();
    persistRtdbSnapshot();
    setSaveStatus("オフライン: 試合をローカルに作成しました（同期待ち）");
    matchCreateAreaEl.classList.add("hidden");
    toggleMatchCreateButtonEl.textContent = `+ ${toggleMatchCreateButtonEl.dataset.defaultLabel}`;
    return;
  }
  try {
    const newMatchRef = getMatchesRef(state.selectedTournamentId).push();
    await newMatchRef.set({
      id: newMatchRef.key,
      ...buildMatchMetaPayload(),
      displayOrder: desiredDisplayOrder,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
    state.selectedMatchId = newMatchRef.key;
    const matches = await loadMatchesByTournament(state.selectedTournamentId);
    renderMatchOptions(matches);
    state.viewerSelectedMatchIds = matches.map((match) => match.id);
    state.viewerSelectedPlayerId = "all";
    await loadViewerRecordsForTournament();
    const selected = matches.find((item) => item.id === state.selectedMatchId);
    fillMatchMetaInputs(selected);
    fillMatchEditInputs(selected);
    state.records = {};
    renderStats();
    applyPermission();
    setSaveStatus("試合を作成しました");
    matchCreateAreaEl.classList.add("hidden");
    toggleMatchCreateButtonEl.textContent = `+ ${toggleMatchCreateButtonEl.dataset.defaultLabel}`;
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    const code = error?.code ?? "unknown";
    if (
      typeof SakuraOfflineSync !== "undefined" &&
      (code === "unavailable" || code === "network-request-failed" || !navigator.onLine)
    ) {
      const tempId = SakuraOfflineSync.makeTempId("match");
      const localMatch = normalizeMatch(tempId, {
        ...meta,
        displayOrder: desiredDisplayOrder,
        id: tempId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        startingMemberIds: [],
        substitutions: [],
      });
      currentMatches = [...currentMatches, localMatch];
      state.selectedMatchId = tempId;
      SakuraOfflineSync.enqueue("match_create", {
        tournamentId: state.selectedTournamentId,
        tempMatchId: tempId,
        matchPayload: {
          opponent: meta.opponent,
          stage: meta.stage,
          opponentCategory: meta.opponentCategory,
          date: meta.date,
          displayOrder: desiredDisplayOrder,
          matchType: meta.matchType,
          startingMemberIds: [],
          substitutions: [],
        },
      });
      renderMatchOptions(currentMatches);
      state.viewerSelectedMatchIds = currentMatches.map((match) => match.id);
      state.viewerSelectedPlayerId = "all";
      const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
      fillMatchMetaInputs(selected);
      fillMatchEditInputs(selected);
      state.records = {};
      renderStats();
      applyPermission();
      persistRtdbSnapshot();
      setSaveStatus("ネットワーク不通のためローカルに作成しました（同期待ち）");
      matchCreateAreaEl.classList.add("hidden");
      toggleMatchCreateButtonEl.textContent = `+ ${toggleMatchCreateButtonEl.dataset.defaultLabel}`;
      return;
    }
    setSaveStatus(`試合作成に失敗しました: ${code}`);
  }
}

async function updateSelectedMatch() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ試合更新可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }
  if (!state.selectedMatchId) {
    setSaveStatus("先に試合を選択してください");
    return;
  }

  const opponent = editOpponentEl.value.trim();
  const stage = editMatchStageEl.value;
  const tournament = getSelectedTournament();
  const opponentCategoryMode = tournament?.opponentCategoryMode ?? "per_match";
  const defaultOpponentCategory = tournament?.defaultOpponentCategory ?? "";
  const opponentCategory =
    opponentCategoryMode === "fixed" ? defaultOpponentCategory : editMatchOpponentCategoryEl.value || "";

  if (!opponent) {
    setSaveStatus("対戦相手を入力してください");
    return;
  }

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    SakuraOfflineSync.enqueue("match_update", {
      tournamentId: state.selectedTournamentId,
      matchId: state.selectedMatchId,
      opponent,
      stage,
      opponentCategory,
    });
    currentMatches = currentMatches.map((m) =>
      m.id === state.selectedMatchId ? { ...m, opponent, stage, opponentCategory, updatedAt: Date.now() } : m,
    );
    const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
    fillMatchMetaInputs(selected);
    fillMatchEditInputs(selected);
    renderRecordSummary();
    renderViewerContent();
    persistRtdbSnapshot();
    setSaveStatus("オフライン: 試合更新をキューに追加しました");
    return;
  }

  try {
    await getMatchRef(state.selectedTournamentId, state.selectedMatchId).update({
      opponent,
      stage,
      opponentCategory,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });

    const matches = await loadMatchesByTournament(state.selectedTournamentId);
    renderMatchOptions(matches);
    const selected = matches.find((item) => item.id === state.selectedMatchId);
    fillMatchMetaInputs(selected);
    fillMatchEditInputs(selected);
    renderRecordSummary();
    renderViewerContent();
    setSaveStatus("試合内容を更新しました");
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    const code = error?.code ?? "unknown";
    if (
      typeof SakuraOfflineSync !== "undefined" &&
      (code === "unavailable" || code === "network-request-failed" || !navigator.onLine)
    ) {
      SakuraOfflineSync.enqueue("match_update", {
        tournamentId: state.selectedTournamentId,
        matchId: state.selectedMatchId,
        opponent,
        stage,
        opponentCategory,
      });
      currentMatches = currentMatches.map((m) =>
        m.id === state.selectedMatchId ? { ...m, opponent, stage, opponentCategory, updatedAt: Date.now() } : m,
      );
      const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
      fillMatchMetaInputs(selected);
      fillMatchEditInputs(selected);
      renderRecordSummary();
      renderViewerContent();
      persistRtdbSnapshot();
      setSaveStatus("ネットワーク不通のため更新をキューに追加しました");
      return;
    }
    setSaveStatus(`試合更新に失敗: ${code}`);
  }
}

async function deleteSelectedMatch() {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ試合削除可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }
  if (!state.selectedMatchId) {
    setSaveStatus("先に試合を選択してください");
    return;
  }

  const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
  const matchLabel = selected ? getMatchLabel(selected) : "この試合";
  const confirmed = window.confirm(
    `${matchLabel} を削除します（ゴミ箱へ移動）。記録も含めて30日以内に復元できます。よろしいですか？`,
  );
  if (!confirmed) {
    return;
  }

  if (!db || typeof window.TrashCore === "undefined") {
    setSaveStatus("ゴミ箱モジュールを読み込めません。ページを再読み込みしてください。");
    return;
  }
  const TC = window.TrashCore;
  const matchId = state.selectedMatchId;

  const finalizeLocalDelete = async (statusMessage) => {
    const matches = await loadMatchesByTournament(state.selectedTournamentId);
    state.selectedMatchId = "";
    renderMatchOptions(matches);
    fillMatchMetaInputs(null);
    fillMatchEditInputs(null);
    state.viewerSelectedMatchIds = matches.map((match) => match.id);
    state.records = {};
    await loadViewerRecordsForTournament();
    renderStats();
    syncStepByState();
    applyPermission();

    matchEditAreaEl.classList.add("hidden");
    toggleMatchEditButtonEl.textContent = toggleMatchEditButtonEl.dataset.defaultLabel;
    setSaveStatus(statusMessage);
  };

  if (typeof SakuraOfflineSync !== "undefined" && !SakuraOfflineSync.isOnline()) {
    const originalData = {
      tournamentId: state.selectedTournamentId,
      matchId,
      match: selected
        ? { ...selected, substitutions: state.matchSubstitutions ?? selected.substitutions ?? [] }
        : {},
      records: buildRecordsPayload(),
    };
    SakuraOfflineSync.enqueue("match_delete", {
      tournamentId: state.selectedTournamentId,
      matchId,
      itemName: selected?.opponent ? `${selected.opponent}（${selected.stage || "試合"}）` : matchLabel,
      originalData,
    });
    currentMatches = currentMatches.filter((m) => m.id !== matchId);
    state.selectedMatchId = "";
    renderMatchOptions(currentMatches);
    fillMatchMetaInputs(null);
    fillMatchEditInputs(null);
    state.viewerSelectedMatchIds = currentMatches.map((match) => match.id);
    state.records = {};
    state.viewerTournamentRecords = state.viewerTournamentRecords || {};
    if (state.viewerTournamentRecords[matchId]) {
      const next = { ...state.viewerTournamentRecords };
      delete next[matchId];
      state.viewerTournamentRecords = next;
    }
    renderStats();
    syncStepByState();
    applyPermission();
    renderViewerContent();
    matchEditAreaEl.classList.add("hidden");
    toggleMatchEditButtonEl.textContent = toggleMatchEditButtonEl.dataset.defaultLabel;
    persistRtdbSnapshot();
    setSaveStatus("オフライン: 削除をキューに追加しました（復帰後に同期）");
    return;
  }

  const snap = await TC.snapshotMatchTree(db, state.selectedTournamentId, matchId);
  await TC.pushTrashItem(db, {
    itemType: TC.ITEM_TYPES.match,
    itemId: matchId,
    itemName: selected?.opponent ? `${selected.opponent}（${selected.stage || "試合"}）` : matchLabel,
    originalData: snap,
  });
  await getMatchRef(state.selectedTournamentId, matchId).remove();
  await getMatchRecordsRef(state.selectedTournamentId, matchId).remove();

  await finalizeLocalDelete("試合をゴミ箱へ移動しました");
  persistRtdbSnapshot();
}

async function saveCurrentMatchRecords(isAutoSave = false) {
  if (!isStaff()) {
    setSaveStatus("スタッフのみ保存可能");
    return;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }
  if (!state.selectedMatchId) {
    setSaveStatus("先に試合を作成/選択してください");
    return;
  }
  if (!db) {
    setSaveStatus("Firebase未接続（設定待ち）");
    return;
  }

  if (!refreshValidationState()) {
    clearAutoSaveCountdown();
    setSaveState("保存できません", "入力エラーを修正してください", "is-error");
    return;
  }

  const enqueueOfflineSave = () => {
    if (typeof SakuraOfflineSync === "undefined") {
      return;
    }
    SakuraOfflineSync.enqueue("match_save", {
      tournamentId: state.selectedTournamentId,
      matchId: state.selectedMatchId,
      matchPatch: { ...getMatchFormMeta(), substitutions: state.matchSubstitutions },
      records: buildRecordsPayload(),
    });
    state.autoSaveTimerId = null;
    const savedAt = Date.now();
    setLastUpdatedAt(savedAt);
    pushSaveHistory(isAutoSave ? "オフライン自動保存" : "オフライン保存", savedAt);
    setSaveState(
      isAutoSave ? "オフライン自動保存" : "オフライン保存",
      `${formatTime(savedAt)} にローカル保存（同期待ち）`,
      "is-saved",
    );
    persistRtdbSnapshot();
  };

  const canReachRemote =
    typeof SakuraOfflineSync !== "undefined" ? SakuraOfflineSync.isOnline() : navigator.onLine;

  if (!canReachRemote) {
    clearAutoSaveCountdown();
    enqueueOfflineSave();
    return;
  }

  try {
    clearAutoSaveCountdown();
    setSaveState(isAutoSave ? "自動保存中" : "保存中", "Firebase に保存しています", "is-saving");
    const matchPath = `${DB_PATHS.matches}/${state.selectedTournamentId}/${state.selectedMatchId}`;
    const recordsPath = `${DB_PATHS.records}/${state.selectedTournamentId}/${state.selectedMatchId}`;
    const matchPayload = {
      ...buildMatchMetaPayload(),
      substitutions: state.matchSubstitutions,
    };
    const updates = {
      [recordsPath]: buildRecordsPayload(),
    };
    Object.entries(matchPayload).forEach(([key, value]) => {
      updates[`${matchPath}/${key}`] = value;
    });
    await db.ref().update(updates);
    state.autoSaveTimerId = null;
    const savedAt = Date.now();
    setLastUpdatedAt(savedAt);
    pushSaveHistory(isAutoSave ? "自動保存しました" : "手動保存しました", savedAt);
    setSaveState(
      isAutoSave ? "自動保存完了" : "保存完了",
      `${formatTime(savedAt)} に保存しました`,
      "is-saved",
    );
    persistRtdbSnapshot();
  } catch (error) {
    console.error(error);
    state.autoSaveTimerId = null;
    const code = error?.code ?? "unknown";
    if (code === "permission-denied") {
      setSaveState("保存失敗", "Realtime Databaseルールで拒否されています", "is-error");
      return;
    }
    if (
      typeof SakuraOfflineSync !== "undefined" &&
      (code === "unavailable" || code === "network-request-failed" || !navigator.onLine)
    ) {
      enqueueOfflineSave();
      return;
    }
    setSaveState("保存失敗", `エラーコード: ${code}`, "is-error");
  }
}

tournamentSelectEl.addEventListener("change", async () => {
  state.selectedTournamentId = tournamentSelectEl.value;
  const selectedTournament = currentTournaments.find((t) => t.id === state.selectedTournamentId);
  fillTournamentMetaInputs(selectedTournament);
  fillTournamentEditInputs(selectedTournament);
  if (!state.selectedTournamentId || isViewerVirtualTournamentSelection(state.selectedTournamentId)) {
    state.selectedMatchId = "";
  }
  const matches = isStaff()
    ? await loadMatchesByTournament(state.selectedTournamentId)
    : await loadMatchesByViewerSelection(state.selectedTournamentId);
  resetViewerFilters();
  renderMatchOptions(matches);
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  try {
    await loadViewerRecordsForTournament();
    fillMatchMetaInputs(null);
    fillMatchEditInputs(null);
    await loadRecordsForMatch();
  } catch (error) {
    console.error(error);
    setSaveStatus("試合データの一部読み込みに失敗しました（試合一覧は表示中）");
  }
  applyPermission();
});

matchSelectEl.addEventListener("change", async () => {
  state.selectedMatchId = matchSelectEl.value;
  const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
  fillMatchMetaInputs(selected);
  fillMatchEditInputs(selected);
  await loadRecordsForMatch();
  applyPermission();
});

matchOrderAccordionButtonEl?.addEventListener("click", () => {
  toggleMatchOrderAccordion();
});

createTournamentButtonEl.addEventListener("click", () => {
  void createTournament();
});

toggleTournamentCreateButtonEl.addEventListener("click", () => {
  toggleCreateArea(tournamentCreateAreaEl, toggleTournamentCreateButtonEl);
  if (!tournamentCreateAreaEl.classList.contains("hidden")) {
    state.newTournamentParticipantIds = getParticipantSelectablePlayers().map((player) => player.id);
    renderTournamentParticipantLists();
    newTournamentNameEl.focus();
  }
});

toggleTournamentEditButtonEl.addEventListener("click", () => {
  if (!state.selectedTournamentId) {
    setSaveStatus("先に大会を選択してください");
    return;
  }
  fillTournamentEditInputs(getSelectedTournament());
  toggleEditArea(tournamentEditAreaEl, toggleTournamentEditButtonEl);
  if (!tournamentEditAreaEl.classList.contains("hidden")) {
    editTournamentNameEl.focus();
  }
});

confirmTournamentButtonEl.addEventListener("click", async () => {
  if (!state.selectedTournamentId && tournamentSelectEl.value) {
    state.selectedTournamentId = tournamentSelectEl.value;
  }
  if (!state.selectedTournamentId) {
    setSaveStatus("大会を選択してください");
    return;
  }
  const matches = isStaff()
    ? await loadMatchesByTournament(state.selectedTournamentId)
    : await loadMatchesByViewerSelection(state.selectedTournamentId);
  renderMatchOptions(matches);
  fillMatchMetaInputs(null);
  showStep(2);
});

createMatchButtonEl.addEventListener("click", () => {
  void createMatchInSelectedTournament();
});

toggleMatchCreateButtonEl.addEventListener("click", () => {
  toggleCreateArea(matchCreateAreaEl, toggleMatchCreateButtonEl);
  if (!matchCreateAreaEl.classList.contains("hidden")) {
    renderOpponentTeamShortcuts();
    opponentEl.focus();
  }
});

toggleMatchEditButtonEl.addEventListener("click", () => {
  if (!state.selectedMatchId) {
    setSaveStatus("先に試合を選択してください");
    return;
  }
  const selected = currentMatches.find((item) => item.id === state.selectedMatchId);
  fillMatchEditInputs(selected);
  toggleEditArea(matchEditAreaEl, toggleMatchEditButtonEl);
  if (!matchEditAreaEl.classList.contains("hidden")) {
    editOpponentEl.focus();
  }
});

togglePlayerManagementButtonEl.addEventListener("click", () => {
  toggleCreateArea(playerManagementCreateAreaEl, togglePlayerManagementButtonEl);
  if (!playerManagementCreateAreaEl.classList.contains("hidden")) {
    newPlayerNameEl.focus();
  }
});

playerManagementAccordionButtonEl.addEventListener("click", () => {
  togglePlayerManagementAccordion();
});

function toggleStartersRosterAccordion() {
  toggleAccordionAnimated(startersRosterAccordionBodyEl, startersRosterAccordionIconEl);
}

function toggleBenchRosterAccordion() {
  toggleAccordionAnimated(benchRosterAccordionBodyEl, benchRosterAccordionIconEl);
}

function toggleAbsentRosterAccordion() {
  toggleAccordionAnimated(absentRosterAccordionBodyEl, absentRosterAccordionIconEl);
}

startersRosterAccordionButtonEl?.addEventListener("click", () => {
  toggleStartersRosterAccordion();
});

benchRosterAccordionButtonEl?.addEventListener("click", () => {
  toggleBenchRosterAccordion();
});

absentRosterAccordionButtonEl?.addEventListener("click", () => {
  toggleAbsentRosterAccordion();
});

metricsAccordionButtonEl?.addEventListener("click", () => {
  toggleMetricsAccordion();
});

loginInfoAccordionButtonEl?.addEventListener("click", () => {
  toggleLoginInfoAccordion();
});

createPlayerButtonEl.addEventListener("click", () => {
  void createPlayer();
});

updateTournamentButtonEl.addEventListener("click", () => {
  void updateSelectedTournament();
});

deleteTournamentButtonEl.addEventListener("click", () => {
  void deleteSelectedTournament();
});

updateMatchButtonEl.addEventListener("click", () => {
  void updateSelectedMatch();
});

deleteMatchButtonEl.addEventListener("click", () => {
  void deleteSelectedMatch();
});

selectAllViewerMatchesButtonEl.addEventListener("click", () => {
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  renderViewerContent();
});

clearViewerMatchesButtonEl.addEventListener("click", () => {
  state.viewerSelectedMatchIds = [];
  renderViewerContent();
});

viewerMatchFiltersAccordionButtonEl.addEventListener("click", () => {
  toggleAccordionAnimated(viewerMatchFiltersAccordionBodyEl, viewerMatchFiltersAccordionIconEl);
});

viewerAdvancedFiltersAccordionButtonEl?.addEventListener("click", () => {
  toggleAccordionAnimated(viewerAdvancedFiltersAccordionBodyEl, viewerAdvancedFiltersAccordionIconEl);
});

exportViewerCsvButtonEl.addEventListener("click", () => {
  openExportModal();
});

closeExportModalButtonEl.addEventListener("click", () => {
  closeExportModal();
});

cancelExportButtonEl.addEventListener("click", () => {
  closeExportModal();
});

window.addEventListener("resize", () => {
  syncExportTournamentAccordionState();
  syncCsvExportAvailability();
});

selectAllExportTournamentsButtonEl.addEventListener("click", () => {
  state.exportSelectedTournamentIds = currentTournaments.map((t) => t.id);
  renderExportTournamentList();
  exportFilenameInputEl.value = buildDefaultExportFileBaseName();
});

exportTournamentAccordionButtonEl?.addEventListener("click", () => {
  toggleAccordionAnimated(exportTournamentAccordionBodyEl, exportTournamentAccordionIconEl);
});

exportHelpAccordionButtonEl.addEventListener("click", () => {
  toggleAccordionAnimated(exportHelpAccordionBodyEl, exportHelpAccordionIconEl);
});

confirmExportButtonEl.addEventListener("click", async () => {
  await executeExport();
});

exportRetryButtonEl.addEventListener("click", async () => {
  await executeExport();
});

viewerTournamentTypeFilterEl.addEventListener("change", () => {
  state.viewerTournamentTypeFilter = viewerTournamentTypeFilterEl.value;
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  renderViewerContent();
});

viewerStageFilterEl.addEventListener("change", () => {
  state.viewerStageFilter = viewerStageFilterEl.value;
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  renderViewerContent();
});

viewerOpponentFilterEl.addEventListener("change", () => {
  state.viewerOpponentFilter = viewerOpponentFilterEl.value;
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  renderViewerContent();
});

viewerOpponentCategoryFilterEl?.addEventListener("change", () => {
  state.viewerOpponentCategoryFilter = viewerOpponentCategoryFilterEl.value;
  state.viewerSelectedMatchIds = getViewerFilteredMatches().map((match) => match.id);
  renderViewerContent();
});

viewerDetailMatchSelectEl.addEventListener("change", () => {
  state.viewerDetailMatchId = viewerDetailMatchSelectEl.value;
  renderViewerContent();
});

viewerPlayerSelectEl.addEventListener("change", () => {
  state.viewerSelectedPlayerId = viewerPlayerSelectEl.value;
  renderViewerContent();
});

viewerSortKeyEl.addEventListener("change", () => {
  state.viewerSortKey = viewerSortKeyEl.value;
  syncViewerSortControls();
  renderViewerContent();
});

viewerSortOrderEl.addEventListener("change", () => {
  state.viewerSortOrder = viewerSortOrderEl.value;
  syncViewerSortControls();
  renderViewerContent();
});

viewerTotalsAccordionButtonEl.addEventListener("click", () => {
  toggleViewerTotalsAccordion();
});

viewerRankingAccordionButtonEl.addEventListener("click", () => {
  toggleViewerRankingAccordion();
});

viewerDetailAccordionButtonEl.addEventListener("click", () => {
  toggleViewerDetailAccordion();
});

closePlayerProfileButtonEl.addEventListener("click", () => {
  closePlayerProfile();
});

playerProfileModalEl.addEventListener("click", (event) => {
  if (event.target === playerProfileModalEl || event.target.classList.contains("profile-modal-backdrop")) {
    closePlayerProfile();
  }
});

exportModalEl.addEventListener("click", (event) => {
  if (event.target === exportModalEl || event.target.classList.contains("profile-modal-backdrop")) {
    closeExportModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !playerProfileModalEl.classList.contains("hidden")) {
    closePlayerProfile();
  }
  if (event.key === "Escape" && !exportModalEl.classList.contains("hidden")) {
    closeExportModal();
  }
});

viewerSortButtonsEls.forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.dataset.sortKey;
    if (!nextKey) {
      return;
    }
    if (state.viewerSortKey === nextKey) {
      state.viewerSortOrder = state.viewerSortOrder === "desc" ? "asc" : "desc";
    } else {
      state.viewerSortKey = nextKey;
      state.viewerSortOrder = nextKey === "name" ? "asc" : "desc";
    }
    syncViewerSortControls();
    renderViewerContent();
  });
});

viewerDetailSortButtonsEls.forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.dataset.sortKey;
    if (!nextKey) {
      return;
    }
    if (state.viewerDetailSortKey === nextKey) {
      state.viewerDetailSortOrder = state.viewerDetailSortOrder === "desc" ? "asc" : "desc";
    } else {
      state.viewerDetailSortKey = nextKey;
      state.viewerDetailSortOrder = nextKey === "name" ? "asc" : "desc";
    }
    syncViewerDetailSortControls();
    renderViewerContent();
  });
});

showActiveOnlyButtonEl.addEventListener("click", () => {
  state.showActiveOnly = !state.showActiveOnly;
  showActiveOnlyButtonEl.textContent = state.showActiveOnly
    ? "大会参加者全員を表示"
    : "出場選手だけ表示";
  renderTabs();
  renderStats();
});

toggleGuestVisibilityButtonEl?.addEventListener("click", () => {
  state.showGuestPlayers = !state.showGuestPlayers;
  toggleGuestVisibilityButtonEl.textContent = state.showGuestPlayers ? "助っ人を非表示" : "助っ人を表示";
  renderTabs();
  renderStats();
  renderViewerContent();
});

selectAllTournamentParticipantsButtonEl?.addEventListener("click", () => {
  setTournamentParticipantSelection("all", "create");
});
clearTournamentParticipantsButtonEl?.addEventListener("click", () => {
  setTournamentParticipantSelection("none", "create");
});
selectAllEditTournamentParticipantsButtonEl?.addEventListener("click", () => {
  setTournamentParticipantSelection("all", "edit");
});
clearEditTournamentParticipantsButtonEl?.addEventListener("click", () => {
  setTournamentParticipantSelection("none", "edit");
});

tournamentOpponentCategoryModeEl?.addEventListener("change", () => {
  tournamentDefaultOpponentCategoryEl.disabled =
    tournamentOpponentCategoryModeEl.value !== "fixed" || !isStaff();
  fillMatchMetaInputs(getSelectedMatchNormalized());
  fillMatchEditInputs(getSelectedMatchNormalized());
});
editTournamentOpponentCategoryModeEl?.addEventListener("change", () => {
  editTournamentDefaultOpponentCategoryEl.disabled =
    editTournamentOpponentCategoryModeEl.value !== "fixed" || !isStaff();
  fillMatchMetaInputs(getSelectedMatchNormalized());
  fillMatchEditInputs(getSelectedMatchNormalized());
});

confirmMatchButtonEl.addEventListener("click", async () => {
  if (!state.selectedMatchId && matchSelectEl.value) {
    state.selectedMatchId = matchSelectEl.value;
  }
  if (!state.selectedMatchId) {
    setSaveStatus("試合を選択してください");
    return;
  }
  await loadRecordsForMatch();
  openAttendanceStepAfterLoad();
});

backToStep1ButtonEl.addEventListener("click", () => {
  showStep(1);
});

backToStep2ButtonEl.addEventListener("click", () => {
  if (!isStaff()) {
    showStep(2);
    return;
  }
  if (state.currentStep === 3 && hasUnsavedRecordChanges()) {
    openUnsavedLeaveModal(
      async () => {
        await loadRecordsForMatch();
        state.currentStep = 2;
        showStep(2);
      },
      () => {
        state.currentStep = 2;
        showStep(2);
      },
    );
    return;
  }
  state.currentStep = 2;
  showStep(2);
});

lineupCancelPickButtonEl?.addEventListener("click", () => {
  openAttendanceStepAfterLoad();
});

lineupSubmitPickButtonEl?.addEventListener("click", () => {
  validateLineupDraftAndProceed();
});

lineupCancelConfirmButtonEl?.addEventListener("click", () => {
  state.lineupUiPhase = "pick";
  setLineupValidationMessage("", "");
  renderLineupPickPanel();
});

lineupGoRecordsButtonEl?.addEventListener("click", async () => {
  const ids = [...state.lineupDraftIds];
  applyLineupDraftToRecordsAndPersist(ids);
  await persistStartingLineupToFirebase(ids);
  state.currentStep = 3;
  showStep(3);
  renderTabs();
  renderStats();
  queueAutoSave();
  setSaveStatus("スタメンを確定しました");
});

lineupIntegrityBackButtonEl?.addEventListener("click", () => {
  void (async () => {
    await loadRecordsForMatch();
    openAttendanceStepAfterLoad();
  })();
});

attendanceSelectAllPresentButtonEl?.addEventListener("click", () => {
  getTournamentAttendancePlayers().forEach((player) => {
    state.attendanceDraft[player.id] = "present";
  });
  renderAttendancePanel();
});

attendanceCancelButtonEl?.addEventListener("click", () => {
  state.currentStep = 2;
  showStep(2);
});

attendanceConfirmButtonEl?.addEventListener("click", () => {
  confirmAttendanceAndProceed();
});

midMatchAddPlayerButtonEl?.addEventListener("click", () => {
  openMidMatchAddPlayerModal();
});

editMatchAttendanceButtonEl?.addEventListener("click", () => {
  openAttendanceStepAfterLoad();
});

toggleBenchButtonEl.addEventListener("click", () => {
  toggleBenchStatus();
});

togglePlayerActiveButtonEl?.addEventListener("click", () => {
  void togglePlayerActive();
});

saveMatchButtonEl.addEventListener("click", () => {
  void saveCurrentMatchRecords();
});

renderSaveHistory();
toggleTournamentCreateButtonEl.dataset.defaultLabel = "新規大会を追加";
toggleTournamentEditButtonEl.dataset.defaultLabel = "選択中大会を編集";
toggleMatchCreateButtonEl.dataset.defaultLabel = "新規試合を追加";
toggleMatchEditButtonEl.dataset.defaultLabel = "選択中試合を編集";
togglePlayerManagementButtonEl.dataset.defaultLabel = "選手を登録";
showStep(1);
login("player", "");
if (!hasFirebaseConfig) {
  setSaveStatus("Firebase設定値をscript.jsに入力してください");
}

if (
  hasFirebaseConfig &&
  db &&
  typeof SakuraOfflineSync !== "undefined" &&
  typeof SakuraOfflineSyncUI !== "undefined"
) {
  SakuraOfflineSyncUI.init({
    db,
    firebase,
    onAfterSync: () => {
      void initializeData();
    },
  });
  void SakuraOfflineSync.registerServiceWorker("./sw.js");
}

/** 編集モード用: チュートリアル自動表示・手動（?）のサイト全体フラグ（Firebase リアルタイム DB） */
let staffSiteSettingsTutorialListenerAttached = false;
function wireStaffTutorialOfferSetting() {
  if (staffSiteSettingsTutorialListenerAttached || !db) return;
  if (!staffTutorialOfferFirstVisitCheckboxEl || !staffTutorialManualEnabledCheckboxEl || !staffTutorialOfferRowEl) return;
  const settingsRef = getSiteSettingsRef();
  if (!settingsRef) return;
  staffSiteSettingsTutorialListenerAttached = true;
  let syncingFromRemote = false;
  const applyStaffTutorialSiteSettings = (snap) => {
    const o = snap.val() || {};
    syncingFromRemote = true;
    staffTutorialOfferFirstVisitCheckboxEl.checked = o.tutorialOfferFirstVisit !== false;
    staffTutorialManualEnabledCheckboxEl.checked = o.tutorialManualEnabled !== false;
    syncingFromRemote = false;
  };
  settingsRef.once("value", applyStaffTutorialSiteSettings, (err) => {
    console.warn("[script] siteSettings 取得拒否", err);
  });
  settingsRef.on("value", applyStaffTutorialSiteSettings, (err) => {
    console.warn("[script] siteSettings 購読拒否", err);
  });
  staffTutorialOfferFirstVisitCheckboxEl.addEventListener("change", () => {
    if (syncingFromRemote) return;
    void settingsRef
      .update({ tutorialOfferFirstVisit: Boolean(staffTutorialOfferFirstVisitCheckboxEl.checked) })
      .catch((err) => {
        console.error(err);
        alert("設定の保存に失敗しました。Firebase のルールで siteSettings の書き込みが許可されているか確認してください。");
      });
  });
  staffTutorialManualEnabledCheckboxEl.addEventListener("change", () => {
    if (syncingFromRemote) return;
    void settingsRef
      .update({ tutorialManualEnabled: Boolean(staffTutorialManualEnabledCheckboxEl.checked) })
      .catch((err) => {
        console.error(err);
        alert("設定の保存に失敗しました。Firebase のルールで siteSettings の書き込みが許可されているか確認してください。");
      });
  });
}

wireStaffTutorialOfferSetting();
