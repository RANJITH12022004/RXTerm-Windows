import { useEffect, useRef, useState } from 'react';
import Terminal from './components/Terminal.jsx';
import BootScreen from './components/BootScreen.jsx';
import TitleBar from './components/TitleBar.jsx';
import DropzoneOverlay from './components/DropzoneOverlay.jsx';
import NLBar from './components/NLBar.jsx';
import ErrorPanel from './components/ErrorPanel.jsx';
import HistoryTimeline from './components/HistoryTimeline.jsx';
import SnippetLibrary from './components/SnippetLibrary.jsx';
import FileExplorer from './components/FileExplorer.jsx';
import ReplayView from './components/ReplayView.jsx';
import SystemPanel from './components/SystemPanel.jsx';
import ThemeSettings from './components/ThemeSettings.jsx';
import { useTerminalWebSocket } from './hooks/useWebSocket.js';
import { useDragDrop } from './hooks/useDragDrop.js';
import { useShortcuts } from './hooks/useShortcuts.js';
import { useTerminalStore } from './store/terminalStore.js';
import { startScanline } from './animations/anime-effects.js';
import { animatePaneCreate } from './animations/gsap-timelines.js';
import { animateDivider } from './animations/anime-effects.js';

function TabPane({ tab, isActive, isVisible = isActive }) {
  const updateTabTitle = useTerminalStore((s) => s.updateTabTitle);
  const setTerminalCwdForTab = useTerminalStore((s) => s.setTerminalCwdForTab);
  const setMetrics = useTerminalStore((s) => s.setMetrics);
  const setPendingNlResult = useTerminalStore((s) => s.setPendingNlResult);
  const setErrorWhispererDetected = useTerminalStore((s) => s.setErrorWhispererDetected);
  const mergeErrorWhispererFix = useTerminalStore((s) => s.mergeErrorWhispererFix);
  const registerAiSocket = useTerminalStore((s) => s.registerAiSocket);
  const unregisterAiSocket = useTerminalStore((s) => s.unregisterAiSocket);
  const upsertHistoryEntry = useTerminalStore((s) => s.upsertHistoryEntry);
  const setRecordingState = useTerminalStore((s) => s.setRecordingState);

  const { socket } = useTerminalWebSocket(tab.sessionId, {
    cwd_change: (msg) => {
      const cwd = msg.cwd;
      if (typeof cwd === 'string' && cwd.length) {
        setTerminalCwdForTab(tab.id, cwd);
        const base = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop();
        if (base) updateTabTitle(tab.id, base);
      }
    },
    metrics: (msg) => setMetrics(msg),
    nl_result: (msg) => {
      if (!isActive) return;
      setPendingNlResult(msg);
    },
    error_detected: (msg) => {
      if (!isActive) return;
      if (useTerminalStore.getState().errorPanelPinned) return;
      setErrorWhispererDetected(msg);
    },
    ai_fix: (msg) => {
      if (!isActive) return;
      mergeErrorWhispererFix(msg);
    },
    history_entry: (msg) => {
      if (msg.entry) upsertHistoryEntry(tab.sessionId, msg.entry);
    },
    recording_status: (msg) => {
      setRecordingState(tab.sessionId, msg);
    },
    completion_result: (msg) => {
      const terminalId = msg.terminal_id || tab.id;
      const items = Array.isArray(msg.items) ? msg.items : [];
      useTerminalStore.getState().setAutocompleteState(terminalId, {
        visible: items.length > 0,
        items,
        selectedIndex: 0,
        query: msg.query || '',
        ghostText: items[0]?.value || '',
      });
    },
    pong: () => {},
  });

  useEffect(() => {
    if (!socket) return;
    if (!isActive) return;
    registerAiSocket(tab.id, socket);
    try {
      socket.send(JSON.stringify({ type: 'recording_status_request' }));
    } catch {
      /* noop */
    }
    return () => unregisterAiSocket(tab.id);
  }, [socket, isActive, tab.id, registerAiSocket, unregisterAiSocket]);

  if (!socket) return null;

  return (
    <Terminal
      ws={socket}
      sessionId={tab.sessionId}
      tabId={tab.id}
      isActive={isActive}
      isVisible={isVisible}
    />
  );
}

function TerminalWorkspace() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const paneSplit = useTerminalStore((s) => s.paneSplit);
  const paneSizes = useTerminalStore((s) => s.paneSizes);
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const setPaneRatio = useTerminalStore((s) => s.setPaneRatio);
  const terminalApis = useTerminalStore((s) => s.terminalApis);
  const dragRef = useRef(null);
  const effectiveActiveTabId = tabs.some((t) => t.id === activeTabId) ? activeTabId : tabs[0]?.id;

  useEffect(() => {
    if (!paneSplit) return;
    const panes = dragRef.current?.querySelectorAll('.pane') || [];
    panes.forEach((el) => animatePaneCreate(el));
    const div = dragRef.current?.querySelector('.pane-divider');
    if (div) animateDivider(div);

    const onMove = (e) => {
      if (!dragRef.current) return;
      const rect = dragRef.current.getBoundingClientRect();
      if (paneSplit.orientation === 'horizontal') {
        setPaneRatio((e.clientX - rect.left) / rect.width);
      } else {
        setPaneRatio((e.clientY - rect.top) / rect.height);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const start = () => {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    const el = dragRef.current?.querySelector('.pane-divider');
    if (!el) return;
    el.addEventListener('mousedown', start);
    return () => {
      el.removeEventListener('mousedown', start);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [paneSplit, setPaneRatio]);

  useEffect(() => {
    Object.values(terminalApis).forEach((api) => api?.fit?.());
  }, [paneSplit, paneSizes.ratio, terminalApis]);

  if (paneSplit) {
    const leftTab = { id: paneSplit.left.id, sessionId: paneSplit.left.sessionId, title: 'left' };
    const rightTab = { id: paneSplit.right.id, sessionId: paneSplit.right.sessionId, title: 'right' };
    const horizontal = paneSplit.orientation === 'horizontal';
    return (
      <div className={`terminal-split ${horizontal ? 'horizontal' : 'vertical'}`} ref={dragRef}>
        <div
          className={`pane ${activePaneId === leftTab.id ? 'active' : ''}`}
          style={horizontal ? { width: `${paneSizes.ratio * 100}%` } : { height: `${paneSizes.ratio * 100}%` }}
          onMouseDown={() => setActivePane(leftTab.id)}
        >
          <TabPane tab={leftTab} isActive={activePaneId === leftTab.id} isVisible />
        </div>
        <div className={`pane-divider ${horizontal ? 'horizontal' : 'vertical'}`} />
        <div
          className={`pane ${activePaneId === rightTab.id ? 'active' : ''}`}
          style={horizontal ? { width: `${(1 - paneSizes.ratio) * 100}%` } : { height: `${(1 - paneSizes.ratio) * 100}%` }}
          onMouseDown={() => setActivePane(rightTab.id)}
        >
          <TabPane tab={rightTab} isActive={activePaneId === rightTab.id} isVisible />
        </div>
        <DropzoneOverlay />
        <NLBar />
        <ErrorPanel />
      </div>
    );
  }

  return (
    <div className="terminal-main-row">
      <div className="terminal-wrapper">
        {tabs.map((tab) => (
          <TabPane key={tab.id} tab={tab} isActive={tab.id === effectiveActiveTabId} />
        ))}
        <DropzoneOverlay />
        <NLBar />
        <ErrorPanel />
      </div>
    </div>
  );
}

function AppShell() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const terminalApis = useTerminalStore((s) => s.terminalApis);
  const paneSplit = useTerminalStore((s) => s.paneSplit);
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const currentView = useTerminalStore((s) => s.currentView);
  const openTerminalView = useTerminalStore((s) => s.openTerminalView);
  const themeId = useTerminalStore((s) => s.themeId);
  const customTheme = useTerminalStore((s) => s.customTheme);
  const viewRefs = useRef({});

  const scanlineRef = useRef(null);
  const scanAnimRef = useRef(null);
  const terminalRef = useRef({ paste: () => {}, focus: () => {} });

  useShortcuts();

  useEffect(() => {
    const key = paneSplit ? activePaneId : activeTabId;
    terminalRef.current = terminalApis[key] ?? { paste: () => {}, focus: () => {}, fit: () => {} };
  }, [terminalApis, activeTabId, paneSplit, activePaneId]);

  useDragDrop(terminalRef);

  useEffect(() => {
    let cancelled = false;
    import('./animations/barba-config.js')
      .then((m) => {
        if (!cancelled) m.initBarba();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentView !== 'terminal') return;
    requestAnimationFrame(() => {
      terminalRef.current?.focus?.();
    });
  }, [currentView, activeTabId]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove('theme-matrix', 'theme-ember', 'theme-arctic', 'theme-violet');
    body.style.removeProperty('--bg-deep');
    body.style.removeProperty('--bg-panel');
    body.style.removeProperty('--text');
    body.style.removeProperty('--accent');
    body.style.removeProperty('--cyan');
    body.style.removeProperty('--border');
    if (themeId !== 'hacker' && themeId !== 'custom') {
      body.classList.add(`theme-${themeId}`);
    }
    if (themeId === 'custom') {
      body.style.setProperty('--bg-deep', customTheme.bgDeep);
      body.style.setProperty('--bg-panel', customTheme.bgPanel);
      body.style.setProperty('--text', customTheme.text);
      body.style.setProperty('--accent', customTheme.accent);
      body.style.setProperty('--cyan', customTheme.cyan);
      body.style.setProperty('--border', customTheme.border);
    }
  }, [themeId, customTheme]);

  useEffect(() => {
    const el = scanlineRef.current;
    if (!el) return;
    const anim = startScanline(el);
    scanAnimRef.current = anim;
    return () => {
      if (anim && typeof anim.pause === 'function') anim.pause();
      scanAnimRef.current = null;
    };
  }, []);

  return (
    <div data-barba="wrapper" className="barba-wrapper">
      <div className="app-shell" data-barba="container" data-barba-namespace={currentView}>
        <div ref={scanlineRef} className="matrix-scanline" aria-hidden />
        <TitleBar />
        <FileExplorer />
        <main className="main-area">
          <div className="view-stack">
            <section
              ref={(el) => {
                viewRefs.current.terminal = el;
              }}
              className="view-screen active"
              data-view="terminal"
            >
              <TerminalWorkspace />
            </section>

            {currentView !== 'terminal' ? (
              <section
                ref={(el) => {
                  viewRefs.current[currentView] = el;
                }}
                className="overlay-shell active"
                data-view={currentView}
              >
                <div className="overlay-backdrop" onMouseDown={() => openTerminalView()} />
                <div className="overlay-panel" onMouseDown={(e) => e.stopPropagation()}>
                  {currentView === 'history' ? <HistoryTimeline /> : null}
                  {currentView === 'snippets' ? <SnippetLibrary terminalRef={terminalRef} /> : null}
                  {currentView === 'replay' ? <ReplayView /> : null}
                </div>
              </section>
            ) : null}
          </div>
        </main>
        <SystemPanel />
        <ThemeSettings />
        <footer className="status-bar">
          <span className="segment">
            <span className="accent">tabs</span> {tabs.length} · <span className="accent">active</span>{' '}
            {activeTabId?.slice(0, 8)}…
          </span>
          <span className="segment text-dim">RXTerm</span>
          <span className="segment">
            <span className="accent">view</span> {currentView}
          </span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [bootDone, setBootDone] = useState(false);

  if (!bootDone) {
    return <BootScreen onDone={() => setBootDone(true)} />;
  }

  return <AppShell />;
}
