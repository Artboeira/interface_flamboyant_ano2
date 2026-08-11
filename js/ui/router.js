/* ─────────────────────────────────────────────────────────────────
   router.js — screen navigation as a history stack.

   State is a plain array of `{ screen, params }` frames. The current
   screen is the last frame. `navigate` pushes, `back` pops, `reset`
   collapses to `[splash]` (used by the idle timeout).

   The router builds the incoming `.screen` via `FLAM.screens.build`,
   mounts it into `#screen-root`, and runs the 600 ms cross-dissolve
   (FADE_MS abaixo; deve casar com --fl-fade).
   Each screen owns its own chrome (wordmark / hairlines / voltar).
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const FLAM = (window.FLAM = window.FLAM || {});
  const { log } = FLAM.util;

  const FADE_MS = 600;   // deve casar com --fl-fade no CSS

  const root = () => document.getElementById('screen-root');

  /** @type {{screen:string, params:object}[]} */
  let stack = [];
  let transitioning = false;
  /** the currently-mounted `.screen` element */
  let currentEl = null;

  /* ── mounting + transition ──────────────────────────────────────── */
  async function mount(frame) {
    transitioning = true;

    let incoming;
    try {
      incoming = await FLAM.screens.build(frame.screen, frame.params);
    } catch (e) {
      console.error('[router] failed to build screen', frame, e);
      transitioning = false;
      return;
    }

    const outgoing = currentEl;
    root().appendChild(incoming);
    // force layout so the opacity transition actually runs
    // eslint-disable-next-line no-unused-expressions
    incoming.offsetHeight;
    incoming.classList.add('is-active');
    if (outgoing) outgoing.classList.add('is-leaving');

    currentEl = incoming;

    await new Promise((resolve) => setTimeout(resolve, FADE_MS));
    if (outgoing && outgoing.parentNode) outgoing.parentNode.removeChild(outgoing);
    transitioning = false;
  }

  /* ── public navigation API ──────────────────────────────────────── */

  function current() { return stack.length ? stack[stack.length - 1] : null; }

  async function navigate(screen, params = {}) {
    if (transitioning) return;
    stack.push({ screen, params });
    log('router', 'push →', screen, params, `(depth ${stack.length})`);
    await mount(current());
  }

  async function replace(screen, params = {}) {
    if (transitioning) return;
    if (stack.length) stack[stack.length - 1] = { screen, params };
    else stack.push({ screen, params });
    log('router', 'replace →', screen, params);
    await mount(current());
  }

  async function back() {
    if (transitioning) return;
    if (stack.length <= 1) { log('router', 'back at root — ignored'); return; }
    const popped = stack.pop();
    log('router', 'pop ←', popped.screen, `(depth ${stack.length})`);
    await mount(current());
  }

  // Idle timeout / cold boot — back to the splash. Also used by VOLTAR
  // pressed on the splash itself (no-op).
  async function reset() {
    if (transitioning) return;
    stack = [{ screen: 'splash' }];
    log('router', 'reset → splash');
    await mount(current());
  }

  function start(initialScreen = 'splash', params = {}) {
    stack = [{ screen: initialScreen, params }];
    return mount(current());
  }

  function depth() { return stack.length; }
  function canGoBack() { return stack.length > 1; }

  FLAM.router = { start, navigate, replace, back, reset, current, depth, canGoBack };
})();
