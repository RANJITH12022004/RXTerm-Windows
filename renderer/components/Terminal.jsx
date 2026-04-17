// renderer/components/Terminal.jsx
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '../store/terminalStore.js';
import { showAutocomplete, hideAutocomplete } from '../animations/gsap-timelines.js';

const LS_API = 'http://127.0.0.1:8765/api/ls';

const XTERM_THEMES = {
  hacker: {
    background: '#0A0E14',
    foreground: '#E6EDF3',
    cursor: '#00FF9C',
    cursorAccent: '#0A0E14',
    selectionBackground: 'rgba(0, 255, 156, 0.2)',
    black: '#0A0E14',
    brightBlack: '#4A5568',
    red: '#FF4C60',
    brightRed: '#FF4C60',
    green: '#00FF9C',
    brightGreen: '#00FF9C',
    yellow: '#F0A500',
    brightYellow: '#F0A500',
    blue: '#00D4FF',
    brightBlue: '#00D4FF',
    magenta: '#BD93F9',
    brightMagenta: '#BD93F9',
    cyan: '#00D4FF',
    brightCyan: '#00D4FF',
    white: '#E6EDF3',
    brightWhite: '#FFFFFF',
  },
  matrix: { background: '#030d05', foreground: '#b7ffcf', cursor: '#00ff66', cursorAccent: '#030d05' },
  ember: { background: '#140b08', foreground: '#ffd9c2', cursor: '#ff8f00', cursorAccent: '#140b08' },
  arctic: { background: '#09121a', foreground: '#d8f4ff', cursor: '#59d5ff', cursorAccent: '#09121a' },
  violet: { background: '#120a1f', foreground: '#f1e8ff', cursor: '#bd93f9', cursorAccent: '#120a1f' },
};

const TerminalComponent = forwardRef(function TerminalComponent(
  { ws, sessionId, tabId, isActive, isVisible = isActive },
  ref,
) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const registerTerminalApi = useTerminalStore((s) => s.registerTerminalApi);
  const unregisterTerminalApi = useTerminalStore((s) => s.unregisterTerminalApi);
  const autocomplete = useTerminalStore((s) => s.autocompleteByTerminalId[tabId]);
  const setAutocompleteState = useTerminalStore((s) => s.setAutocompleteState);
  const clearAutocompleteState = useTerminalStore((s) => s.clearAutocompleteState);
  const cycleAutocomplete = useTerminalStore((s) => s.cycleAutocomplete);
  const themeId = useTerminalStore((s) => s.themeId);
  const customTheme = useTerminalStore((s) => s.customTheme);
  const autocompletePopupRef = useRef(null);
  const currentLineRef = useRef('');
  const completionTimerRef = useRef(null);

  const activeTheme = useMemo(() => {
    if (themeId === 'custom') {
      return {
        background: customTheme.bgDeep,
        foreground: customTheme.text,
        cursor: customTheme.accent,
        cursorAccent: customTheme.bgDeep,
        selectionBackground: 'rgba(0, 255, 156, 0.2)',
      };
    }
    return XTERM_THEMES[themeId] || XTERM_THEMES.hacker;
  }, [themeId, customTheme]);

  const sendPastedInput = (text) => {
    if (!text) return;
    wsRef.current?.send(text);
  };

  useImperativeHandle(
    ref,
    () => ({
      paste: (text) => sendPastedInput(text),
      focus: () => xtermRef.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current || !ws || !tabId) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 2,
      theme: activeTheme,
      allowTransparency: true,
      scrollback: 5000,
      fastScrollModifier: 'shift',
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    const attachAddon = new AttachAddon(ws);
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(attachAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    fitAddon.fit();
    ws.send(
      JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }),
    );

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    wsRef.current = ws;

    const api = {
      paste: (text) => sendPastedInput(text),
      focus: () => term.focus(),
      fit: () => fitAddon.fit(),
    };
    registerTerminalApi(tabId, api);

    const handleResize = () => {
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    window.addEventListener('resize', handleResize);

    const handleContainerClick = () => term.focus();
    containerRef.current.addEventListener('click', handleContainerClick);

    // Paste must be intercepted in the capture phase on an ancestor. xterm registers its
    // own textarea paste handlers first; a bubble listener runs too late, so preventDefault
    // does not stop onData → the PTY gets the paste twice (plus our ws.send → 3× on screen).
    const handlePasteCapture = (e) => {
      if (!containerRef.current?.contains(e.target)) return;
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      sendPastedInput(text);
    };
    containerRef.current.addEventListener('paste', handlePasteCapture, true);
    const disposable = term.onData((chunk) => {
      if (chunk === '\r' || chunk === '\n') {
        currentLineRef.current = '';
        clearAutocompleteState(tabId);
        return;
      }
      if (chunk === '\u007f') {
        currentLineRef.current = currentLineRef.current.slice(0, -1);
      } else if (chunk.length === 1 && chunk >= ' ') {
        currentLineRef.current += chunk;
      }
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(async () => {
        const query = currentLineRef.current.trim();
        if (!query) {
          clearAutocompleteState(tabId);
          return;
        }

        const history = useTerminalStore.getState().historyBySessionId[sessionId] || [];
        const h = history
          .map((x) => x.command)
          .filter((x) => typeof x === 'string' && x.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 2)
          .map((value) => ({ value, source: 'history' }));

        let fsItems = [];
        try {
          const cwd = useTerminalStore.getState().terminalCwdByTabId[tabId] || '.';
          const res = await fetch(`${LS_API}?path=${encodeURIComponent(cwd)}`);
          const data = await res.json();
          const names = [...(data?.dirs || []), ...(data?.files || [])];
          fsItems = names
            .filter((n) => n.toLowerCase().startsWith(query.toLowerCase()))
            .slice(0, 2)
            .map((n) => ({ value: n, source: 'fs' }));
        } catch {
          fsItems = [];
        }

        try {
          ws.send(JSON.stringify({ type: 'completion_query', text: query, terminal_id: tabId }));
        } catch {
          /* noop */
        }

        const merged = [...h, ...fsItems].slice(0, 4);
        setAutocompleteState(tabId, {
          visible: merged.length > 0,
          items: merged,
          selectedIndex: 0,
          query,
          ghostText: merged[0]?.value || '',
        });
      }, 800);
    });

    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      disposable.dispose();
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('click', handleContainerClick);
      containerRef.current?.removeEventListener('paste', handlePasteCapture, true);
      unregisterTerminalApi(tabId);
      xtermRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
      term.dispose();
    };
  }, [ws, sessionId, tabId, registerTerminalApi, unregisterTerminalApi, clearAutocompleteState, setAutocompleteState, activeTheme]);

  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    const socket = wsRef.current;
    if (!isActive || !term || !fitAddon || !socket) return;
    requestAnimationFrame(() => {
      fitAddon.fit();
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      term.focus();
    });
  }, [isActive]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    const popup = autocompletePopupRef.current;
    if (!popup) return;
    if (autocomplete?.visible) showAutocomplete(popup);
    else hideAutocomplete(popup);
  }, [autocomplete?.visible]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e) => {
      if (!autocomplete?.visible || !autocomplete?.items?.length) return;
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        cycleAutocomplete(tabId, 1);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        cycleAutocomplete(tabId, -1);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        const selected = autocomplete.items[autocomplete.selectedIndex] || autocomplete.items[0];
        if (!selected?.value) return;
        const current = currentLineRef.current;
        const value = selected.value;
        const add = value.startsWith(current) ? value.slice(current.length) : value;
        if (add) sendPastedInput(add);
        currentLineRef.current = value;
        clearAutocompleteState(tabId);
      } else if (e.code === 'Escape') {
        clearAutocompleteState(tabId);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [autocomplete, isActive, tabId, cycleAutocomplete, clearAutocompleteState]);

  return (
    <div
      className="terminal-shell"
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: isVisible ? 'all' : 'none',
        userSelect: 'none',
        position: 'absolute',
        inset: 0,
        visibility: isVisible ? 'visible' : 'hidden',
        zIndex: isVisible ? 1 : 0,
      }}
    >
      <div ref={containerRef} className="terminal-container" data-tab-terminal={tabId} style={{ width: '100%', height: '100%' }} />
      {autocomplete?.visible ? (
        <div ref={autocompletePopupRef} className="autocomplete-popup">
          {autocomplete.items.map((item, idx) => (
            <div key={`${item.value}-${idx}`} className={`autocomplete-item ${idx === autocomplete.selectedIndex ? 'selected' : ''}`}>
              <span className="autocomplete-source">{item.source}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {autocomplete?.ghostText && autocomplete.query ? (
        <div className="autocomplete-ghost">{autocomplete.ghostText}</div>
      ) : null}
    </div>
  );
});

export default TerminalComponent;
