/* ─────────────────────────────────────────────────────────────────
   utils.js — shared helpers + the global FLAM namespace.
   Loaded first; every other file augments `window.FLAM`.

   Cloned from the JHSF Aviation Show totem (proven on-site), retargeted
   to the Flamboyant interactive table. Same mechanics: hyperscript el(),
   fetch helpers, image/SVG mounting.
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const FLAM = (window.FLAM = window.FLAM || {});

  /* DOM ----------------------------------------------------------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /**
   * Tiny hyperscript helper.
   *   el('div.pill', { 'data-id': 'fotos' }, [ el('span', {}, 'Fotos') ])
   * `tag` accepts `tagname.class.class` shorthand.
   */
  function el(tag, attrs = {}, children = []) {
    const parts = String(tag).split('.');
    const node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    }
    const kids = Array.isArray(children) ? children : [children];
    for (const c of kids) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  /* Async --------------------------------------------------------- */
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    return res.json();
  }

  /** Inject a raster image (PNG/JPG) as an <img> inside `mount`. */
  function mountImage(mount, url, alt = '') {
    if (!mount || !url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.draggable = false;
    mount.innerHTML = '';
    mount.appendChild(img);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Coalesce rapid calls (used for resize / idle bookkeeping). */
  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /** True when an asset path is a video (drives <video> vs <img> in gallery). */
  function isVideo(url) { return /\.(mp4|webm|mov|m4v)($|\?)/i.test(String(url || '')); }

  function log(tag, ...rest) { console.log(`%c[${tag}]`, 'color:#A0191E', ...rest); }

  FLAM.util = { $, $$, el, fetchJSON, mountImage, sleep, debounce, clamp, isVideo, log };
})();
