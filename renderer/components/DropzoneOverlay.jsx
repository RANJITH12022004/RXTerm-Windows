// renderer/components/DropzoneOverlay.jsx
import { useEffect, useRef } from 'react';
import anime from 'animejs';
import { useTerminalStore } from '../store/terminalStore.js';

export default function DropzoneOverlay() {
  const isActive = useTerminalStore((s) => s.dropzoneActive);
  const overlayRef = useRef(null);
  const borderRef = useRef(null);

  useEffect(() => {
    if (!overlayRef.current) return;

    if (isActive) {
      // Make visible FIRST, then animate
      overlayRef.current.style.display = 'flex';
      // Anime.js: dashed border draws on (SVG stroke trick)
      anime({
        targets: '.dropzone-border path',
        strokeDashoffset: [anime.setDashoffset, 0],
        duration: 300,
        easing: 'easeOutQuad',
      });
      // Fade in text
      anime({
        targets: '.dropzone-text',
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 250,
        easing: 'easeOutQuad',
      });
    } else {
      anime({
        targets: overlayRef.current,
        opacity: [1, 0],
        duration: 200,
        easing: 'easeInQuad',
        complete: () => {
          if (overlayRef.current) overlayRef.current.style.display = 'none';
        },
      });
    }
  }, [isActive]);

  return (
    <div
      ref={overlayRef}
      style={{
        display: 'none', // starts hidden
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none', // CRITICAL: never block terminal input
        background: 'rgba(10, 14, 20, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* SVG animated dashed border */}
      <svg
        ref={borderRef}
        className="dropzone-border"
        style={{ position: 'absolute', inset: '16px', width: 'calc(100% - 32px)', height: 'calc(100% - 32px)' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 2,2 L 98,2 L 98,98 L 2,98 Z"
          stroke="var(--accent)"
          strokeWidth="0.5"
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Icon + text */}
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 16V8M12 8L9 11M12 8L15 11"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 15V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V15"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="dropzone-text"
        style={{
          color: 'var(--accent)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          opacity: 0,
        }}
      >
        DROP FILES — PATH WILL BE INJECTED
      </span>
    </div>
  );
}
