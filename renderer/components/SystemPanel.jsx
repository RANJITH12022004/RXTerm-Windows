import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Pulse, CaretDoubleRight } from '@phosphor-icons/react';
import { useTerminalStore } from '../store/terminalStore.js';
import { openSidebar, closeSidebar } from '../animations/gsap-timelines.js';
import { pulseErrorGauge } from '../animations/anime-effects.js';
import { animateCounter } from '../animations/gsap-timelines.js';
import { useMetrics } from '../hooks/useMetrics.js';

function formatUptime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function SystemPanel() {
  const rootRef = useRef(null);
  const cpuArcRef = useRef(null);
  const ramArcRef = useRef(null);
  const speedArcRef = useRef(null);
  const cpuLabelRef = useRef(null);
  const ramLabelRef = useRef(null);
  const diskLabelRef = useRef(null);
  const speedLabelRef = useRef(null);
  const speedUnitRef = useRef(null);
  const speedDownRef = useRef(null);
  const speedUpRef = useRef(null);
  const uptimeRef = useRef(null);
  const prevCpuHigh = useRef(false);
  const prevNet = useRef({ up: null, dn: null, t: null });
  const lastUptimeRef = useRef(0);
  const cpuPathRef = useRef(null);
  const ramPathRef = useRef(null);
  const speedPathRef = useRef(null);
  const [displayUptime, setDisplayUptime] = useState(0);

  const open = useTerminalStore((s) => s.systemPanelOpen);
  const toggleSystemPanel = useTerminalStore((s) => s.toggleSystemPanel);
  const { latest, history } = useMetrics();
  const circ = 2 * Math.PI * 40;
  const dialSweep = circ * 0.75; // 270deg sweep: ~7:30 -> ~4:30

  const buildLinePath = (values, width, height, maxValue) => {
    if (!values.length) return '';
    return values
      .map((value, index) => {
        const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
        const y = height - (Math.max(0, value) / Math.max(1, maxValue)) * height;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  };

  const setDial = (ref, pct) => {
    if (!ref.current) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const visible = dialSweep * (clamped / 100);
    gsap.to(ref.current, {
      strokeDasharray: `${visible} ${circ}`,
      strokeDashoffset: 0,
      duration: 0.95,
      ease: 'sine.inOut',
      overwrite: 'auto',
    });
  };

  // Car-style sweep: starts near 7:30 and advances toward the right
  const setSpeedDial = (pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    const visible = 1000 * (clamped / 100);
    if (!speedArcRef.current) return;
    gsap.to(speedArcRef.current, {
      strokeDasharray: `${visible} 1000`,
      strokeDashoffset: 0,
      duration: 0.95,
      ease: 'sine.inOut',
      overwrite: 'auto',
    });
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.set(el, { width: 0, overflow: 'hidden' });
    if (open) openSidebar(el);
    else {
      el.style.pointerEvents = 'none';
      gsap.set(el, { width: 0 });
    }
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (open) openSidebar(el);
    else closeSidebar(el);
  }, [open]);

  useEffect(() => {
    if (!latest) return;
    const cpu = Math.max(0, Math.min(100, Number(latest.cpu) || 0));
    const ram = Math.max(0, Math.min(100, Number(latest.ram) || 0));

    setDial(cpuArcRef, cpu);
    setDial(ramArcRef, ram);

    if (cpuLabelRef.current) animateCounter(cpuLabelRef.current, Math.round(cpu), 0.95, 'sine.inOut');
    if (ramLabelRef.current) animateCounter(ramLabelRef.current, Math.round(ram), 0.95, 'sine.inOut');
    if (diskLabelRef.current) {
      animateCounter(diskLabelRef.current, Math.round(Number(latest.disk) || 0), 0.95, 'sine.inOut');
    }
    lastUptimeRef.current = Number(latest.uptime) || 0;
    setDisplayUptime(lastUptimeRef.current);
    const now = Date.now();
    const up = Number(latest.net_up) || 0;
    const dn = Number(latest.net_dn) || 0;
    const p = prevNet.current;
    let upKbps = 0;
    let dnKbps = 0;
    if (p.up != null && p.t != null) {
      const dt = Math.max(0.001, (now - p.t) / 1000);
      upKbps = ((up - p.up) / dt / 1024) * 8;
      dnKbps = ((dn - p.dn) / dt / 1024) * 8;
    }
    prevNet.current = { up, dn, t: now };
    const speed = Math.max(upKbps, dnKbps);
    const speedPct = Math.max(0, Math.min(100, speed / 50));
    setSpeedDial(speedPct);
    if (speedLabelRef.current) animateCounter(speedLabelRef.current, Math.round(speed), 0.95, 'sine.inOut');
    if (speedUnitRef.current) speedUnitRef.current.textContent = 'Kb/s';
    if (speedDownRef.current) speedDownRef.current.textContent = `DN ${dnKbps.toFixed(1)}`;
    if (speedUpRef.current) speedUpRef.current.textContent = `UP ${upKbps.toFixed(1)}`;

    const high = cpu > 90;
    if (high && !prevCpuHigh.current && cpuArcRef.current) {
      pulseErrorGauge(cpuArcRef.current);
    }
    prevCpuHigh.current = high;
  }, [latest]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplayUptime((value) => Math.max(value, lastUptimeRef.current) + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const procs = latest?.procs ?? [];
  const speedSeries = (history?.netUp || []).map((up, index) => Math.max(up || 0, history?.netDn?.[index] || 0));
  const speedChartSeries = speedSeries.map((value) => Math.max(0, Math.min(100, value / 6400)));
  const cpuPath = buildLinePath(history?.cpu || [], 252, 52, 100);
  const ramPath = buildLinePath(history?.ram || [], 252, 52, 100);
  const speedPath = buildLinePath(speedChartSeries, 252, 52, 100);

  useEffect(() => {
    const paths = [
      [cpuPathRef.current, cpuPath || 'M 0 52 L 252 52'],
      [ramPathRef.current, ramPath || 'M 0 52 L 252 52'],
      [speedPathRef.current, speedPath || 'M 0 52 L 252 52'],
    ];
    paths.forEach(([el, d]) => {
      if (!el) return;
      gsap.to(el, {
        attr: { d },
        duration: 0.95,
        ease: 'sine.inOut',
        overwrite: 'auto',
      });
    });
  }, [cpuPath, ramPath, speedPath]);

  return (
    <aside
      ref={rootRef}
      className="sidebar sidebar-right system-panel"
      data-expanded-width="320"
      aria-label="System metrics"
    >
      <div className="system-panel-header">
        <button
          type="button"
          className="file-explorer-icon-btn"
          title="Collapse"
          onClick={() => toggleSystemPanel()}
        >
          <CaretDoubleRight size={18} />
        </button>
        <span className="system-panel-title">System</span>
        <Pulse size={18} className="system-panel-header-icon" aria-hidden />
      </div>

      <div className="system-panel-gauge-wrap">
        <div className="dash-cluster">
          <div className="dash-dial dial-cpu">
            <svg className="dash-ring" viewBox="0 0 100 100" width={142} height={142}>
              <circle className="ring-base" cx="50" cy="50" r="40" />
              <circle className="ring-track" cx="50" cy="50" r="40" />
              <circle
                ref={cpuArcRef}
                className="ring-value"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray={`0 ${circ}`}
                strokeDashoffset={0}
              />
            </svg>
            <div className="dash-center">
              <div className="dash-value"><span ref={cpuLabelRef}>0</span><span className="unit">%</span></div>
            </div>
            <div className="dash-caption dial-label">CPU</div>
            <div className="dash-range"><span>0</span><span>100</span></div>
          </div>

          <div className="dash-dial dial-ram">
            <svg className="dash-ring" viewBox="0 0 100 100" width={142} height={142}>
              <circle className="ring-base" cx="50" cy="50" r="40" />
              <circle className="ring-track" cx="50" cy="50" r="40" />
              <circle
                ref={ramArcRef}
                className="ring-value"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray={`0 ${circ}`}
                strokeDashoffset={0}
              />
            </svg>
            <div className="dash-center">
              <div className="dash-value"><span ref={ramLabelRef}>0</span><span className="unit">%</span></div>
            </div>
            <div className="dash-caption dial-label">RAM</div>
            <div className="dash-range"><span>0</span><span>100</span></div>
          </div>
        </div>

        <div className="dash-speed-oval">
          <div className="speed-oval-glass">
            {/* Blue progress is painted directly on the capsule border path */}
            <svg
              className="speed-oval-border-svg"
              viewBox="0 0 220 126"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                ref={speedArcRef}
                className="speed-oval-fill"
                d="M 19.2 106.8 A 62 62 0 0 1 63 1 L 157 1 A 62 62 0 0 1 200.8 106.8"
                pathLength="1000"
                strokeDasharray="0 1000"
                strokeDashoffset="0"
              />
            </svg>
            <div className="dash-speed-center">
              <div className="dash-speed-value">
                <span ref={speedLabelRef}>0</span>
                <span ref={speedUnitRef}>Kb/s</span>
              </div>
              <div className="speed-oval-caption">SPEED</div>
              <div className="dash-speed-subline">
                <span ref={speedDownRef}>DN 0.0</span>
                <span ref={speedUpRef}>UP 0.0</span>
              </div>
            </div>
          </div>
        </div>

        <div className="system-panel-netgraph">
          <svg className="system-panel-netgraph-svg" viewBox="0 0 252 52" preserveAspectRatio="none" aria-hidden>
            <path ref={cpuPathRef} className="system-panel-netgraph-line cpu" d={cpuPath || 'M 0 52 L 252 52'} />
            <path ref={ramPathRef} className="system-panel-netgraph-line ram" d={ramPath || 'M 0 52 L 252 52'} />
            <path ref={speedPathRef} className="system-panel-netgraph-line speed" d={speedPath || 'M 0 52 L 252 52'} />
          </svg>
        </div>

        <div className="system-panel-sub">DISK <span ref={diskLabelRef} className="metric-inline">0</span>%</div>
        <div className="system-panel-uptime">Uptime <span ref={uptimeRef}>{formatUptime(displayUptime)}</span></div>
      </div>

      <div className="system-panel-procs">
        <div className="sidebar-section-title">Top CPU</div>
        <table className="system-panel-table">
          <thead>
            <tr>
              <th>Process</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {procs.map((p, idx) => (
              <tr key={`${p.name}-${idx}`}>
                <td title={p.name}>{(p.name || '?').slice(0, 22)}</td>
                <td>{(Number(p.cpu) || 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
