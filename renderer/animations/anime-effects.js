// renderer/animations/anime-effects.js
import anime from 'animejs';

// Boot logo draw-on (SVG stroke)
export function animateLogoDrawOn(svgEl) {
  return anime({
    targets: svgEl.querySelectorAll('path'),
    strokeDashoffset: [anime.setDashoffset, 0],
    easing: 'easeInOutQuart',
    duration: 1200,
    delay: anime.stagger(100),
  });
}

// NL command typewriter reveal
export function typewriterReveal(containerEl, commandText) {
  containerEl.innerHTML = '';
  const chars = commandText.split('').map((c) => {
    const span = document.createElement('span');
    span.textContent = c === ' ' ? '\u00A0' : c;
    span.style.opacity = 0;
    containerEl.appendChild(span);
    return span;
  });
  return anime({
    targets: chars,
    opacity: [0, 1],
    translateY: [6, 0],
    easing: 'easeOutQuad',
    duration: 120,
    delay: anime.stagger(18),
  });
}

// AI thinking dots
export function thinkingDots(dotsEl) {
  return anime({
    targets: dotsEl.querySelectorAll('.thinking-dot'),
    translateY: [-5, 0],
    easing: 'easeInOutSine',
    duration: 400,
    delay: anime.stagger(120),
    loop: true,
    direction: 'alternate',
  });
}

// CPU gauge arc
export function updateCPUGauge(arcEl, value) {
  const c = 2 * Math.PI * 40;
  return anime({
    targets: arcEl,
    strokeDashoffset: c - (value / 100) * c,
    duration: 800,
    easing: 'easeOutQuart',
  });
}

// Error pulse on gauge
export function pulseErrorGauge(gaugeEl) {
  return anime({
    targets: gaugeEl,
    strokeWidth: [2, 5, 2],
    easing: 'easeInOutSine',
    duration: 600,
    loop: 3,
  });
}

// Matrix scanline
export function startScanline(lineEl) {
  return anime({
    targets: lineEl,
    translateY: [0, '100vh'],
    loop: true,
    duration: 3000,
    easing: 'linear',
  });
}

// Tab status dot color
export function morphTabDot(dotEl, color) {
  return anime({
    targets: dotEl,
    backgroundColor: color,
    duration: 300,
    easing: 'easeOutQuad',
  });
}

// REC badge pulse
export function pulseRecBadge(badgeEl) {
  return anime({
    targets: badgeEl,
    opacity: [1, 0.3],
    loop: true,
    direction: 'alternate',
    duration: 800,
    easing: 'easeInOutSine',
  });
}

// Dropzone dashed border draw-on
export function animateDropzone(svgPaths) {
  return anime({
    targets: svgPaths,
    strokeDashoffset: [anime.setDashoffset, 0],
    duration: 300,
    easing: 'easeOutQuad',
  });
}

// Snippet insert flash
export function flashTerminalBorder(termEl) {
  return anime({
    targets: termEl,
    borderColor: ['var(--accent)', 'transparent'],
    duration: 400,
    easing: 'easeOutQuad',
  });
}

// Split pane divider appear
export function animateDivider(divEl) {
  return anime({
    targets: divEl,
    width: [0, 4],
    duration: 200,
    easing: 'easeOutQuad',
  });
}
