/*
 * Turn alerts: a chime, a flashing tab title, vibration on phones, and a system
 * notification when the page is in the background (https or localhost only).
 */
(function (root) {
  'use strict';

  const KEY = 'chess-alerts';
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== '0'; } catch (e) { /* storage blocked */ }

  let titleTimer = null, savedTitle = null;

  // Browsers only allow sound after the person has interacted with the page once.
  let ctx = null;
  function unlockAudio() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* no audio */ }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlockAudio, { passive: true }));

  function chime(kind) {
    if (!ctx || ctx.state !== 'running') return;
    const notes = kind === 'end' ? [523, 659, 784] : [660, 880];
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
  }

  function flashTitle(text) {
    stopFlash();
    savedTitle = document.title;
    let on = false;
    titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? `● ${text} · ${savedTitle}` : savedTitle;
    }, 1000);
    document.title = `● ${text} · ${savedTitle}`;
  }
  function stopFlash() {
    if (titleTimer) clearInterval(titleTimer);
    titleTimer = null;
    if (savedTitle) document.title = savedTitle;
    savedTitle = null;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) stopFlash(); });
  window.addEventListener('focus', stopFlash);

  const canNotify = () => 'Notification' in window && window.isSecureContext;

  // Phones (Android Chrome) only show notifications through a service worker.
  let swReg = null;
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }

  function notify(title, body) {
    if (!canNotify() || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'lan-chess', renotify: true };
    if (swReg && swReg.showNotification) { swReg.showNotification(title, opts).catch(() => {}); return; }
    try {
      const n = new Notification(title, opts);
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* not supported here */ }
  }

  function alert(title, body, kind) {
    if (!enabled) return;
    chime(kind);
    if (navigator.vibrate) { try { navigator.vibrate(kind === 'end' ? [120, 80, 120] : 200); } catch (e) { /* ignore */ } }
    if (document.hidden || !document.hasFocus()) {
      flashTitle(title);
      notify(title, body);
    }
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (on) {
      unlockAudio();
      chime('turn'); // a sample, so people know what to listen for
      if (canNotify() && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    }
  }

  root.Alerts = {
    alert,
    setEnabled,
    isEnabled: () => enabled,
    canNotify,
    permission: () => (canNotify() ? Notification.permission : 'unavailable'),
  };
})(window);
