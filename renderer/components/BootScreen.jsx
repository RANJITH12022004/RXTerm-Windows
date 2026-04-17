import { useEffect, useRef, useState } from 'react';
import { animateLogoDrawOn } from '../animations/anime-effects.js';
import { dismissBootScreen } from '../animations/gsap-timelines.js';

const HEALTH_URL = 'http://127.0.0.1:8765/health';
const MIN_BOOT_MS = 2000;
const POLL_MS = 400;
const BOOT_LINES = [
  'Starting PowerShell host...',
  'Connecting PowerShell session...',
  'Loading shell profile...',
  'Initializing telemetry channel...',
  'Syncing command history cache...',
];

async function fetchHealth() {
  try {
    const r = await fetch(HEALTH_URL, { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.status === 'ok';
  } catch {
    return false;
  }
}

export default function BootScreen({ onDone }) {
  const overlayRef = useRef(null);
  const svgRef = useRef(null);
  const [status, setStatus] = useState('Starting PowerShell...');
  const doneRef = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    animateLogoDrawOn(svg);
  }, []);

  useEffect(() => {
    const started = Date.now();
    let timer;

    const tick = async () => {
      const phase = Math.min(Math.floor((Date.now() - started) / 550), BOOT_LINES.length - 1);
      setStatus(BOOT_LINES[phase]);
      const ok = await fetchHealth();
      if (ok) setStatus('PowerShell session ready');
      const elapsed = Date.now() - started;
      const minMet = elapsed >= MIN_BOOT_MS;
      if (ok && minMet && !doneRef.current) {
        doneRef.current = true;
        clearInterval(timer);
        dismissBootScreen(overlayRef.current, () => onDone?.());
      }
    };

    timer = setInterval(tick, POLL_MS);
    tick();

    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div ref={overlayRef} className="boot-screen">
      <svg
        ref={svgRef}
        className="boot-logo"
        width="300"
        height="132"
        viewBox="0 0 300 132"
        aria-hidden
      >
        <path
          d="M 18 18 L 18 114 M 18 18 L 78 18 Q 102 18 102 42 L 102 60 Q 102 78 78 78 L 18 78 M 72 78 L 108 114"
          className="boot-logo-r"
          fill="none"
        />
        <path d="M 177 18 L 252 114 M 252 18 L 177 114" className="boot-logo-x" fill="none" />
      </svg>
      <p className="boot-status">{status}</p>
    </div>
  );
}
