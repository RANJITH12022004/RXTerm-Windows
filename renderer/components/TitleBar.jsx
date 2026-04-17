import { useEffect, useRef } from 'react';
import TabBar from './TabBar.jsx';
import { FolderSimple, Pulse, ClockCounterClockwise, Textbox, TerminalWindow, PlayCircle, RadioButton, Palette } from '@phosphor-icons/react';
import { useTerminalStore } from '../store/terminalStore.js';
import { pulseRecBadge } from '../animations/anime-effects.js';

export default function TitleBar() {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const toggleFileExplorer = useTerminalStore((s) => s.toggleFileExplorer);
  const toggleSystemPanel = useTerminalStore((s) => s.toggleSystemPanel);
  const openTerminalView = useTerminalStore((s) => s.openTerminalView);
  const toggleHistory = useTerminalStore((s) => s.toggleHistory);
  const openSnippets = useTerminalStore((s) => s.openSnippets);
  const openReplay = useTerminalStore((s) => s.openReplay);
  const currentView = useTerminalStore((s) => s.currentView);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const tabs = useTerminalStore((s) => s.tabs);
  const aiSocket = useTerminalStore((s) => s.aiSocket);
  const recordingBySessionId = useTerminalStore((s) => s.recordingBySessionId);
  const recRef = useRef(null);
  const toggleSettingsOpen = useTerminalStore((s) => s.toggleSettingsOpen);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const isRecording = activeTab ? !!recordingBySessionId[activeTab.sessionId]?.is_recording : false;

  useEffect(() => {
    const el = recRef.current;
    if (!el || !isRecording) return undefined;
    const anim = pulseRecBadge(el);
    return () => anim?.pause?.();
  }, [isRecording]);

  const toggleRecording = () => {
    if (!aiSocket || !activeTab) return;
    aiSocket.send(JSON.stringify({ type: 'recording_toggle', enabled: !isRecording }));
  };

  return (
    <header className="title-bar">
      <div className="brand-mark" title="RXTerm">
        <div className="brand-wordmark brand-lockup-c">
          <div className="brand-inline-main">
            <span className="brand-inline-rx">RX</span>
            <span className="brand-inline-term">TERM</span>
          </div>
        </div>
      </div>
      <div className="tab-bar-wrapper">
        <TabBar />
      </div>
      <div className="title-toolbar">
        <button
          type="button"
          className={`title-toolbar-btn ${currentView === 'terminal' ? 'active' : ''}`}
          title="Terminal view"
          onClick={() => openTerminalView()}
        >
          <TerminalWindow size={18} />
        </button>
        <button
          type="button"
          className={`title-toolbar-btn ${currentView === 'history' ? 'active' : ''}`}
          title="History (Ctrl+Shift+H)"
          onClick={() => toggleHistory()}
        >
          <ClockCounterClockwise size={18} />
        </button>
        <button
          type="button"
          className={`title-toolbar-btn ${currentView === 'snippets' ? 'active' : ''}`}
          title="Snippets (Ctrl+Shift+S)"
          onClick={() => openSnippets()}
        >
          <Textbox size={18} />
        </button>
        <button
          type="button"
          className={`title-toolbar-btn ${currentView === 'replay' ? 'active' : ''}`}
          title="Replay view"
          onClick={() => openReplay()}
        >
          <PlayCircle size={18} />
        </button>
        <button
          type="button"
          className="title-toolbar-btn"
          title="Recording (Ctrl+Shift+R)"
          onClick={toggleRecording}
        >
          <span ref={recRef} className={`rec-toolbar-badge ${isRecording ? 'active' : ''}`}>
            <RadioButton size={14} weight="fill" />
            REC
          </span>
        </button>
        <button
          type="button"
          className="title-toolbar-btn"
          title="Files (Ctrl+Shift+F)"
          onClick={() => toggleFileExplorer()}
        >
          <FolderSimple size={18} />
        </button>
        <button
          type="button"
          className="title-toolbar-btn"
          title="Themes (Ctrl+Shift+T)"
          onClick={() => toggleSettingsOpen()}
        >
          <Palette size={18} />
        </button>
        <button
          type="button"
          className="title-toolbar-btn"
          title="System metrics (Ctrl+Shift+M)"
          onClick={() => toggleSystemPanel()}
        >
          <Pulse size={18} />
        </button>
      </div>
      <div className="window-controls">
        <button
          type="button"
          className="window-btn minimize"
          aria-label="Minimize"
          onClick={() => api?.minimize?.()}
        >
          <svg className="window-btn-icon" viewBox="0 0 10 10" aria-hidden>
            <path d="M0 5h10" fill="none" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </button>
        <button
          type="button"
          className="window-btn maximize"
          aria-label="Maximize"
          onClick={() => api?.maximize?.()}
        >
          <svg className="window-btn-icon" viewBox="0 0 10 10" aria-hidden>
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </button>
        <button
          type="button"
          className="window-btn close"
          aria-label="Close"
          onClick={() => api?.close?.()}
        >
          <svg className="window-btn-icon" viewBox="0 0 10 10" aria-hidden>
            <path d="M1 1l8 8M9 1L1 9" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
          </svg>
        </button>
      </div>
    </header>
  );
}
