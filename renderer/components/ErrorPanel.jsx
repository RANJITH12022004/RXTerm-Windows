import { useCallback, useEffect, useRef } from 'react';
import { useTerminalStore } from '../store/terminalStore.js';
import { openErrorPanel, closeErrorPanel } from '../animations/gsap-timelines.js';

function errorKey(w) {
  if (!w) return '';
  return `${w.command}|${w.exit_code}`;
}

function diffSpans(original, suggested) {
  if (!suggested) return null;
  return suggested.split('').map((c, i) => {
    const same = i < original.length && original[i] === c;
    return (
      <span key={`${i}-${c}`} style={same ? undefined : { color: 'var(--accent)' }}>
        {c === ' ' ? '\u00A0' : c}
      </span>
    );
  });
}

export default function ErrorPanel() {
  const panelRef = useRef(null);
  const errorWhisperer = useTerminalStore((s) => s.errorWhisperer);
  const clearErrorWhisperer = useTerminalStore((s) => s.clearErrorWhisperer);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const terminalApis = useTerminalStore((s) => s.terminalApis);

  const pinned = useTerminalStore((s) => s.errorPanelPinned);
  const setErrorPanelPinned = useTerminalStore((s) => s.setErrorPanelPinned);
  const openedForKeyRef = useRef('');

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (!errorWhisperer) {
      closeErrorPanel(el);
      setErrorPanelPinned(false);
      openedForKeyRef.current = '';
      return;
    }
    const k = errorKey(errorWhisperer);
    if (k !== openedForKeyRef.current) {
      openedForKeyRef.current = k;
      openErrorPanel(el);
    }
  }, [errorWhisperer, setErrorPanelPinned]);

  const onDismiss = useCallback(() => {
    const el = panelRef.current;
    clearErrorWhisperer();
    if (el) closeErrorPanel(el);
    setErrorPanelPinned(false);
  }, [clearErrorWhisperer, setErrorPanelPinned]);

  const onApply = useCallback(() => {
    const fix = (errorWhisperer?.suggested_command || '').trim();
    if (!fix) return;
    const api = activeTabId ? terminalApis[activeTabId] : null;
    api?.paste?.(fix);
    onDismiss();
  }, [errorWhisperer, activeTabId, terminalApis, onDismiss]);

  const w = errorWhisperer;
  const { exit_code, stderr, command, explanation, suggested_command } = w ?? {
    exit_code: 0,
    stderr: '',
    command: '',
    explanation: '',
    suggested_command: '',
  };
  const orig = command || '';
  const sug = (suggested_command || '').trim();

  return (
    <div
      ref={panelRef}
      className="error-panel"
      style={{ display: w ? 'flex' : 'none' }}
      role={w ? 'dialog' : undefined}
      aria-label={w ? 'Command error' : undefined}
      aria-hidden={!w}
    >
      {!w ? null : (
        <>
          <div className="error-panel-header">
            <span className="badge badge-error">exit {exit_code}</span>
            <label className="error-panel-pin">
              <input type="checkbox" checked={pinned} onChange={(e) => setErrorPanelPinned(e.target.checked)} />
              Pin
            </label>
          </div>
          <p className="error-panel-summary">{explanation || 'Analyzing failure…'}</p>
          <pre className="error-panel-stderr">{stderr?.slice(0, 600) || '—'}</pre>
          <div className="error-panel-diff">
            <div className="error-panel-diff-row">
              <span className="error-panel-diff-label">Original</span>
              <code className="error-panel-code">{orig || '—'}</code>
            </div>
            <div className="error-panel-diff-row">
              <span className="error-panel-diff-label">Suggested</span>
              <code className="error-panel-code">{sug ? diffSpans(orig, sug) : '…'}</code>
            </div>
          </div>
          <div className="error-panel-actions">
            <button type="button" className="btn btn-primary" onClick={onApply} disabled={!sug}>
              Apply fix
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}
