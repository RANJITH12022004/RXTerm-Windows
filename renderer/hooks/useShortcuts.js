// renderer/hooks/useShortcuts.js
import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminalStore.js';

export function useShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      // IMPORTANT: don't prevent default for printable characters.
      // Only intercept specific combos.
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().toggleNLBar();
      } else if (e.ctrlKey && e.code === 'KeyT') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().addTab();
      } else if (e.ctrlKey && e.code === 'KeyW') {
        e.preventDefault();
        e.stopPropagation();
        const { activeTabId, closeTab } = useTerminalStore.getState();
        closeTab(activeTabId);
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().toggleSystemPanel();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().splitVertical();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().splitHorizontal();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyQ') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().clearSplit();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().toggleFileExplorer();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().toggleHistory();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().openSnippets();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        const st = useTerminalStore.getState();
        const activeTab = st.tabs.find((tab) => tab.id === st.activeTabId);
        if (!activeTab || !st.aiSocket) return;
        const active = !!st.recordingBySessionId[activeTab.sessionId]?.is_recording;
        st.aiSocket.send(JSON.stringify({ type: 'recording_toggle', enabled: !active }));
      } else if (e.code === 'Escape') {
        const st = useTerminalStore.getState();
        if (st.currentView !== 'terminal') {
          e.preventDefault();
          e.stopPropagation();
          st.openTerminalView();
        }
      } else if (e.ctrlKey && e.code === 'KeyP') {
        const st = useTerminalStore.getState();
        if (st.fileExplorerOpen) {
          e.preventDefault();
          e.stopPropagation();
          st.requestFileExplorerSearch();
        }
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        e.stopPropagation();
        useTerminalStore.getState().toggleSettingsOpen();
      }
    };
    // Capture phase: xterm.js consumes many keys on the terminal before they bubble to window.
    // Electron (terminal focused) never reached this handler without capture; browser often did
    // when focus wasn't on the canvas.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
