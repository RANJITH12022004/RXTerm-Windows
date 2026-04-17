import { useCallback, useEffect, useMemo, useRef } from 'react';
import anime from 'animejs';
import { ArrowClockwise } from '@phosphor-icons/react';
import { useTerminalStore } from '../store/terminalStore.js';
import { animateTimelineEntry, showTooltip, hideTooltip } from '../animations/gsap-timelines.js';

const API = 'http://127.0.0.1:8765/api/explain_command';
const HISTORY_API = 'http://127.0.0.1:8765/api/history';

export default function HistoryTimeline() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const aiSocket = useTerminalStore((s) => s.aiSocket);
  const historyBySessionId = useTerminalStore((s) => s.historyBySessionId);
  const historyLoadingBySessionId = useTerminalStore((s) => s.historyLoadingBySessionId);
  const setHistoryEntries = useTerminalStore((s) => s.setHistoryEntries);
  const setHistoryLoading = useTerminalStore((s) => s.setHistoryLoading);
  const tooltipRefs = useRef({});
  const hoverTimers = useRef({});
  const explainCache = useRef(new Map());
  const rowRefs = useRef({});
  const seenEntryIds = useRef(new Set());

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const sessionId = activeTab?.sessionId;
  const entries = sessionId ? historyBySessionId[sessionId] || [] : [];
  const loading = sessionId ? historyLoadingBySessionId[sessionId] : false;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setHistoryLoading(sessionId, true);
    fetch(`${HISTORY_API}/${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setHistoryEntries(sessionId, data.items || []);
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryLoading(sessionId, false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, setHistoryEntries, setHistoryLoading]);

  useEffect(() => {
    entries.forEach((entry) => {
      if (seenEntryIds.current.has(entry.id)) return;
      seenEntryIds.current.add(entry.id);
      const el = rowRefs.current[entry.id];
      if (el) animateTimelineEntry(el);
    });
  }, [entries]);

  const runExplain = useCallback(async (id, command) => {
    const tipEl = tooltipRefs.current[id];
    if (!tipEl) return;
    let text = explainCache.current.get(command);
    if (!text) {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        text = [data.breakdown, data.common_mistakes].filter(Boolean).join('\n\n').slice(0, 800);
        if (!text) text = 'No breakdown returned.';
        explainCache.current.set(command, text);
      } catch {
        text = 'Could not load explanation.';
        explainCache.current.set(command, text);
      }
    }
    tipEl.textContent = text;
    showTooltip(tipEl);
  }, []);

  const onEnterRow = useCallback(
    (id, command) => {
      clearTimeout(hoverTimers.current[id]);
      hoverTimers.current[id] = window.setTimeout(() => {
        runExplain(id, command);
      }, 300);
    },
    [runExplain],
  );

  const onLeaveRow = useCallback((id) => {
    clearTimeout(hoverTimers.current[id]);
    delete hoverTimers.current[id];
    const tipEl = tooltipRefs.current[id];
    if (tipEl) hideTooltip(tipEl);
  }, []);

  const rerun = useCallback(
    (entry) => {
      if (!aiSocket || !entry?.command) return;
      aiSocket.send(JSON.stringify({ type: 'run_command', command: entry.command, nl_source: entry.nl_source || '' }));
    },
    [aiSocket],
  );

  const expandRow = useCallback((id, expanded) => {
    const el = rowRefs.current[id];
    if (!el) return;
    anime.remove(el);
    anime({
      targets: el,
      height: expanded ? el.scrollHeight : 92,
      duration: 180,
      easing: 'easeOutQuad',
    });
  }, []);

  const formattedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        time: new Date(entry.timestamp).toLocaleTimeString(),
        duration: entry.duration_ms != null ? `${entry.duration_ms} ms` : 'running',
        exitLabel:
          entry.exit_code == null ? 'RUN' : entry.exit_code === 0 ? 'OK' : `ERR ${entry.exit_code}`,
        exitClass:
          entry.exit_code == null ? 'amber' : entry.exit_code === 0 ? 'success' : 'error',
      })),
    [entries],
  );

  return (
    <section className="history-view" aria-label="Command history">
      <div className="view-header">
        <div>
          <div className="view-eyebrow">Session history</div>
          <h2 className="view-title">Command Timeline</h2>
        </div>
        <div className="view-subtitle">{activeTab?.title || 'No active tab'}</div>
      </div>
      <ul className="history-view-list">
        {loading && <li className="history-timeline-empty">Loading command history...</li>}
        {!loading && formattedEntries.length === 0 && (
          <li className="history-timeline-empty">Run commands in this tab to build the timeline.</li>
        )}
        {formattedEntries.map((e) => (
          <li
            key={e.id}
            ref={(el) => {
              if (el) rowRefs.current[e.id] = el;
            }}
            className="history-entry-card"
            onMouseEnter={() => {
              onEnterRow(e.id, e.command);
              expandRow(e.id, true);
            }}
            onMouseLeave={() => {
              onLeaveRow(e.id);
              expandRow(e.id, false);
            }}
          >
            <div className="history-entry-topline">
              <span className="history-entry-time">{e.time}</span>
              <span className={`history-entry-badge ${e.exitClass}`}>{e.exitLabel}</span>
              <span className="history-entry-badge duration">{e.duration}</span>
              <button type="button" className="history-entry-rerun" onClick={() => rerun(e)}>
                <ArrowClockwise size={14} />
                Rerun
              </button>
            </div>
            <div className="history-entry-command">{e.command}</div>
            {e.nl_source ? <div className="history-entry-nl">NL source: {e.nl_source}</div> : null}
            {e.output_preview ? <pre className="history-entry-output">{e.output_preview}</pre> : null}
            <div
              ref={(el) => {
                if (el) tooltipRefs.current[e.id] = el;
              }}
              className="history-tooltip"
            >
              {'\u00A0'}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
