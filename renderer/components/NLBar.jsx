import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useTerminalStore } from '../store/terminalStore.js';
import { openNLBar, closeNLBar } from '../animations/gsap-timelines.js';
import { typewriterReveal, thinkingDots } from '../animations/anime-effects.js';

const THINKING_MSGS = ['Analyzing request...', 'Understanding input...', 'Processing command...'];

function clearPreview(transcriptEl, commandEl) {
  if (transcriptEl) transcriptEl.textContent = '';
  if (commandEl) commandEl.textContent = '';
}

function fallbackTranscript(msg) {
  const intent = typeof msg.intent === 'string' && msg.intent.trim() ? msg.intent.trim() : 'Unknown';
  const status =
    typeof msg.intent_status === 'string' && msg.intent_status.trim()
      ? msg.intent_status.trim()
      : 'Processing request...';
  return `Detected intent: ${intent}\nExecuting command...\n${status}`;
}

export default function NLBar() {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);
  const commandRef = useRef(null);
  const dotsRef = useRef(null);
  const thinkingAnimRef = useRef(null);
  const prevCloseNonceRef = useRef(0);
  const openNonce = useTerminalStore((s) => s.nlBarOpenNonce);
  const closeNonce = useTerminalStore((s) => s.nlBarCloseNonce);
  const setNlBarIsOpen = useTerminalStore((s) => s.setNlBarIsOpen);
  const aiSocket = useTerminalStore((s) => s.aiSocket);
  const pendingNlResult = useTerminalStore((s) => s.pendingNlResult);
  const clearPendingNlResult = useTerminalStore((s) => s.clearPendingNlResult);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState('');
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.set(el, { y: '100%', opacity: 0 });
    el.style.pointerEvents = 'none';
  }, []);

  const doClose = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    thinkingAnimRef.current?.pause?.();
    thinkingAnimRef.current = null;
    setNlBarIsOpen(false);
    setOpen(false);
    setLoading(false);
    setQuery('');
    setPendingCommand('');
    clearPreview(transcriptRef.current, commandRef.current);
    inputRef.current?.blur();
    closeNLBar(el);
  }, [setNlBarIsOpen]);

  useEffect(() => {
    if (openNonce === 0) return;
    const el = rootRef.current;
    if (!el) return;
    setOpen(true);
    openNLBar(el);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [openNonce]);

  useEffect(() => {
    if (closeNonce > 0 && closeNonce > prevCloseNonceRef.current) {
      prevCloseNonceRef.current = closeNonce;
      doClose();
    }
  }, [closeNonce, doClose]);

  useEffect(() => {
    if (!pendingNlResult) return;
    const msg = pendingNlResult;
    clearPendingNlResult();
    setLoading(false);
    thinkingAnimRef.current?.pause?.();
    thinkingAnimRef.current = null;
    const cmd = typeof msg.command === 'string' ? msg.command : '';
    const expl = typeof msg.explanation === 'string' ? msg.explanation : '';
    setPendingCommand(cmd);

    const tEl = transcriptRef.current;
    const cEl = commandRef.current;
    if (!tEl || !cEl) return;

    const transcript =
      typeof msg.ai_transcript === 'string' && msg.ai_transcript.trim()
        ? msg.ai_transcript.trim()
        : fallbackTranscript(msg);

    if (cmd.trim()) {
      tEl.textContent = transcript;
      cEl.textContent = '';
      typewriterReveal(cEl, cmd);
    } else if (expl) {
      tEl.textContent = `${transcript}\n\n${expl}`;
      cEl.textContent = '';
    } else {
      tEl.textContent = transcript;
      cEl.textContent = '';
    }
  }, [pendingNlResult, clearPendingNlResult]);

  useEffect(() => {
    if (!loading) return undefined;
    setThinkingIdx(0);
    const id = setInterval(() => {
      setThinkingIdx((i) => (i + 1) % THINKING_MSGS.length);
    }, 550);
    return () => clearInterval(id);
  }, [loading]);

  const submitNl = useCallback(() => {
    const text = query.trim();
    if (!text || !aiSocket || loading) return;
    setLoading(true);
    setPendingCommand('');
    clearPreview(transcriptRef.current, commandRef.current);
    aiSocket.send(JSON.stringify({ type: 'nl_query', text }));
    thinkingAnimRef.current?.pause?.();
    thinkingAnimRef.current = null;
    if (dotsRef.current) {
      thinkingAnimRef.current = thinkingDots(dotsRef.current);
    }
  }, [query, aiSocket, loading]);

  const injectCommand = useCallback(() => {
    const cmd = pendingCommand.trim();
    const source = query.trim();
    if (!cmd || !aiSocket) return;
    aiSocket.send(JSON.stringify({ type: 'run_command', command: cmd, nl_source: source }));
    doClose();
  }, [pendingCommand, query, aiSocket, doClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        doClose();
        return;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (loading) {
          e.preventDefault();
          return;
        }
        if (pendingCommand.trim()) {
          e.preventDefault();
          injectCommand();
          return;
        }
        e.preventDefault();
        submitNl();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, loading, pendingCommand, submitNl, injectCommand, doClose]);

  return (
    <div ref={rootRef} className={`nl-bar ${open ? 'active' : ''}`} role="dialog" aria-label="Natural language command">
      <div className="nl-bar-inner">
        <div className="nl-bar-row">
          <span className="nl-prefix" aria-hidden>
            NL&gt;
          </span>
          <input
            ref={inputRef}
            className="nl-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you want to run…"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="nl-thinking" style={{ display: loading ? 'flex' : 'none' }} aria-hidden>
          <span className="nl-thinking-label">{THINKING_MSGS[thinkingIdx]}</span>
          <div ref={dotsRef} className="nl-thinking-dots">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </div>
        </div>
        <div className="nl-preview-box" aria-live="polite">
          <div ref={transcriptRef} className="nl-preview-transcript" />
          <div ref={commandRef} className="nl-preview-command" />
        </div>
      </div>
    </div>
  );
}
