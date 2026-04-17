import { useTerminalStore } from '../store/terminalStore.js';

/** Subscribe to live metrics + chart ring buffers (updated from WebSocket `metrics` messages). */
export function useMetrics() {
  return useTerminalStore((s) => ({
    latest: s.latestMetrics,
    history: s.metricsHistory,
  }));
}
