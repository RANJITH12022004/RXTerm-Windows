import { useEffect, useRef, useState } from 'react';

const PASSTHROUGH_TYPES = new Set([
  'resize',
  'ping',
  'nl_query',
  'completion_query',
  'run_command',
  'recording_toggle',
  'recording_status_request',
]);

function parsePassthroughJson(str) {
  const t = str.trimStart();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(str);
    if (o && typeof o === 'object' && typeof o.type === 'string' && PASSTHROUGH_TYPES.has(o.type)) {
      return str;
    }
  } catch {
    /* not protocol JSON */
  }
  return null;
}

/**
 * WebSocket-like shim for @xterm/addon-attach: raw I/O is wrapped in Part 3 JSON.
 */
export class TerminalSocket extends EventTarget {
  constructor(ws, getHandlers) {
    super();
    this._ws = ws;
    this._getHandlers = getHandlers;

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'output' && typeof msg.data === 'string') {
        this.dispatchEvent(new MessageEvent('message', { data: msg.data }));
        return;
      }
      const fn = this._getHandlers()?.[msg.type];
      if (typeof fn === 'function') fn(msg);
    });

    ws.addEventListener('close', () => {
      this.dispatchEvent(new CloseEvent('close'));
    });
    ws.addEventListener('error', () => {
      this.dispatchEvent(new Event('error'));
    });
  }

  get readyState() {
    return this._ws.readyState;
  }

  get binaryType() {
    return this._ws.binaryType;
  }

  set binaryType(v) {
    this._ws.binaryType = v;
  }

  send(data) {
    if (typeof data === 'string') {
      const passthrough = parsePassthroughJson(data);
      if (passthrough !== null) {
        this._ws.send(passthrough);
        return;
      }
      this._ws.send(JSON.stringify({ type: 'input', data }));
      return;
    }
    let buf;
    if (data instanceof ArrayBuffer) buf = new Uint8Array(data);
    else if (data instanceof Uint8Array) buf = data;
    else buf = new Uint8Array(data);
    const s = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    this._ws.send(JSON.stringify({ type: 'input', data: s }));
  }
}

export function useTerminalWebSocket(sessionId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const url = `ws://127.0.0.1:8765/ws/${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(url);
    const shim = new TerminalSocket(ws, () => handlersRef.current);

    const onOpen = () => setSocket(shim);
    ws.addEventListener('open', onOpen);

    return () => {
      ws.removeEventListener('open', onOpen);
      ws.close();
      setSocket(null);
    };
  }, [sessionId]);

  return { socket, connected: socket != null && socket.readyState === WebSocket.OPEN };
}
