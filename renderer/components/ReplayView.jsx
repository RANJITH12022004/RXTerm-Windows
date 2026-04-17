import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '../store/terminalStore.js';

const RECORDINGS_API = 'http://127.0.0.1:8765/api/recordings';

export default function ReplayView() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const recordingsBySessionId = useTerminalStore((s) => s.recordingsBySessionId);
  const setRecordingsForSession = useTerminalStore((s) => s.setRecordingsForSession);
  const replayData = useTerminalStore((s) => s.replayData);
  const replayLoading = useTerminalStore((s) => s.replayLoading);
  const setReplayLoading = useTerminalStore((s) => s.setReplayLoading);
  const setReplayData = useTerminalStore((s) => s.setReplayData);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const sessionId = activeTab?.sessionId;
  const recordings = sessionId ? recordingsBySessionId[sessionId] || [] : [];

  const containerRef = useRef(null);
  const termRef = useRef(null);
  const timerRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return undefined;
    const term = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      theme: {
        background: '#0A0E14',
        foreground: '#E6EDF3',
        cursor: '#00FF9C',
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
    });
    term.open(containerRef.current);
    termRef.current = term;
    return () => {
      clearTimeout(timerRef.current);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  const renderToIndex = useCallback(
    (targetIndex) => {
      const term = termRef.current;
      if (!term) return;
      term.reset();
      const chunks = replayData?.chunks || [];
      chunks.slice(0, targetIndex).forEach((chunk) => term.write(chunk.data));
    },
    [replayData],
  );

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${RECORDINGS_API}?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => setRecordingsForSession(sessionId, data.items || []))
      .catch(() => setRecordingsForSession(sessionId, []));
  }, [sessionId, setRecordingsForSession]);

  const loadRecording = useCallback(
    async (name) => {
      setReplayLoading(true);
      setIsPlaying(false);
      clearTimeout(timerRef.current);
      const res = await fetch(`${RECORDINGS_API}/view/${encodeURIComponent(name)}`);
      const data = await res.json();
      setReplayData(data);
      setPlayhead(0);
    },
    [setReplayData, setReplayLoading],
  );

  useEffect(() => {
    renderToIndex(playhead);
  }, [playhead, renderToIndex]);

  const duration = useMemo(() => {
    const chunks = replayData?.chunks || [];
    if (chunks.length < 2) return 0;
    return chunks[chunks.length - 1].timestamp_ms - chunks[0].timestamp_ms;
  }, [replayData]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!isPlaying || !replayData?.chunks?.length) return undefined;
    const chunks = replayData.chunks;
    if (playhead >= chunks.length - 1) {
      setIsPlaying(false);
      return undefined;
    }
    const current = chunks[playhead];
    const next = chunks[playhead + 1];
    const delta = Math.max(1, next.timestamp_ms - current.timestamp_ms);
    timerRef.current = window.setTimeout(() => {
      setPlayhead((value) => Math.min(value + 1, chunks.length));
    }, delta / speed);
    return () => clearTimeout(timerRef.current);
  }, [isPlaying, playhead, replayData, speed]);

  return (
    <section className="replay-view" aria-label="Session replay">
      <div className="view-header">
        <div>
          <div className="view-eyebrow">Recorded sessions</div>
          <h2 className="view-title">Replay</h2>
        </div>
        <div className="view-subtitle">{activeTab?.title || 'No active tab'}</div>
      </div>

      <div className="replay-layout">
        <aside className="replay-list panel">
          {recordings.map((recording) => (
            <button
              key={recording.name}
              type="button"
              className="replay-recording-row"
              onClick={() => loadRecording(recording.name)}
            >
              <span>{recording.name}</span>
              <span>{Math.round((recording.size || 0) / 1024)} KB</span>
            </button>
          ))}
          {recordings.length === 0 ? <div className="history-timeline-empty">No recordings for this tab yet.</div> : null}
        </aside>

        <div className="replay-player panel">
          <div ref={containerRef} className="replay-terminal" />
          <div className="replay-controls">
            <button type="button" className="toolbar-pill" onClick={() => setIsPlaying((v) => !v)} disabled={!replayData}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="toolbar-pill"
              onClick={() => {
                setIsPlaying(false);
                setPlayhead(0);
              }}
              disabled={!replayData}
            >
              Reset
            </button>
            <div className="replay-speeds">
              {[0.5, 1, 2, 5, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`toolbar-pill ${speed === value ? 'active' : ''}`}
                  onClick={() => setSpeed(value)}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            className="replay-scrubber"
            min="0"
            max={Math.max((replayData?.chunks || []).length, 1)}
            value={playhead}
            onChange={(e) => {
              setIsPlaying(false);
              setPlayhead(Number(e.target.value));
            }}
          />
          <div className="view-subtitle">
            {replayLoading ? 'Loading recording...' : `Duration: ${duration} ms · Chunks: ${(replayData?.chunks || []).length}`}
          </div>
        </div>
      </div>
    </section>
  );
}
