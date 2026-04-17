// renderer/animations/gsap-timelines.js
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

// Boot
export function animateBootPanels() {
  return gsap.from('.panel', { opacity: 0, y: 20, stagger: 0.08, duration: 0.4, ease: 'power2.out' });
}

export function dismissBootScreen(el, onComplete) {
  if (!el) {
    onComplete?.();
    return null;
  }
  return gsap.to(el, {
    opacity: 0,
    duration: 0.45,
    ease: 'power2.inOut',
    onComplete,
  });
}

// Tabs
export function animateTabOpen(tabEl) {
  return gsap.from(tabEl, { x: 40, opacity: 0, duration: 0.25, ease: 'power2.out' });
}
export function animateTabClose(tabEl, onComplete) {
  return gsap.to(tabEl, { width: 0, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete });
}
export function animateTabReorder(tabBarEl, mutationFn) {
  const state = Flip.getState(tabBarEl.querySelectorAll('.tab-item'));
  mutationFn();
  return Flip.from(state, { duration: 0.3, ease: 'power1.inOut', stagger: 0.03, absolute: true });
}

// NL Bar
export function openNLBar(el) {
  el.style.pointerEvents = 'all';
  return gsap.to(el, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
}
export function closeNLBar(el) {
  return gsap.to(el, {
    y: '100%',
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      el.style.pointerEvents = 'none';
    },
  });
}

// Error Panel
export function openErrorPanel(el) {
  el.style.display = 'flex';
  return gsap.from(el, { x: '100%', duration: 0.35, ease: 'power2.out' });
}
export function closeErrorPanel(el) {
  return gsap.to(el, {
    x: '100%',
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      el.style.display = 'none';
    },
  });
}

// Sidebars
export function openSidebar(el) {
  const targetWidth = Number(el?.dataset?.expandedWidth) || 260;
  el.style.pointerEvents = 'all';
  return gsap.to(el, { width: targetWidth, duration: 0.3, ease: 'power2.out' });
}
export function closeSidebar(el) {
  return gsap.to(el, {
    width: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      el.style.pointerEvents = 'none';
    },
  });
}

// Timeline entries
export function animateTimelineEntry(el) {
  return gsap.from(el, { y: -20, opacity: 0, duration: 0.2, ease: 'power2.out' });
}

// Autocomplete
export function showAutocomplete(el) {
  return gsap.from(el, {
    scaleY: 0.95,
    opacity: 0,
    duration: 0.15,
    ease: 'power2.out',
    transformOrigin: 'bottom',
  });
}
export function hideAutocomplete(el) {
  return gsap.to(el, { scaleY: 0.95, opacity: 0, duration: 0.1, ease: 'power2.in' });
}

// Tooltips
export function showTooltip(el) {
  return gsap.to(el, { opacity: 1, delay: 0.3, duration: 0.2 });
}
export function hideTooltip(el) {
  return gsap.to(el, { opacity: 0, duration: 0.15 });
}

// Metric counters
export function animateCounter(el, newVal, duration = 0.6, ease = 'power2.out') {
  const start = parseFloat(el.textContent) || 0;
  const obj = { val: start };
  return gsap.to(obj, {
    val: newVal,
    duration,
    ease,
    onUpdate() {
      el.textContent = String(Math.round(obj.val));
    },
  });
}

// Panes
export function animatePaneCreate(el) {
  return gsap.from(el, { opacity: 0, scale: 0.97, duration: 0.3, ease: 'power2.out' });
}

// Settings overlay
export function openSettings(el) {
  el.style.display = 'flex';
  return gsap.from(el, { opacity: 0, duration: 0.25, ease: 'power2.out' });
}
export function closeSettings(el) {
  return gsap.to(el, {
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      el.style.display = 'none';
    },
  });
}
