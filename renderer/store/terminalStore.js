import { create } from 'zustand';

const MAX_TABS = 8;
const VIEW_TERMINAL = 'terminal';

function createSeed() {
  const id = crypto.randomUUID();
  return {
    tabs: [{ id, title: 'main', status: 'running', sessionId: id }],
    activeTabId: id,
  };
}

const seed = createSeed();
const defaultPaneId = seed.activeTabId;

const METRICS_CHART_MAX = 36;

export const useTerminalStore = create((set, get) => ({
  tabs: seed.tabs,
  activeTabId: seed.activeTabId,
  paneSplit: null,
  activePaneId: defaultPaneId,
  paneSizes: { ratio: 0.5 },
  terminalApis: {},
  autocompleteByTerminalId: {},
  themeId: 'hacker',
  customTheme: {
    bgDeep: '#0A0E14',
    bgPanel: '#161B22',
    text: '#E6EDF3',
    accent: '#00FF9C',
    cyan: '#00D4FF',
    border: '#1E2832',
  },
  settingsOpen: false,
  currentView: VIEW_TERMINAL,
  dropzoneActive: false,

  /** WebSocket for the active tab — NL bar / protocol UI */
  aiSocket: null,
  aiSocketOwnerId: null,
  registerAiSocket: (tabId, socket) => set({ aiSocket: socket, aiSocketOwnerId: tabId }),
  unregisterAiSocket: (tabId) =>
    set((s) => (s.aiSocketOwnerId === tabId ? { aiSocket: null, aiSocketOwnerId: null } : {})),

  nlBarOpenNonce: 0,
  nlBarCloseNonce: 0,
  nlBarIsOpen: false,
  requestOpenNLBar: () =>
    set((s) => ({ nlBarOpenNonce: s.nlBarOpenNonce + 1, nlBarIsOpen: true })),
  requestCloseNLBar: () =>
    set((s) => ({ nlBarCloseNonce: s.nlBarCloseNonce + 1, nlBarIsOpen: false })),
  setNlBarIsOpen: (v) => set({ nlBarIsOpen: !!v }),
  toggleNLBar: () => {
    const s = get();
    if (s.nlBarIsOpen) get().requestCloseNLBar();
    else get().requestOpenNLBar();
  },

  pendingNlResult: null,
  setPendingNlResult: (msg) => set({ pendingNlResult: msg }),
  clearPendingNlResult: () => set({ pendingNlResult: null }),

  errorWhisperer: null,
  setErrorWhispererDetected: (msg) =>
    set({
      errorPanelPinned: false,
      errorWhisperer: {
        exit_code: msg.exit_code,
        stderr: msg.stderr ?? '',
        command: msg.command ?? '',
        explanation: null,
        suggested_command: null,
      },
    }),
  mergeErrorWhispererFix: (msg) =>
    set((s) => {
      if (!s.errorWhisperer) return {};
      const base = s.errorWhisperer;
      return {
        errorWhisperer: {
          ...base,
          explanation: msg.explanation ?? base.explanation,
          suggested_command: msg.suggested_command ?? base.suggested_command,
        },
      };
    }),
  clearErrorWhisperer: () => set({ errorWhisperer: null, errorPanelPinned: false }),

  errorPanelPinned: false,
  setErrorPanelPinned: (v) => set({ errorPanelPinned: !!v }),

  historyBySessionId: {},
  historyLoadingBySessionId: {},
  setHistoryEntries: (sessionId, items) =>
    set((s) => ({
      historyBySessionId: { ...s.historyBySessionId, [sessionId]: items },
      historyLoadingBySessionId: { ...s.historyLoadingBySessionId, [sessionId]: false },
    })),
  setHistoryLoading: (sessionId, value) =>
    set((s) => ({
      historyLoadingBySessionId: { ...s.historyLoadingBySessionId, [sessionId]: !!value },
    })),
  upsertHistoryEntry: (sessionId, entry) =>
    set((s) => {
      const current = s.historyBySessionId[sessionId] || [];
      const filtered = current.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 200);
      return {
        historyBySessionId: { ...s.historyBySessionId, [sessionId]: next },
      };
    }),

  setDropzoneActive: (v) => set({ dropzoneActive: !!v }),

  registerTerminalApi: (tabId, api) =>
    set((s) => ({
      terminalApis: { ...s.terminalApis, [tabId]: api },
    })),

  unregisterTerminalApi: (tabId) =>
    set((s) => {
      const next = { ...s.terminalApis };
      delete next[tabId];
      return { terminalApis: next };
    }),

  addTab: () => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) return;
    const id = crypto.randomUUID();
    const t = { id, title: 'tab', status: 'idle', sessionId: id };
    set({ tabs: [...tabs, t], activeTabId: id });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const next = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;
    if (activeTabId === id) {
      nextActive = next[Math.max(0, idx - 1)]?.id ?? next[0]?.id;
    }
    set({ tabs: next, activeTabId: nextActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),
  setActivePane: (id) => set({ activePaneId: id }),

  splitHorizontal: () =>
    set((s) => {
      const rightId = crypto.randomUUID();
      const rightSessionId = crypto.randomUUID();
      const leftSessionId =
        s.paneSplit?.left?.sessionId ??
        s.tabs.find((t) => t.id === s.activeTabId)?.sessionId ??
        s.activeTabId;
      return {
        paneSplit: {
          orientation: 'horizontal',
          left: { id: s.activePaneId || s.activeTabId, sessionId: leftSessionId },
          right: { id: rightId, sessionId: rightSessionId },
        },
        activePaneId: rightId,
        paneSizes: { ratio: 0.5 },
      };
    }),
  splitVertical: () =>
    set((s) => {
      const bottomId = crypto.randomUUID();
      const bottomSessionId = crypto.randomUUID();
      const topSessionId =
        s.paneSplit?.left?.sessionId ??
        s.tabs.find((t) => t.id === s.activeTabId)?.sessionId ??
        s.activeTabId;
      return {
        paneSplit: {
          orientation: 'vertical',
          left: { id: s.activePaneId || s.activeTabId, sessionId: topSessionId },
          right: { id: bottomId, sessionId: bottomSessionId },
        },
        activePaneId: bottomId,
        paneSizes: { ratio: 0.5 },
      };
    }),
  clearSplit: () => set({ paneSplit: null, activePaneId: get().activeTabId, paneSizes: { ratio: 0.5 } }),
  setPaneRatio: (ratio) => set({ paneSizes: { ratio: Math.max(0.2, Math.min(0.8, ratio)) } }),

  setAutocompleteState: (terminalId, patch) =>
    set((s) => ({
      autocompleteByTerminalId: {
        ...s.autocompleteByTerminalId,
        [terminalId]: {
          visible: false,
          items: [],
          selectedIndex: 0,
          ghostText: '',
          query: '',
          ...(s.autocompleteByTerminalId[terminalId] || {}),
          ...(patch || {}),
        },
      },
    })),
  clearAutocompleteState: (terminalId) =>
    set((s) => ({
      autocompleteByTerminalId: {
        ...s.autocompleteByTerminalId,
        [terminalId]: {
          visible: false,
          items: [],
          selectedIndex: 0,
          ghostText: '',
          query: '',
        },
      },
    })),
  cycleAutocomplete: (terminalId, delta) =>
    set((s) => {
      const cur = s.autocompleteByTerminalId[terminalId];
      if (!cur?.items?.length) return {};
      const len = cur.items.length;
      const idx = (((cur.selectedIndex ?? 0) + delta) % len + len) % len;
      return {
        autocompleteByTerminalId: {
          ...s.autocompleteByTerminalId,
          [terminalId]: { ...cur, selectedIndex: idx, ghostText: cur.items[idx]?.value || '' },
        },
      };
    }),

  setThemeId: (themeId) => set({ themeId }),
  setCustomTheme: (patch) => set((s) => ({ customTheme: { ...s.customTheme, ...(patch || {}) } })),
  setSettingsOpen: (value) => set({ settingsOpen: !!value }),
  toggleSettingsOpen: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tabs.length ||
      toIndex >= tabs.length
    ) {
      return;
    }
    const copy = [...tabs];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    set({ tabs: copy });
  },

  updateTabTitle: (tabId, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    })),

  setTabStatus: (tabId, status) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, status } : t)),
    })),

  latestMetrics: null,
  metricsHistory: {
    t: [],
    cpu: [],
    ram: [],
    disk: [],
    netUp: [],
    netDn: [],
  },
  setMetrics: (msg) =>
    set((s) => {
      const cap = (arr, v) => [...arr, v].slice(-METRICS_CHART_MAX);
      const t = Date.now();
      const h = s.metricsHistory;
      return {
        latestMetrics: msg,
        metricsHistory: {
          t: cap(h.t, t),
          cpu: cap(h.cpu, msg.cpu ?? 0),
          ram: cap(h.ram, msg.ram ?? 0),
          disk: cap(h.disk, msg.disk ?? 0),
          netUp: cap(h.netUp, msg.net_up ?? 0),
          netDn: cap(h.netDn, msg.net_dn ?? 0),
        },
      };
    }),

  systemPanelOpen: false,
  toggleSystemPanel: () => set((s) => ({ systemPanelOpen: !s.systemPanelOpen })),
  setSystemPanelOpen: (v) => set({ systemPanelOpen: !!v }),

  fileExplorerOpen: false,
  toggleFileExplorer: () => set((s) => ({ fileExplorerOpen: !s.fileExplorerOpen })),
  fileExplorerSearchNonce: 0,
  requestFileExplorerSearch: () => set((s) => ({ fileExplorerSearchNonce: s.fileExplorerSearchNonce + 1 })),

  /** VS Code–style tree: root folder, expanded absolute paths, drag-drop highlight */
  fileExplorerTreeRoot: '',
  fileExplorerExpanded: {},
  fileExplorerHighlightDir: '',
  fileExplorerHighlightNames: [],
  setFileExplorerTreeRoot: (nextRoot) =>
    set((s) => {
      const n = (nextRoot || '').replace(/[/\\]+$/, '');
      const exp = { ...s.fileExplorerExpanded };
      const nNorm = n.replace(/\\/g, '/').toLowerCase();
      for (const k of Object.keys(exp)) {
        const kNorm = k.replace(/\\/g, '/').toLowerCase();
        if (kNorm !== nNorm && !kNorm.startsWith(`${nNorm}/`)) delete exp[k];
      }
      return { fileExplorerTreeRoot: n, fileExplorerExpanded: exp };
    }),
  toggleFileExplorerExpanded: (path) => {
    const p = path || '';
    if (!p) return;
    set((s) => {
      const cur = !!s.fileExplorerExpanded[p];
      if (p === s.fileExplorerTreeRoot && cur) {
        return {};
      }
      return { fileExplorerExpanded: { ...s.fileExplorerExpanded, [p]: !cur } };
    });
  },
  setFileExplorerExpandedMany: (paths, value = true) =>
    set((s) => {
      const next = { ...s.fileExplorerExpanded };
      for (const p of paths || []) {
        if (!p) continue;
        next[p] = !!value;
      }
      return { fileExplorerExpanded: next };
    }),
  applyFileExplorerReveal: ({ root, expandedPaths, highlightDir, highlightNames }) =>
    set((s) => {
      const nextExp = { ...s.fileExplorerExpanded };
      for (const p of expandedPaths || []) {
        if (p) nextExp[p] = true;
      }
      return {
        fileExplorerOpen: true,
        fileExplorerTreeRoot: root || '',
        fileExplorerExpanded: nextExp,
        fileExplorerHighlightDir: highlightDir || '',
        fileExplorerHighlightNames: Array.isArray(highlightNames) ? highlightNames : [],
      };
    }),
  clearFileExplorerHighlights: () =>
    set({ fileExplorerHighlightDir: '', fileExplorerHighlightNames: [] }),

  setCurrentView: (view) => set({ currentView: view }),
  toggleHistory: () =>
    set((s) => ({ currentView: s.currentView === 'history' ? VIEW_TERMINAL : 'history' })),
  openSnippets: () => set({ currentView: 'snippets' }),
  openReplay: () => set({ currentView: 'replay' }),
  openTerminalView: () => set({ currentView: VIEW_TERMINAL }),

  terminalCwdByTabId: {},
  setTerminalCwdForTab: (tabId, cwd) =>
    set((s) => ({
      terminalCwdByTabId: { ...s.terminalCwdByTabId, [tabId]: cwd },
    })),

  snippets: [],
  snippetsLoading: false,
  snippetSearch: '',
  setSnippetSearch: (value) => set({ snippetSearch: value }),
  setSnippetsLoading: (value) => set({ snippetsLoading: !!value }),
  setSnippets: (items) => set({ snippets: items, snippetsLoading: false }),

  recordingBySessionId: {},
  setRecordingState: (sessionId, payload) =>
    set((s) => ({
      recordingBySessionId: {
        ...s.recordingBySessionId,
        [sessionId]: {
          ...(s.recordingBySessionId[sessionId] || {}),
          ...payload,
        },
      },
    })),

  recordingsBySessionId: {},
  setRecordingsForSession: (sessionId, items) =>
    set((s) => ({
      recordingsBySessionId: { ...s.recordingsBySessionId, [sessionId]: items },
    })),

  replayData: null,
  replayLoading: false,
  setReplayLoading: (value) => set({ replayLoading: !!value }),
  setReplayData: (value) => set({ replayData: value, replayLoading: false }),
}));
