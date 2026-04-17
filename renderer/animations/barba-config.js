// renderer/animations/barba-config.js
import barba from '@barba/core';
import { gsap } from 'gsap';

function ensureRxtermHooks() {
  window.rxterm = window.rxterm || {
    initTerminalView() {},
    initDashboardView() {},
    initHistoryView() {},
    initSnippetsView() {},
    initSettingsView() {},
  };
}

let barbaInitialized = false;

const transitionMap = {
  'terminal:history': {
    leave: (el) => gsap.to(el, { opacity: 0, x: -24, duration: 0.2, ease: 'power2.in' }),
    enter: (el) => gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }),
  },
  'terminal:snippets': {
    leave: (el) => gsap.to(el, { opacity: 0, x: 24, duration: 0.2, ease: 'power2.in' }),
    enter: (el) => gsap.fromTo(el, { opacity: 0, x: -32 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }),
  },
  'terminal:replay': {
    leave: (el) => gsap.to(el, { opacity: 0, scale: 0.98, duration: 0.2, ease: 'power2.in' }),
    enter: (el) => gsap.fromTo(el, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }),
  },
};

export function initBarba() {
  if (barbaInitialized) return;
  ensureRxtermHooks();

  try {
    barba.init({
    transitions: [
      {
        name: 'terminal-to-dashboard',
        from: { namespace: 'terminal' },
        to: { namespace: 'dashboard' },
        leave: (data) =>
          gsap.to(data.current.container, { x: '-100%', opacity: 0, duration: 0.35, ease: 'power2.in' }),
        enter: (data) =>
          gsap.from(data.next.container, { x: '100%', opacity: 0, duration: 0.35, ease: 'power2.out' }),
      },
      {
        name: 'to-history',
        to: { namespace: 'history' },
        leave: (data) => gsap.to(data.current.container, { opacity: 0, duration: 0.2 }),
        enter: (data) =>
          gsap.from(data.next.container, { y: '100%', opacity: 0, duration: 0.35, ease: 'power2.out' }),
      },
      {
        name: 'to-snippets',
        to: { namespace: 'snippets' },
        leave: (data) => gsap.to(data.current.container, { opacity: 0, duration: 0.2 }),
        enter: (data) =>
          gsap.from(data.next.container, { x: '-100%', opacity: 0, duration: 0.35, ease: 'power2.out' }),
      },
      {
        name: 'to-settings',
        to: { namespace: 'settings' },
        leave: () => {},
        enter: (data) => gsap.from(data.next.container, { opacity: 0, duration: 0.25 }),
      },
      {
        name: 'default',
        leave: (data) => gsap.to(data.current.container, { opacity: 0, duration: 0.2 }),
        enter: (data) => gsap.from(data.next.container, { opacity: 0, duration: 0.25 }),
      },
    ],
    views: [
      { namespace: 'terminal', afterEnter() { window.rxterm?.initTerminalView(); } },
      { namespace: 'dashboard', afterEnter() { window.rxterm?.initDashboardView(); } },
      { namespace: 'history', afterEnter() { window.rxterm?.initHistoryView(); } },
      { namespace: 'snippets', afterEnter() { window.rxterm?.initSnippetsView(); } },
      { namespace: 'settings', afterEnter() { window.rxterm?.initSettingsView(); } },
    ],
  });
    barbaInitialized = true;
  } catch (e) {
    console.warn('[barba] init skipped:', e);
  }
}

export function runViewTransition(from, to, refs) {
  const current = refs?.[from];
  const next = refs?.[to];
  if (!current || !next) return;
  const key = `${from}:${to}`;
  const inverseKey = `${to}:${from}`;
  const transition = transitionMap[key] || transitionMap[inverseKey];
  current.style.pointerEvents = 'none';
  next.style.pointerEvents = 'all';
  gsap.killTweensOf([current, next]);
  if (!transition) {
    gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    return;
  }
  transition.leave(current);
  transition.enter(next);
}

export default barba;
